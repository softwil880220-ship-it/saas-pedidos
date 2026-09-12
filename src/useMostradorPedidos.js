import { useCallback, useMemo } from 'react';
import {
  COLUMNAS_PEDIDOS_MOSTRADOR,
  aplicarFiltrosQueryMostrador,
  pedidoCoincideFiltroMostrador,
} from './pedidosQueryHelpers';
import {
  obtenerFechaHoyClave,
  pedidoEntregadoMostradorHoy,
  pedidoPendienteEntregaMostrador,
} from './pedidosShared';
import { usePedidosRealtime } from './usePedidosRealtime';

export function useMostradorPedidos({ negocioId, hoyClave = obtenerFechaHoyClave() }) {
  const filtrar = useCallback(
    (pedido) => pedidoCoincideFiltroMostrador(pedido, hoyClave),
    [hoyClave]
  );

  const aplicarFiltrosQuery = useCallback(
    (query) => aplicarFiltrosQueryMostrador(query, hoyClave),
    [hoyClave]
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
        .filter((pedido) => pedidoEntregadoMostradorHoy(pedido, hoyClave))
        .sort(compararEntregados),
    [pedidos, hoyClave, compararEntregados]
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
