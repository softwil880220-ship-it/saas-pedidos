import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { perteneceANegocio, queryConNegocio } from './tenantHelpers';

const REALTIME_EVENTOS = ['INSERT', 'UPDATE', 'DELETE'];
const CANAL_SUSCRITO_UMBRAL_MS = 30000;

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

function idsCoinciden(idA, idB) {
  if (idA == null || idB == null) return false;
  return String(idA) === String(idB);
}

function agregarRegistroSinDuplicarId(lista, registro) {
  const index = lista.findIndex((item) => idsCoinciden(item.id, registro.id));

  if (index !== -1) {
    const next = [...lista];
    next[index] = { ...lista[index], ...registro };
    return next;
  }

  return [...lista, registro];
}

function deduplicarListaPorId(lista) {
  const vistos = new Set();

  return lista.filter((item) => {
    const id = String(item.id);
    if (vistos.has(id)) return false;
    vistos.add(id);
    return true;
  });
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
    return prev.filter((item) => !idsCoinciden(item.id, id));
  }

  const registro = nuevo && Object.keys(nuevo).length > 0 ? nuevo : null;
  if (!registro) return prev;

  const id = registro.id;

  if (eventType === 'UPDATE' && registro.deleted_at != null) {
    return prev.filter((item) => !idsCoinciden(item.id, id));
  }

  const index = prev.findIndex((item) => idsCoinciden(item.id, id));
  const enLista = index !== -1;
  const registroFusionado =
    enLista && eventType === 'UPDATE'
      ? { ...prev[index], ...registro }
      : registro;

  if (eventType === 'INSERT' || eventType === 'UPDATE') {
    if (cumple(registroFusionado)) {
      if (enLista) {
        const next = [...prev];
        next[index] = registroFusionado;
        return aplicarOrden(next);
      }
      return aplicarOrden(
        deduplicarListaPorId(agregarRegistroSinDuplicarId(prev, registroFusionado))
      );
    }

    if (enLista) {
      return prev.filter((item) => !idsCoinciden(item.id, id));
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

function crearOpcionesSincronizacion({ filtrar, comparar, ordenarLista, negocioId }) {
  return {
    filtrar,
    comparar,
    negocioId,
    ordenar: ordenarLista
      ? (lista) => ordenarLista(lista)
      : comparar
        ? (lista) => [...lista].sort(comparar)
        : null,
  };
}

function replayBufferSobreBase(base, eventBuffer, syncOpts) {
  return eventBuffer.reduce(
    (acc, payload) => sincronizarListaConEvento(acc, payload, syncOpts),
    base
  );
}

function registrarErrorFetchRealtime(contexto, detalle) {
  console.error('[realtime] fetch falló', {
    ...contexto,
    ...detalle,
  });
}

function registrarErrorCanalRealtime(mensaje, detalle) {
  console.error(`[realtime] ${mensaje}`, detalle);
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
    let syncGeneration = 0;
    let modo = 'buffering';
    const eventBuffer = [];
    let fetchCompletado = false;
    let fetchResultado = null;
    let canalSubscribed = false;
    let canalDegradado = false;
    let fetchEnVuelo = false;
    let reconcilePendiente = false;
    let bufferFinalizado = false;
    let esArranqueInicial = true;
    let ultimosItemsConocidos = [];
    let subscribeTimeoutId = null;
    let canalEstadoActual = null;

    const contextoLog = { table, channelName, negocioId };
    const syncOpts = crearOpcionesSincronizacion({
      filtrar,
      comparar,
      ordenarLista,
      negocioId,
    });

    const sesionValida = (generation) => activo && generation === syncGeneration;

    const limpiarSubscribeTimeout = () => {
      if (subscribeTimeoutId != null) {
        clearTimeout(subscribeTimeoutId);
        subscribeTimeoutId = null;
      }
    };

    const construirBaseDesdeFetch = (resultado, esArranque) => {
      if (resultado?.error) {
        return esArranque ? [] : ultimosItemsConocidos;
      }

      if (Array.isArray(resultado?.data)) {
        return aplicarFiltroYOrden(resultado.data);
      }

      return esArranque ? [] : ultimosItemsConocidos;
    };

    const aplicarBufferYLive = (base, generation) => {
      if (!sesionValida(generation) || bufferFinalizado) {
        return;
      }

      bufferFinalizado = true;
      const merged = replayBufferSobreBase(base, eventBuffer, syncOpts);
      eventBuffer.length = 0;
      ultimosItemsConocidos = merged;
      setItems(merged);
      modo = 'live';

      if (esArranqueInicial) {
        setCargando(false);
      }
    };

    const finalizarBufferSiListo = (generation, { requiereCanal = true } = {}) => {
      if (!sesionValida(generation) || bufferFinalizado || modo !== 'buffering') {
        return;
      }

      if (!fetchCompletado) {
        return;
      }

      if (requiereCanal && !canalSubscribed) {
        return;
      }

      const base = construirBaseDesdeFetch(fetchResultado, esArranqueInicial);
      aplicarBufferYLive(base, generation);
    };

    const onEvento = (payload) => {
      if (!activo) {
        return;
      }

      if (modo === 'buffering') {
        eventBuffer.push(payload);
        return;
      }

      setItems((prev) => {
        const next = sincronizarListaConEvento(prev, payload, syncOpts);
        ultimosItemsConocidos = next;
        return next;
      });
    };

    const programarTimeoutSuscripcion = (generation) => {
      limpiarSubscribeTimeout();
      subscribeTimeoutId = setTimeout(() => {
        if (!sesionValida(generation) || canalSubscribed || bufferFinalizado) {
          return;
        }

        registrarErrorCanalRealtime('canal no suscrito a tiempo', {
          channelName,
          umbralMs: CANAL_SUSCRITO_UMBRAL_MS,
        });
        canalSubscribed = true;
        finalizarBufferSiListo(generation);
      }, CANAL_SUSCRITO_UMBRAL_MS);
    };

    const ejecutarFetch = async (generation, motivo, { esArranque = false } = {}) => {
      if (fetchEnVuelo) {
        reconcilePendiente = true;
        return;
      }

      fetchEnVuelo = true;

      let query = supabase.from(table).select('*');
      if (table === 'pedidos') {
        query = query.is('deleted_at', null);
      }

      const { data, error } = await queryConNegocio(query, negocioId).order(
        ordenInicial.column,
        { ascending: ordenInicial.ascending }
      );

      fetchEnVuelo = false;

      if (!sesionValida(generation)) {
        return;
      }

      fetchCompletado = true;
      fetchResultado = { data, error };

      if (error) {
        registrarErrorFetchRealtime(contextoLog, {
          motivo,
          error,
        });
      }

      finalizarBufferSiListo(generation, { requiereCanal: esArranque });

      if (reconcilePendiente) {
        reconcilePendiente = false;
        void ejecutarReconcile(generation, 'coalesced');
      }
    };

    const ejecutarReconcile = (generation, motivo) => {
      if (!sesionValida(generation)) {
        return;
      }

      if (fetchEnVuelo) {
        reconcilePendiente = true;
        return;
      }

      esArranqueInicial = false;
      modo = 'buffering';
      bufferFinalizado = false;
      fetchCompletado = false;
      fetchResultado = null;

      void ejecutarFetch(generation, motivo, { esArranque: false });
    };

    const reconciliar = (motivo) => {
      syncGeneration += 1;
      const generation = syncGeneration;
      ejecutarReconcile(generation, motivo);
    };

    const conectarRealtime = (generation) => {
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }

      canalSubscribed = false;
      canalEstadoActual = null;
      limpiarSubscribeTimeout();

      channel = supabase.channel(channelName);
      suscribirPostgresChanges(channel, {
        schema: 'public',
        table,
        handler: onEvento,
      });

      programarTimeoutSuscripcion(generation);

      channel.subscribe((status, err) => {
        if (!activo) {
          return;
        }

        canalEstadoActual = status;

        if (status === 'SUBSCRIBED') {
          limpiarSubscribeTimeout();
          const eraDegradado = canalDegradado;
          canalSubscribed = true;

          if (eraDegradado) {
            canalDegradado = false;
            reconciliar('canal_reconectado');
            return;
          }

          finalizarBufferSiListo(generation);
          return;
        }

        if (status === 'CHANNEL_ERROR') {
          registrarErrorCanalRealtime('canal error', {
            status,
            channelName,
            table,
            err: err ?? null,
          });
          canalDegradado = true;
          canalSubscribed = false;
          return;
        }

        if (status === 'TIMED_OUT' || status === 'CLOSED') {
          registrarErrorCanalRealtime('canal desconectado', {
            status,
            channelName,
          });
          canalDegradado = true;
          canalSubscribed = false;
        }
      });
    };

    const iniciarArranque = () => {
      syncGeneration += 1;
      const generation = syncGeneration;

      esArranqueInicial = true;
      modo = 'buffering';
      bufferFinalizado = false;
      fetchCompletado = false;
      fetchResultado = null;
      canalSubscribed = false;
      canalDegradado = false;
      eventBuffer.length = 0;
      ultimosItemsConocidos = [];

      setCargando(true);
      conectarRealtime(generation);
      void ejecutarFetch(generation, 'initial', { esArranque: true });
    };

    iniciarArranque();

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || !activo) {
        return;
      }

      const necesitaReconectar = canalEstadoActual !== 'SUBSCRIBED';

      syncGeneration += 1;
      const generation = syncGeneration;

      if (necesitaReconectar) {
        conectarRealtime(generation);
      }

      ejecutarReconcile(generation, 'visibility');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      activo = false;
      limpiarSubscribeTimeout();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (channel) {
        supabase.removeChannel(channel);
      }
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

  const ordenarLista = useCallback(
    (lista) =>
      comparar ? [...lista].sort(comparar) : ordenarPedidosDesc(lista),
    [comparar]
  );

  const { items, setItems, cargando } = useSupabaseRealtime({
    table: 'pedidos',
    channelName,
    negocioId,
    filtrar,
    comparar,
    ordenInicial: { column: 'created_at', ascending: false },
    ordenarLista,
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
