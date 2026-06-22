import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { perteneceANegocio, queryConNegocio } from './tenantHelpers';

const REALTIME_EVENTOS = ['INSERT', 'UPDATE', 'DELETE'];

function ordenarPedidosDesc(pedidos) {
  return [...pedidos].sort(
    (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
  );
}

function ordenarProductosAsc(productos) {
  return [...productos].sort((a, b) => Number(a.id) - Number(b.id));
}

function normalizarEventType(payload) {
  return String(payload.eventType ?? payload.type ?? '').toUpperCase();
}

function obtenerIdRegistro(payload) {
  const { new: nuevo, old: anterior } = payload;
  return anterior?.id ?? nuevo?.id;
}

export function sincronizarListaConEvento(prev, payload, options = {}) {
  const {
    filtrar = null,
    comparar = null,
    ordenar = null,
    negocioId = null,
  } = options;

  const eventType = normalizarEventType(payload);
  const { new: nuevo, old: anterior } = payload;

  const aplicarOrden = (lista) => {
    if (ordenar) return ordenar(lista);
    if (comparar) return [...lista].sort(comparar);
    return lista;
  };

  const cumple = (item) =>
    item ? perteneceANegocio(item, negocioId) && (!filtrar || filtrar(item)) : false;

  if (eventType === 'DELETE') {
    const id = obtenerIdRegistro(payload);
    if (id == null) return prev;
    return prev.filter((item) => item.id !== id);
  }

  const registro = nuevo && Object.keys(nuevo).length > 0 ? nuevo : null;
  if (!registro) return prev;

  const id = registro.id;
  const index = prev.findIndex((item) => item.id === id);
  const enLista = index !== -1;

  if (eventType === 'INSERT' || eventType === 'UPDATE') {
    if (cumple(registro)) {
      if (enLista) {
        const next = [...prev];
        next[index] = { ...prev[index], ...registro };
        return aplicarOrden(next);
      }
      return aplicarOrden([...prev, registro]);
    }

    if (enLista) {
      return prev.filter((item) => item.id !== id);
    }
  }

  return prev;
}

export function sincronizarPedidosConEvento(prev, payload, filtrar, comparar, negocioId) {
  return sincronizarListaConEvento(prev, payload, {
    filtrar,
    comparar,
    negocioId,
    ordenar: comparar
      ? (lista) => [...lista].sort(comparar)
      : ordenarPedidosDesc,
  });
}

function suscribirPostgresChanges(channel, { schema, table, handler }) {
  REALTIME_EVENTOS.forEach((event) => {
    channel.on(
      'postgres_changes',
      { event, schema, table },
      handler
    );
  });
}

function crearHandlerRealtime({ filtrar, comparar, ordenarLista, setItems, negocioId }) {
  return (payload) => {
    setItems((prev) =>
      sincronizarListaConEvento(prev, payload, {
        filtrar,
        comparar,
        negocioId,
        ordenar: ordenarLista
          ? (lista) => ordenarLista(lista)
          : comparar
            ? (lista) => [...lista].sort(comparar)
            : null,
      })
    );
  };
}

function useSupabaseRealtime({
  table,
  channelName,
  negocioId = null,
  filtrar = null,
  comparar = null,
  ordenInicial = { column: 'created_at', ascending: false },
  ordenarLista = null,
}) {
  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(true);

  const aplicarFiltroYOrden = useCallback(
    (lista) => {
      const filtrada = lista.filter((item) => perteneceANegocio(item, negocioId));
      const conFiltro = filtrar ? filtrada.filter(filtrar) : filtrada;
      if (ordenarLista) return ordenarLista(conFiltro);
      if (comparar) return [...conFiltro].sort(comparar);
      return conFiltro;
    },
    [filtrar, comparar, ordenarLista, negocioId]
  );

  useEffect(() => {
    if (!negocioId) {
      setItems([]);
      setCargando(false);
      return undefined;
    }

    let activo = true;
    let channel = null;

    const cargarItems = async () => {
      setCargando(true);
      const { data, error } = await queryConNegocio(
        supabase.from(table).select('*'),
        negocioId
      ).order(ordenInicial.column, { ascending: ordenInicial.ascending });

      if (activo && !error && data) {
        setItems(aplicarFiltroYOrden(data));
      }
      if (activo) setCargando(false);
    };

    const conectarRealtime = () => {
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }

      channel = supabase.channel(channelName);
      suscribirPostgresChanges(channel, {
        schema: 'public',
        table,
        handler: crearHandlerRealtime({
          filtrar,
          comparar,
          ordenarLista,
          setItems,
          negocioId,
        }),
      });
      channel.subscribe();
    };

    const sincronizar = async () => {
      await cargarItems();
      if (activo) conectarRealtime();
    };

    sincronizar();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && activo) {
        sincronizar();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      activo = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (channel) supabase.removeChannel(channel);
    };
  }, [
    table,
    channelName,
    negocioId,
    filtrar,
    comparar,
    aplicarFiltroYOrden,
    ordenInicial.column,
    ordenInicial.ascending,
    ordenarLista,
  ]);

  return { items, setItems, cargando };
}

export function usePedidosRealtime(options = {}) {
  const {
    channelName = 'pedidos',
    negocioId = null,
    filtrar = null,
    comparar = null,
  } = options;

  const { items, setItems, cargando } = useSupabaseRealtime({
    table: 'pedidos',
    channelName,
    negocioId,
    filtrar,
    comparar,
    ordenInicial: { column: 'created_at', ascending: false },
    ordenarLista: comparar
      ? (lista) => [...lista].sort(comparar)
      : ordenarPedidosDesc,
  });

  return { pedidos: items, setPedidos: setItems, cargando };
}

export function useProductosRealtime(options = {}) {
  const { channelName = 'productos', negocioId = null, comparar = null } = options;

  const { items, setItems, cargando } = useSupabaseRealtime({
    table: 'productos',
    channelName,
    negocioId,
    comparar,
    ordenInicial: { column: 'id', ascending: true },
    ordenarLista: comparar
      ? (lista) => [...lista].sort(comparar)
      : ordenarProductosAsc,
  });

  return { productos: items, setProductos: setItems, cargando };
}
