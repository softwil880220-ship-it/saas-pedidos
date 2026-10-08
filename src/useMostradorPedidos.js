import { useCallback, useMemo } from 'react';
import {
  COLUMNAS_PEDIDOS_MOSTRADOR,
  aplicarFiltrosQueryMostrador,
  pedidoCoincideFiltroMostrador,
  pedidoEntregadoMostradorEnJornada,
} from './pedidosQueryHelpers';
import {
  obtenerFechaHoyClave,
  pedidoPendienteEntregaMostrador,
} from './pedidosShared';
import { usePedidosRealtime } from './usePedidosRealtime';

export function useMostradorPedidos({ negocioId, jornadaAbierta = null }) {
  const jornada = useMemo(
    () =>
      jornadaAbierta?.id
        ? { id: jornadaAbierta.id, abierta_en: jornadaAbierta.abierta_en ?? null }
        : null,
    [jornadaAbierta?.id, jornadaAbierta?.abierta_en]
  );

  const filtrar = useCallback(
    (pedido) => pedidoCoincideFiltroMostrador(pedido, { jornada }),
    [jornada]
  );

  const aplicarFiltrosQuery = useCallback(
    (query) => aplicarFiltrosQueryMostrador(query, { jornadaId: jornada?.id ?? null }),
    [jornada?.id]
  );

  const compararPendientes = useCallback(
    (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0),
    []
  );

  const compararEntregados = useCallback(
    (a, b) =>
      new Date(b.mostrador_entregado_at || 0) - new Date(a.mostrador_entregado_at || 0),
    []
  );

  const { pedidos, setPedidos, cargando, error } = usePedidosRealtime({
    channelName: 'mostrador-pedidos',
    negocioId,
    filtrar,
    aplicarFiltrosQuery,
    select: COLUMNAS_PEDIDOS_MOSTRADOR,
  });

  const pedidosPendientes = useMemo(
    () =>
      pedidos
        .filter(pedidoPendienteEntregaMostrador)
        .sort(compararPendientes),
    [pedidos, compararPendientes]
  );

  const pedidosEntregadosHoy = useMemo(
    () =>
      pedidos
        .filter((pedido) => pedidoEntregadoMostradorEnJornada(pedido, jornada))
        .sort(compararEntregados),
    [pedidos, jornada, compararEntregados]
  );

  return {
    pedidos,
    setPedidos,
    pedidosPendientes,
    pedidosEntregadosHoy,
    cargando,
    error,
  };
}
