import {
  COCINAS,
  enriquecerLineasDetalleCocina,
  esStatusCocinaFinal,
  normalizarCocinaProducto,
  obtenerStatusCocinaPedido,
} from './pedidosShared';

export const ESTADO_LINEA_MESA = {
  EN_COCINA: 'en-cocina',
  LISTO_PARA_SERVIR: 'listo-para-servir',
};

export const ETIQUETAS_ESTADO_LINEA_MESA = {
  [ESTADO_LINEA_MESA.EN_COCINA]: 'En cocina',
  [ESTADO_LINEA_MESA.LISTO_PARA_SERVIR]: 'Listo',
};

export function etiquetaEstadoLineaRondaMesa(estado) {
  return ETIQUETAS_ESTADO_LINEA_MESA[estado] || estado || '—';
}

export function resolverEstadoLineaRondaMesa(linea, pedido) {
  const cocina = normalizarCocinaProducto(linea?.cocina);

  if (cocina === COCINAS.NINGUNA || pedido?.status === 'entregado') {
    return ESTADO_LINEA_MESA.LISTO_PARA_SERVIR;
  }

  const statusCocina = obtenerStatusCocinaPedido(pedido, cocina);

  if (esStatusCocinaFinal(statusCocina)) {
    return ESTADO_LINEA_MESA.LISTO_PARA_SERVIR;
  }

  return ESTADO_LINEA_MESA.EN_COCINA;
}

export function enriquecerRondaMesaParaMesero(pedido, productos) {
  return enriquecerLineasDetalleCocina(pedido, productos);
}

export function obtenerLineasRondaMesaConEstado(pedido, productos) {
  const pedidoEnriquecido = enriquecerRondaMesaParaMesero(pedido, productos);

  if (pedidoEnriquecido?.lineas_detalle?.length) {
    return pedidoEnriquecido.lineas_detalle.map((linea) => ({
      linea,
      estado: resolverEstadoLineaRondaMesa(linea, pedidoEnriquecido),
    }));
  }

  if (!pedido?.producto?.trim()) {
    return [];
  }

  return [
    {
      linea: { cantidad: 1, descripcion: pedido.producto },
      estado: ESTADO_LINEA_MESA.LISTO_PARA_SERVIR,
    },
  ];
}
