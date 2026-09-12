import { pedidoPerteneceJornada } from './jornadaHelpers';
import {
  esPedidoMostrador,
  formatearClaveFecha,
  obtenerRangoFechaClave,
  pedidoEntregadoMostradorHoy,
  pedidoPendienteEntregaMostrador,
} from './pedidosShared';

export const COLUMNAS_PEDIDOS_MOSTRADOR = [
  'id',
  'negocio_id',
  'folio',
  'created_at',
  'updated_at',
  'status',
  'total',
  'referencia',
  'producto',
  'lineas_detalle',
  'tipo',
  'tipo_entrega',
  'forma_pago',
  'deleted_at',
  'status_cocina1',
  'status_cocina2',
  'mostrador_listo_at',
  'mostrador_en_preparacion_at',
  'mostrador_entregado_at',
  'jornada_id',
].join(', ');

export function pedidoCoincideFiltroMostrador(pedido, hoyClave) {
  if (!esPedidoMostrador(pedido) || pedido.deleted_at != null) {
    return false;
  }

  if (pedidoPendienteEntregaMostrador(pedido)) {
    return true;
  }

  return pedidoEntregadoMostradorHoy(pedido, hoyClave);
}

export function aplicarFiltrosQueryMostrador(query, hoyClave) {
  const { inicio, fin } = obtenerRangoFechaClave(hoyClave);

  return query
    .eq('tipo', 'mostrador')
    .is('deleted_at', null)
    .or(
      `status.neq.entregado,and(status.eq.entregado,mostrador_entregado_at.gte.${inicio.toISOString()},mostrador_entregado_at.lte.${fin.toISOString()})`
    );
}

export function pedidoCoincideFiltroDashboard(
  pedido,
  { jornadaId = null, jornadaAbiertaEn = null, filtroFechaClave }
) {
  if (pedido?.deleted_at != null) {
    return false;
  }

  if (
    jornadaId &&
    pedidoPerteneceJornada(pedido, { id: jornadaId, abierta_en: jornadaAbiertaEn })
  ) {
    return true;
  }

  if (pedido?.tipo === 'presencial' && pedido.created_at && filtroFechaClave) {
    return formatearClaveFecha(new Date(pedido.created_at)) === filtroFechaClave;
  }

  return false;
}

export function aplicarFiltrosQueryDashboard(query, { jornadaId = null, filtroFechaClave }) {
  const { inicio, fin } = obtenerRangoFechaClave(filtroFechaClave);
  const querySinEliminados = query.is('deleted_at', null);

  if (jornadaId) {
    return querySinEliminados.or(
      `jornada_id.eq.${jornadaId},and(tipo.eq.presencial,created_at.gte.${inicio.toISOString()},created_at.lte.${fin.toISOString()})`
    );
  }

  return querySinEliminados
    .eq('tipo', 'presencial')
    .gte('created_at', inicio.toISOString())
    .lte('created_at', fin.toISOString());
}
