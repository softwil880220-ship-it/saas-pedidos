import { pedidoPerteneceJornada } from './jornadaHelpers';
import {
  clienteEtiquetaMesa,
  esPedidoMostrador,
  formatearClaveFecha,
  obtenerRangoFechaClave,
  pedidoEsRondaMesaEnviada,
  pedidoPendienteEntregaMostrador,
} from './pedidosShared';

export const MODULO_POR_MODO = {
  presencial: 'habilitar_caja',
  mostrador: 'habilitar_mostrador',
  whatsapp: 'habilitar_recoger_domicilio',
  mesas: 'habilitar_mesas',
};

export function modoDashboardDesdeTipoPedido(tipo) {
  if (tipo == null || tipo === '' || tipo === 'whatsapp') {
    return 'whatsapp';
  }

  if (tipo === 'presencial' || tipo === 'mostrador' || tipo === 'mesa') {
    return tipo === 'mesa' ? 'mesas' : tipo;
  }

  return null;
}

export function canalModuloHabilitado(modo, modulosNegocio) {
  const flag = MODULO_POR_MODO[modo];
  if (!flag) return false;
  return modulosNegocio?.[flag] === true;
}

export function pedidoCanalHabilitado(pedido, modulosNegocio) {
  const modo = modoDashboardDesdeTipoPedido(pedido?.tipo);
  if (!modo) return false;
  return canalModuloHabilitado(modo, modulosNegocio);
}

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

export function pedidoEntregadoMostradorEnJornada(pedido, jornada) {
  if (!esPedidoMostrador(pedido) || pedido.deleted_at != null) {
    return false;
  }

  if (pedido.status !== 'entregado') {
    return false;
  }

  return pedidoPerteneceJornada(pedido, jornada);
}

export function pedidoCoincideFiltroMostrador(pedido, { jornada = null } = {}) {
  if (!esPedidoMostrador(pedido) || pedido.deleted_at != null) {
    return false;
  }

  if (pedidoPendienteEntregaMostrador(pedido)) {
    return true;
  }

  if (!jornada?.id) {
    return false;
  }

  return pedidoEntregadoMostradorEnJornada(pedido, jornada);
}

export function pedidoPresencialEnFechaCalendario(pedido, filtroFechaClave) {
  if (pedido?.tipo !== 'presencial' || pedido.deleted_at != null || !pedido.created_at) {
    return false;
  }

  return formatearClaveFecha(new Date(pedido.created_at)) === filtroFechaClave;
}

export function pedidoCoincideFiltroListaCaja(
  pedido,
  { filtroFechaClave, hoyClave, jornada = null }
) {
  if (pedido?.tipo !== 'presencial' || pedido.deleted_at != null) {
    return false;
  }

  if (filtroFechaClave !== hoyClave) {
    return pedidoPresencialEnFechaCalendario(pedido, filtroFechaClave);
  }

  if (!jornada?.id) {
    return false;
  }

  return pedidoPerteneceJornada(pedido, jornada);
}

export function filtrarPedidosListaCaja(pedidos, opciones) {
  return (pedidos || []).filter((pedido) => pedidoCoincideFiltroListaCaja(pedido, opciones));
}

export function pedidoCoincideFiltroMesaFolio(pedido, { numeroMesa, abiertaEn }) {
  return pedidoEsRondaMesaEnviada(pedido, { numeroMesa, abiertaEn });
}

export function aplicarFiltrosQueryMesaFolio(
  query,
  { numeroMesa, abiertaEn, jornadaId = null }
) {
  const abiertaEnDate = abiertaEn ? new Date(abiertaEn) : null;

  if (
    numeroMesa == null ||
    !abiertaEnDate ||
    Number.isNaN(abiertaEnDate.getTime())
  ) {
    return query.eq('tipo', 'mesa').eq('cliente', '__mesa_folio_sin_rango__');
  }

  let filtered = query
    .eq('tipo', 'mesa')
    .eq('cliente', clienteEtiquetaMesa(numeroMesa))
    .is('deleted_at', null)
    .gte('created_at', abiertaEnDate.toISOString());

  if (jornadaId) {
    filtered = filtered.or(`jornada_id.eq.${jornadaId},jornada_id.is.null`);
  }

  return filtered;
}

/** Fetch intencionalmente vacío (p. ej. jornada cerrada); evita filtros con ids imposibles. */
export function aplicarFiltrosQueryPedidosVacios(query) {
  return query.limit(0);
}

export function aplicarFiltrosQueryMostrador(query, { jornadaId = null } = {}) {
  const queryBase = query.eq('tipo', 'mostrador').is('deleted_at', null);

  if (!jornadaId) {
    return queryBase.neq('status', 'entregado');
  }

  return queryBase.or(
    `status.neq.entregado,and(status.eq.entregado,jornada_id.eq.${jornadaId})`
  );
}

export function aplicarFiltrosQueryListaCaja(
  query,
  { jornadaId = null, jornadaAbiertaEn = null, filtroFechaClave, hoyClave }
) {
  const querySinEliminados = query.is('deleted_at', null).eq('tipo', 'presencial');

  if (filtroFechaClave !== hoyClave) {
    const { inicio, fin } = obtenerRangoFechaClave(filtroFechaClave);
    return querySinEliminados
      .gte('created_at', inicio.toISOString())
      .lte('created_at', fin.toISOString());
  }

  if (!jornadaId) {
    return aplicarFiltrosQueryPedidosVacios(querySinEliminados);
  }

  if (jornadaAbiertaEn) {
    return querySinEliminados.or(
      `jornada_id.eq.${jornadaId},and(jornada_id.is.null,created_at.gte.${new Date(jornadaAbiertaEn).toISOString()})`
    );
  }

  return querySinEliminados.eq('jornada_id', jornadaId);
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

export function pedidoCoincideFiltroDashboardOperativo(
  pedido,
  { jornadaId = null, jornadaAbiertaEn = null, filtroFechaClave, hoyClave }
) {
  if (pedido?.deleted_at != null) {
    return false;
  }

  if (pedidoCoincideFiltroListaCaja(pedido, {
    filtroFechaClave,
    hoyClave,
    jornada: jornadaId ? { id: jornadaId, abierta_en: jornadaAbiertaEn } : null,
  })) {
    return true;
  }

  if (
    jornadaId &&
    pedidoPerteneceJornada(pedido, { id: jornadaId, abierta_en: jornadaAbiertaEn })
  ) {
    return true;
  }

  return false;
}

export function aplicarFiltrosQueryDashboardOperativo(
  query,
  { jornadaId = null, jornadaAbiertaEn = null, filtroFechaClave, hoyClave }
) {
  const { inicio, fin } = obtenerRangoFechaClave(filtroFechaClave);
  const base = query.is('deleted_at', null);

  if (filtroFechaClave !== hoyClave) {
    if (jornadaId) {
      return base.or(
        `jornada_id.eq.${jornadaId},and(tipo.eq.presencial,created_at.gte.${inicio.toISOString()},created_at.lte.${fin.toISOString()})`
      );
    }

    return base
      .eq('tipo', 'presencial')
      .gte('created_at', inicio.toISOString())
      .lte('created_at', fin.toISOString());
  }

  if (!jornadaId) {
    return aplicarFiltrosQueryPedidosVacios(base);
  }

  const presencialJornada = jornadaAbiertaEn
    ? `and(tipo.eq.presencial,or(jornada_id.eq.${jornadaId},and(jornada_id.is.null,created_at.gte.${new Date(jornadaAbiertaEn).toISOString()})))`
    : `and(tipo.eq.presencial,jornada_id.eq.${jornadaId})`;

  return base.or(`jornada_id.eq.${jornadaId},${presencialJornada}`);
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
