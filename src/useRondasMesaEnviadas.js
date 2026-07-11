import { useCallback, useEffect, useState } from 'react';
import { pedidoEsRondaMesaEnviada, resolverNombreCapturaPedido } from './pedidosShared';
import { supabase } from './supabase';
import { queryConNegocio } from './tenantHelpers';
import { usePedidosRealtime } from './usePedidosRealtime';

export function useRondasMesaEnviadas({ negocioId, numeroMesa, abiertaEn, activo }) {
  const [nombresCapturaPorId, setNombresCapturaPorId] = useState({});

  const filtrarRondas = useCallback(
    (pedido) =>
      activo &&
      pedidoEsRondaMesaEnviada(pedido, {
        numeroMesa,
        abiertaEn,
      }),
    [activo, numeroMesa, abiertaEn]
  );

  const compararRondas = useCallback(
    (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0),
    []
  );

  const { pedidos: rondas, cargando } = usePedidosRealtime({
    channelName: `mesa-${numeroMesa}-rondas-enviadas`,
    negocioId: activo ? negocioId : null,
    filtrar: filtrarRondas,
    comparar: compararRondas,
  });

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

  return {
    rondas,
    cargando,
    resolverNombreCaptura,
  };
}
