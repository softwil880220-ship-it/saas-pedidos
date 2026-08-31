import { pedidoPerteneceJornada } from './jornadaHelpers';
import {
  TIPOS_ENTREGA,
  esPedidoWhatsapp,
  normalizarTipoEntrega,
} from './pedidosShared';

export const TABS_REPARTIDOR = [
  { value: 'por-entregar', label: 'Por entregar' },
  { value: 'entregados', label: 'Entregados' },
];

const ROLES_VEN_TODOS_PROPIOS = new Set(['dueno', 'administrador']);

const ETIQUETAS_FORMA_PAGO = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  link_pago: 'Link de pago',
};

export function pedidoEsDomicilioRepartidor(pedido) {
  return (
    esPedidoWhatsapp(pedido) &&
    normalizarTipoEntrega(pedido?.tipo_entrega) === TIPOS_ENTREGA.DOMICILIO
  );
}

export function pedidoRepartidorExterno(pedido) {
  return pedido?.repartidor_externo === true;
}

export function pedidoLegacySinRepartidorAsignado(pedido) {
  return pedido?.repartidor_usuario_id == null && !pedidoRepartidorExterno(pedido);
}

export function pedidoElegibleVistaRepartidor(pedido) {
  if (!pedidoEsDomicilioRepartidor(pedido)) return false;
  if (pedidoRepartidorExterno(pedido)) return false;
  return true;
}

export function pedidoVisibleRepartidorPorRol(pedido, { usuarioId, rol }) {
  if (!pedidoElegibleVistaRepartidor(pedido)) return false;

  if (pedidoLegacySinRepartidorAsignado(pedido)) {
    return true;
  }

  if (ROLES_VEN_TODOS_PROPIOS.has(rol)) {
    return true;
  }

  return pedido.repartidor_usuario_id === usuarioId;
}

export function pedidoEntregadoEnJornadaRepartidor(pedido, jornada) {
  if (!jornada?.abierta_en) return false;

  if (pedido?.entregado_en) {
    const entregado = new Date(pedido.entregado_en);
    const desde = new Date(jornada.abierta_en);
    const hasta = jornada.cerrada_en ? new Date(jornada.cerrada_en) : new Date();

    if (Number.isFinite(entregado.getTime()) && entregado >= desde && entregado <= hasta) {
      return true;
    }
  }

  return pedidoPerteneceJornada(pedido, jornada);
}

export function pedidoPorEntregarRepartidor(pedido, contexto) {
  return pedido?.status === 'enviado' && pedidoVisibleRepartidorPorRol(pedido, contexto);
}

export function pedidoEntregadoRepartidor(pedido, jornada, contexto) {
  return (
    pedido?.status === 'entregado' &&
    pedidoVisibleRepartidorPorRol(pedido, contexto) &&
    pedidoEntregadoEnJornadaRepartidor(pedido, jornada)
  );
}

export function filtrarPedidosRepartidorRealtime(pedido) {
  if (!pedidoElegibleVistaRepartidor(pedido)) return false;
  return pedido.status === 'enviado' || pedido.status === 'entregado';
}

export function filtrarPedidosRepartidorPorTab(pedidos, tab, jornada, contexto) {
  if (tab === 'por-entregar') {
    return (pedidos || []).filter((pedido) => pedidoPorEntregarRepartidor(pedido, contexto));
  }

  if (tab === 'entregados') {
    if (!jornada?.id) return [];
    return (pedidos || []).filter((pedido) =>
      pedidoEntregadoRepartidor(pedido, jornada, contexto)
    );
  }

  return [];
}

export function resumenEntregadosRepartidor(pedidos) {
  const cantidad = (pedidos || []).length;
  const suma = (pedidos || []).reduce((acc, pedido) => acc + (Number(pedido.total) || 0), 0);
  return { cantidad, suma };
}

export function concentradoCobrosPorFormaPago(pedidos) {
  const totales = {};
  const conteos = {};

  for (const pedido of pedidos || []) {
    const forma = String(pedido?.forma_pago ?? '').trim() || 'sin_especificar';
    const monto = Number(pedido?.total) || 0;
    totales[forma] = (totales[forma] || 0) + monto;
    conteos[forma] = (conteos[forma] || 0) + 1;
  }

  return Object.entries(totales)
    .filter(([, total]) => total > 0)
    .map(([forma, total]) => ({
      forma,
      etiqueta: ETIQUETAS_FORMA_PAGO[forma] || 'Sin especificar',
      total,
      cantidad: conteos[forma] || 0,
    }))
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'));
}

export function etiquetaFormaPagoRepartidor(valor) {
  const forma = String(valor ?? '').trim();
  return ETIQUETAS_FORMA_PAGO[forma] || null;
}
