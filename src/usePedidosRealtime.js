import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

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
  } = options;

  const eventType = normalizarEventType(payload);
  const { new: nuevo, old: anterior } = payload;

  const aplicarOrden = (lista) => {
    if (ordenar) return ordenar(lista);
    if (comparar) return [...lista].sort(comparar);
    return lista;
  };

  const cumple = (item) => (item ? !filtrar || filtrar(item) : false);

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
        next[index] = registro;
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

export function sincronizarPedidosConEvento(prev, payload, filtrar, comparar) {
  return sincronizarListaConEvento(prev, payload, {
    filtrar,
    comparar,
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

function useSupabaseRealtime({
  table,
  channelName,
  filtrar = null,
  comparar = null,
  ordenInicial = { column: 'created_at', ascending: false },
  ordenarLista = null,
}) {
  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(true);

  const aplicarFiltroYOrden = useCallback(
    (lista) => {
      const filtrada = filtrar ? lista.filter(filtrar) : lista;
      if (ordenarLista) return ordenarLista(filtrada);
      if (comparar) return [...filtrada].sort(comparar);
      return filtrada;
    },
    [filtrar, comparar, ordenarLista]
  );

  useEffect(() => {
    let activo = true;

    const cargarItems = async () => {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .order(ordenInicial.column, { ascending: ordenInicial.ascending });

      if (activo && !error && data) {
        setItems(aplicarFiltroYOrden(data));
      }
      if (activo) setCargando(false);
    };

    cargarItems();

    const channel = supabase.channel(channelName);

    suscribirPostgresChanges(channel, {
      schema: 'public',
      table,
      handler: (payload) => {
        setItems((prev) =>
          sincronizarListaConEvento(prev, payload, {
            filtrar,
            comparar,
            ordenar: ordenarLista
              ? (lista) => ordenarLista(lista)
              : comparar
                ? (lista) => [...lista].sort(comparar)
                : null,
          })
        );
      },
    });

    channel.subscribe();

    return () => {
      activo = false;
      supabase.removeChannel(channel);
    };
  }, [
    table,
    channelName,
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
  const { channelName = 'pedidos', filtrar = null, comparar = null } = options;

  const { items, setItems, cargando } = useSupabaseRealtime({
    table: 'pedidos',
    channelName,
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
  const { channelName = 'productos', comparar = null } = options;

  const { items, setItems, cargando } = useSupabaseRealtime({
    table: 'productos',
    channelName,
    comparar,
    ordenInicial: { column: 'id', ascending: true },
    ordenarLista: comparar
      ? (lista) => [...lista].sort(comparar)
      : ordenarProductosAsc,
  });

  return { productos: items, setProductos: setItems, cargando };
}
