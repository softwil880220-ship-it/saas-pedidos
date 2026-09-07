import { normalizarMeridianoHoraEs, pedidoPerteneceJornada } from './jornadaHelpers';
import {
  STATUS_PENDIENTE_REPARTIDOR,
  TIPOS_ENTREGA,
  construirPayloadAvancePedido,
  construirPayloadRetrocesoPedido,
  esPedidoWhatsapp,
  normalizarTipoEntrega,
  payloadStatusCocinasParaStatusGlobal,
} from './pedidosShared';

export const TABS_RECOGER_DOMICILIO = [
  { value: 'nuevo', label: 'Nuevo pedido' },
  { value: 'cocina', label: 'En cocina' },
  { value: 'pendientes', label: 'Pendientes de entrega' },
  { value: 'entregados', label: 'Entregados hoy' },
];

export const MIN_BUSQUEDA_RECOGER_DOMICILIO = 3;

export const FILTRO_TIPO_ENTREGA = {
  TODOS: 'todos',
  DOMICILIO: TIPOS_ENTREGA.DOMICILIO,
  SUCURSAL: TIPOS_ENTREGA.SUCURSAL,
};

export const SUBTABS_FILTRO_TIPO_ENTREGA = [
  { value: FILTRO_TIPO_ENTREGA.TODOS, label: 'Todos' },
  { value: FILTRO_TIPO_ENTREGA.SUCURSAL, label: 'Recoger en sucursal' },
  { value: FILTRO_TIPO_ENTREGA.DOMICILIO, label: 'A domicilio' },
];

export const SECCIONES_PENDIENTES_ENTREGA = [
  {
    id: 'listo-para-recoger',
    titulo: 'Listo para recoger',
    tiposEntrega: [TIPOS_ENTREGA.SUCURSAL],
    status: 'listo-para-recoger',
  },
  {
    id: 'pendiente-repartidor',
    titulo: 'Esperando repartidor',
    tiposEntrega: [TIPOS_ENTREGA.DOMICILIO],
    status: STATUS_PENDIENTE_REPARTIDOR,
  },
  {
    id: 'enviado',
    titulo: 'Enviado',
    tiposEntrega: [TIPOS_ENTREGA.DOMICILIO],
    status: 'enviado',
  },
];

export const SECCIONES_ENTREGADOS_POR_TIPO = [
  {
    id: TIPOS_ENTREGA.SUCURSAL,
    titulo: 'Recoger en sucursal',
    tipoEntrega: TIPOS_ENTREGA.SUCURSAL,
  },
  {
    id: TIPOS_ENTREGA.DOMICILIO,
    titulo: 'A domicilio',
    tipoEntrega: TIPOS_ENTREGA.DOMICILIO,
  },
];

export const TIPOS_ENTREGA_OPCIONES = [
  { value: TIPOS_ENTREGA.DOMICILIO, label: 'A domicilio', icono: '🛵' },
  { value: TIPOS_ENTREGA.SUCURSAL, label: 'Recoger en sucursal', icono: '🏪' },
];

export const REPARTIDOR_EXTERNO_ID = '__externo__';

export function formatearTipoEntregaPedido(tipoEntrega) {
  const opcion = TIPOS_ENTREGA_OPCIONES.find(
    (item) => item.value === normalizarTipoEntrega(tipoEntrega)
  );
  return opcion ? `${opcion.icono} ${opcion.label}` : '🛵 A domicilio';
}

export function pedidoRecogerDomicilioOperativo(pedido) {
  return esPedidoWhatsapp(pedido) && pedido?.deleted_at == null;
}

export function pedidoRecogerDomicilioEnJornada(pedido, jornada) {
  return pedidoRecogerDomicilioOperativo(pedido) && pedidoPerteneceJornada(pedido, jornada);
}

export function pedidoRecogerDomicilioEnCocina(pedido) {
  return (
    pedidoRecogerDomicilioOperativo(pedido) &&
    (pedido.status === 'por-aceptar' || pedido.status === 'en-cocina')
  );
}

export function pedidoRecogerDomicilioPendienteEntrega(pedido) {
  if (!pedidoRecogerDomicilioOperativo(pedido)) return false;

  const tipoEntrega = normalizarTipoEntrega(pedido.tipo_entrega);

  if (tipoEntrega === TIPOS_ENTREGA.SUCURSAL) {
    return pedido.status === 'listo-para-recoger';
  }

  return (
    pedido.status === STATUS_PENDIENTE_REPARTIDOR || pedido.status === 'enviado'
  );
}

export function pedidoRecogerDomicilioEntregadoJornada(pedido, jornada) {
  return (
    pedidoRecogerDomicilioOperativo(pedido) &&
    pedido.status === 'entregado' &&
    pedidoPerteneceJornada(pedido, jornada)
  );
}

export function tabRecogerDomicilioParaPedido(pedido) {
  if (!pedidoRecogerDomicilioOperativo(pedido)) return null;
  if (pedidoRecogerDomicilioEnCocina(pedido)) return 'cocina';
  if (pedidoRecogerDomicilioPendienteEntrega(pedido)) return 'pendientes';
  if (pedido.status === 'entregado') return 'entregados';
  return null;
}

export function filtroTipoEntregaParaPedido(pedido) {
  return normalizarTipoEntrega(pedido?.tipo_entrega);
}

export function navegacionRecogerDomicilioParaPedido(pedido) {
  const tab = tabRecogerDomicilioParaPedido(pedido);
  if (!tab) return null;

  return {
    tab,
    filtroTipoEntrega: filtroTipoEntregaParaPedido(pedido),
  };
}

export function filtrarPedidosRecogerDomicilioPorTipoEntrega(pedidos, filtroTipo) {
  if (!filtroTipo || filtroTipo === FILTRO_TIPO_ENTREGA.TODOS) {
    return [...(pedidos || [])];
  }

  return (pedidos || []).filter(
    (pedido) => filtroTipoEntregaParaPedido(pedido) === filtroTipo
  );
}

export function contarPedidosPorFiltroTipoEntrega(pedidos) {
  const lista = pedidos || [];

  return {
    todos: lista.length,
    [TIPOS_ENTREGA.DOMICILIO]: lista.filter(
      (pedido) => filtroTipoEntregaParaPedido(pedido) === TIPOS_ENTREGA.DOMICILIO
    ).length,
    [TIPOS_ENTREGA.SUCURSAL]: lista.filter(
      (pedido) => filtroTipoEntregaParaPedido(pedido) === TIPOS_ENTREGA.SUCURSAL
    ).length,
  };
}

export function seccionesPendientesEntregaVisibles(filtroTipo) {
  if (filtroTipo === FILTRO_TIPO_ENTREGA.DOMICILIO) {
    return SECCIONES_PENDIENTES_ENTREGA.filter((seccion) =>
      seccion.tiposEntrega.includes(TIPOS_ENTREGA.DOMICILIO)
    );
  }

  if (filtroTipo === FILTRO_TIPO_ENTREGA.SUCURSAL) {
    return SECCIONES_PENDIENTES_ENTREGA.filter((seccion) =>
      seccion.tiposEntrega.includes(TIPOS_ENTREGA.SUCURSAL)
    );
  }

  return SECCIONES_PENDIENTES_ENTREGA;
}

export function agruparPedidosPendientesEntregaPorSeccion(
  pedidos,
  filtroTipo = FILTRO_TIPO_ENTREGA.TODOS
) {
  const filtrados = filtrarPedidosRecogerDomicilioPorTipoEntrega(pedidos, filtroTipo);

  return seccionesPendientesEntregaVisibles(filtroTipo)
    .map((definicion) => ({
      id: definicion.id,
      titulo: definicion.titulo,
      pedidos: filtrados.filter(
        (pedido) =>
          definicion.tiposEntrega.includes(filtroTipoEntregaParaPedido(pedido)) &&
          pedido.status === definicion.status
      ),
    }))
    .filter((seccion) => {
      if (filtroTipo === FILTRO_TIPO_ENTREGA.TODOS) {
        return seccion.pedidos.length > 0;
      }

      return true;
    });
}

export function agruparPedidosEntregadosPorTipoEntrega(pedidos) {
  return SECCIONES_ENTREGADOS_POR_TIPO.map((definicion) => ({
    id: definicion.id,
    titulo: definicion.titulo,
    pedidos: (pedidos || []).filter(
      (pedido) => filtroTipoEntregaParaPedido(pedido) === definicion.tipoEntrega
    ),
  })).filter((seccion) => seccion.pedidos.length > 0);
}

export function pedidoCoincideBusquedaRecogerDomicilio(pedido, query) {
  const termino = String(query ?? '').trim().toLowerCase();
  if (termino.length < MIN_BUSQUEDA_RECOGER_DOMICILIO) return false;
  if (!pedidoRecogerDomicilioOperativo(pedido)) return false;

  const cliente = String(pedido.cliente ?? '').toLowerCase();
  const telefono = String(pedido.telefono ?? '').replace(/\D/g, '');
  const terminoTelefono = termino.replace(/\D/g, '');

  if (cliente.includes(termino)) return true;
  if (terminoTelefono && telefono.includes(terminoTelefono)) return true;

  return false;
}

export function pedidoEsperandoRepartidor(pedido) {
  return (
    pedidoRecogerDomicilioOperativo(pedido) &&
    normalizarTipoEntrega(pedido.tipo_entrega) === TIPOS_ENTREGA.DOMICILIO &&
    pedido.status === STATUS_PENDIENTE_REPARTIDOR
  );
}

export function puedeRetrocederPedidoRecogerDomicilio(pedido) {
  const status = pedido?.status;
  const tipoEntrega = normalizarTipoEntrega(pedido?.tipo_entrega);

  if (tipoEntrega === TIPOS_ENTREGA.SUCURSAL) {
    return (
      status === 'en-cocina' ||
      status === 'listo-para-recoger' ||
      status === 'entregado'
    );
  }

  return (
    status === 'en-cocina' ||
    status === STATUS_PENDIENTE_REPARTIDOR ||
    status === 'enviado' ||
    status === 'entregado'
  );
}

export function mostrarContactoWhatsAppPedidoRecogerDomicilio(pedido) {
  const status = pedido?.status;
  const tipoEntrega = normalizarTipoEntrega(pedido?.tipo_entrega);

  if (tipoEntrega === TIPOS_ENTREGA.SUCURSAL) {
    return status === 'por-aceptar' || status === 'listo-para-recoger';
  }

  return (
    status === 'por-aceptar' ||
    status === STATUS_PENDIENTE_REPARTIDOR ||
    status === 'enviado'
  );
}

export function esStatusFinalPedidoRecogerDomicilio(pedido) {
  return pedido?.status === 'entregado';
}

export function seleccionRepartidorEsValida({ repartidorUsuarioId, repartidorExterno }) {
  if (repartidorExterno) return true;
  return Boolean(repartidorUsuarioId);
}

export function construirPayloadAsignacionRepartidor(
  pedido,
  { repartidorUsuarioId, repartidorExterno }
) {
  if (!pedidoEsperandoRepartidor(pedido)) return null;
  if (!seleccionRepartidorEsValida({ repartidorUsuarioId, repartidorExterno })) {
    return null;
  }

  return {
    status: 'enviado',
    repartidor_usuario_id: repartidorExterno ? null : repartidorUsuarioId,
    repartidor_externo: Boolean(repartidorExterno),
    repartidor_asignado_en: new Date().toISOString(),
    ...payloadStatusCocinasParaStatusGlobal(pedido, 'enviado'),
  };
}

export function construirPayloadAvancePedidoRecogerDomicilio(pedido) {
  const payload = construirPayloadAvancePedido(pedido);
  if (!payload) return null;

  if (payload.status === 'entregado' && !pedido?.entregado_en) {
    return {
      ...payload,
      entregado_en: new Date().toISOString(),
    };
  }

  return payload;
}

export function construirPayloadRetrocesoPedidoRecogerDomicilio(pedido) {
  const payload = construirPayloadRetrocesoPedido(pedido);
  if (!payload) return null;

  if (payload.status === STATUS_PENDIENTE_REPARTIDOR) {
    return {
      ...payload,
      repartidor_usuario_id: null,
      repartidor_externo: false,
    };
  }

  return payload;
}

export function compararPedidosRecogerDomicilioDesc(a, b) {
  return new Date(b.created_at || 0) - new Date(a.created_at || 0);
}

export function ordenarPedidosRecogerDomicilioDesc(pedidos) {
  return [...(pedidos || [])].sort(compararPedidosRecogerDomicilioDesc);
}

export function crearIdOptimisticoPedidoRecogerDomicilio() {
  return `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function tipoEntregaRecogerDomicilioSeleccionado(tipoEntrega) {
  return (
    tipoEntrega === TIPOS_ENTREGA.DOMICILIO || tipoEntrega === TIPOS_ENTREGA.SUCURSAL
  );
}

export function formatearNombreClientePedidoRecoger(pedido) {
  return pedido?.cliente?.trim() || 'Sin nombre';
}

const MENSAJES_WHATSAPP_PEDIDO = {
  'por-aceptar': (nombre) =>
    `Hola ${nombre}, recibimos tu pedido. En breve te confirmamos ✅`,
  'en-cocina': (nombre) => `Hola ${nombre}, tu pedido está en preparación 👨‍🍳`,
  [STATUS_PENDIENTE_REPARTIDOR]: (nombre) =>
    `Hola ${nombre}, tu pedido está listo y pronto saldrá a domicilio 🛵`,
  enviado: (nombre) => `Hola ${nombre}, tu pedido ya va en camino 🛵`,
  entregado: (nombre) => `Hola ${nombre}, tu pedido fue entregado. ¡Gracias! 🙏`,
  'listo-para-recoger': (nombre) =>
    `Hola ${nombre}, tu pedido está listo para recoger en sucursal 🏪`,
};

export function obtenerMensajeWhatsAppPedidoRecoger(pedido) {
  const nombre = pedido?.cliente?.trim() || 'cliente';
  const plantilla = MENSAJES_WHATSAPP_PEDIDO[pedido?.status];

  if (!plantilla) return `Hola ${nombre}`;

  return plantilla(nombre);
}

export function formatearHoraPedidoRecoger(createdAt) {
  if (!createdAt) return '';

  const fecha = new Date(createdAt);
  return normalizarMeridianoHoraEs(
    fecha.toLocaleTimeString('es-MX', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  );
}

const FORMAS_PAGO_VALIDAS = new Set(['efectivo', 'tarjeta', 'transferencia', 'link_pago']);

export function normalizarFormaPagoRecogerDomicilio(valor) {
  const forma = String(valor ?? '').trim();
  if (!forma) return null;
  return FORMAS_PAGO_VALIDAS.has(forma) ? forma : null;
}

export function filtrarPedidosRecogerDomicilioPorTab(pedidos, tab, jornada) {
  const enJornada = (pedidos || []).filter((pedido) =>
    pedidoRecogerDomicilioEnJornada(pedido, jornada)
  );

  if (tab === 'cocina') {
    return enJornada.filter(pedidoRecogerDomicilioEnCocina);
  }

  if (tab === 'pendientes') {
    return enJornada.filter(pedidoRecogerDomicilioPendienteEntrega);
  }

  if (tab === 'entregados') {
    return enJornada.filter((pedido) =>
      pedidoRecogerDomicilioEntregadoJornada(pedido, jornada)
    );
  }

  return [];
}
