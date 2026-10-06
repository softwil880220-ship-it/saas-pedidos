import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  aplicarFiltrosQueryMesaFolio,
  pedidoCoincideFiltroMesaFolio,
} from './pedidosQueryHelpers';
import { resolverNombreCapturaPedido } from './pedidosShared';
import { supabase } from './supabase';
import { queryConNegocio } from './tenantHelpers';
import { usePedidosRealtime } from './usePedidosRealtime';
import {
  calcularSubtotalConsolidadoMesa,
  consolidarProductosRondasMesa,
} from './mesaCobroCalculos';

export function usePedidosFolioMesa({
  negocioId,
  numeroMesa,
  abiertaEn,
  jornadaId = null,
  activo,
}) {
  const filtrosMesa = useMemo(
    () => ({ numeroMesa, abiertaEn, jornadaId }),
    [numeroMesa, abiertaEn, jornadaId]
  );

  const filtrarPedidosFolio = useCallback(
    (pedido) =>
      activo && pedidoCoincideFiltroMesaFolio(pedido, filtrosMesa),
    [activo, filtrosMesa]
  );

  const aplicarFiltrosQuery = useCallback(
    (query) => aplicarFiltrosQueryMesaFolio(query, filtrosMesa),
    [filtrosMesa]
  );

  const compararPedidosFolio = useCallback(
    (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0),
    []
  );

  const { pedidos, cargando } = usePedidosRealtime({
    channelName: `mesa-${numeroMesa}-folio-pedidos`,
    negocioId: activo ? negocioId : null,
    filtrar: filtrarPedidosFolio,
    comparar: compararPedidosFolio,
    aplicarFiltrosQuery,
  });

  const [nombresCapturaPorId, setNombresCapturaPorId] = useState({});

  useEffect(() => {
    if (!negocioId || !activo) {
      setNombresCapturaPorId({});
      return undefined;
    }

    let vivo = true;

    const cargarNombresCaptura = async () => {
      const { data, error } = await queryConNegocio(
        supabase.from('usuarios_negocio').select('id, nombre').eq('activo', true),
        negocioId
      );

      if (!vivo || error || !data) {
        return;
      }

      setNombresCapturaPorId(
        Object.fromEntries(data.map((usuario) => [String(usuario.id), usuario.nombre]))
      );
    };

    void cargarNombresCaptura();

    return () => {
      vivo = false;
    };
  }, [negocioId, activo]);

  const resolverNombreCaptura = useCallback(
    (pedido) => resolverNombreCapturaPedido(pedido, nombresCapturaPorId),
    [nombresCapturaPorId]
  );

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
    resolverNombreCaptura,
  };
}
