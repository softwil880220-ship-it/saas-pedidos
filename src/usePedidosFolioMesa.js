import { useCallback, useMemo } from 'react';
import { pedidoEsRondaMesaEnviada } from './pedidosShared';
import { usePedidosRealtime } from './usePedidosRealtime';
import {
  calcularSubtotalConsolidadoMesa,
  consolidarProductosRondasMesa,
} from './mesaCobroCalculos';

export function usePedidosFolioMesa({ negocioId, numeroMesa, abiertaEn, activo }) {
  const filtrarPedidosFolio = useCallback(
    (pedido) =>
      activo &&
      pedidoEsRondaMesaEnviada(pedido, {
        numeroMesa,
        abiertaEn,
      }),
    [activo, numeroMesa, abiertaEn]
  );

  const compararPedidosFolio = useCallback(
    (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0),
    []
  );

  const { pedidos, cargando } = usePedidosRealtime({
    channelName: `mesa-${numeroMesa}-cobro-folio`,
    negocioId: activo ? negocioId : null,
    filtrar: filtrarPedidosFolio,
    comparar: compararPedidosFolio,
  });

  const productosConsolidados = useMemo(
    () => consolidarProductosRondasMesa(pedidos),
    [pedidos]
  );

  const subtotal = useMemo(
    () => calcularSubtotalConsolidadoMesa(productosConsolidados),
    [productosConsolidados]
  );

  return {
    pedidos,
    productosConsolidados,
    subtotal,
    cargando,
  };
}
