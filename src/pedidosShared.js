import {
  formatearLineaDetalleCocina,
  formatearLineaDetalleGuardada,
} from './productoUnidadVenta';

export const TIPOS_ENTREGA = {
  DOMICILIO: 'domicilio',
  SUCURSAL: 'sucursal',
};

export const COCINAS = {
  COCINA1: 'cocina1',
  COCINA2: 'cocina2',
  NINGUNA: 'ninguna',
};

export const COCINAS_OPCIONES = [
  { value: COCINAS.COCINA1, label: 'Cocina 1' },
  { value: COCINAS.COCINA2, label: 'Cocina 2' },
  { value: COCINAS.NINGUNA, label: 'Ninguna' },
];

export function normalizarCocinaProducto(cocina) {
  const valor = String(cocina ?? '').trim().toLowerCase();
  if (valor === COCINAS.COCINA2) return COCINAS.COCINA2;
  if (valor === COCINAS.NINGUNA) return COCINAS.NINGUNA;
  return COCINAS.COCINA1;
}

export function coincideCocina(cocinaA, cocinaB) {
  return normalizarCocinaProducto(cocinaA) === normalizarCocinaProducto(cocinaB);
}

export function enriquecerLineasDetalleCocina(pedido, productos = []) {
  if (!pedido?.lineas_detalle?.length || !productos?.length) {
    return pedido;
  }

  const lineas = pedido.lineas_detalle.map((linea) => {
    const producto = productos.find(
      (item) => String(item.id) === String(linea.productoId)
    );
    if (!producto) return linea;

    return {
      ...linea,
      cocina: normalizarCocinaProducto(producto.cocina),
    };
  });

  return { ...pedido, lineas_detalle: lineas };
}

export function etiquetaCocinaProducto(cocina) {
  const opcion = COCINAS_OPCIONES.find(
    (item) => item.value === normalizarCocinaProducto(cocina)
  );
  return opcion?.label || 'Cocina 1';
}

export function filtrarLineasDetallePorCocina(pedido, cocina) {
  if (!pedido?.lineas_detalle?.length) {
    if (cocina === COCINAS.COCINA1 && pedido?.producto?.trim()) {
      return [{ cantidad: 1, descripcion: pedido.producto, subtotal: pedido.total }];
    }
    return [];
  }

  return pedido.lineas_detalle.filter((linea) =>
    coincideCocina(linea.cocina, cocina)
  );
}

export const STATUS_COCINA = {
  EN_COCINA: 'en-cocina',
  LISTO: 'listo',
};

export function pedidoRequiereCocina(pedido, cocina) {
  return filtrarLineasDetallePorCocina(pedido, cocina).length > 0;
}

export function pedidoRequiereAlgunaCocina(pedido) {
  return (
    pedidoRequiereCocina(pedido, COCINAS.COCINA1) ||
    pedidoRequiereCocina(pedido, COCINAS.COCINA2)
  );
}

export function obtenerStatusCocinaPedido(pedido, cocina) {
  const campo = cocina === COCINAS.COCINA2 ? 'status_cocina2' : 'status_cocina1';
  const valor = pedido?.[campo];
  if (valor) return valor;

  if (pedido?.status === 'en-cocina' && pedidoRequiereCocina(pedido, cocina)) {
    return STATUS_COCINA.EN_COCINA;
  }

  if (pedido?.status === 'en-preparacion' && pedidoRequiereCocina(pedido, cocina)) {
    return STATUS_COCINA.EN_COCINA;
  }

  return null;
}

export function esStatusCocinaFinal(status) {
  return status === STATUS_COCINA.LISTO;
}

export function prepararStatusCocinasAlEntrar(pedido) {
  const req1 = pedidoRequiereCocina(pedido, COCINAS.COCINA1);
  const req2 = pedidoRequiereCocina(pedido, COCINAS.COCINA2);

  return {
    requiereAlgunaCocina: req1 || req2,
    status_cocina1: req1 ? STATUS_COCINA.EN_COCINA : null,
    status_cocina2: req2 ? STATUS_COCINA.EN_COCINA : null,
  };
}

export function todasCocinasRequeridasListas(pedido) {
  if (!pedidoRequiereAlgunaCocina(pedido)) return true;

  if (
    pedidoRequiereCocina(pedido, COCINAS.COCINA1) &&
    !esStatusCocinaFinal(obtenerStatusCocinaPedido(pedido, COCINAS.COCINA1))
  ) {
    return false;
  }

  if (
    pedidoRequiereCocina(pedido, COCINAS.COCINA2) &&
    !esStatusCocinaFinal(obtenerStatusCocinaPedido(pedido, COCINAS.COCINA2))
  ) {
    return false;
  }

  return true;
}

export function obtenerStatusGlobalTrasCocinas(tipoEntrega, tipoPedido = 'whatsapp') {
  if (tipoPedido === 'presencial' || tipoPedido === 'mesa') return 'entregado';
  if (tipoPedido === 'mostrador') return 'listo-para-recoger';

  return normalizarTipoEntrega(tipoEntrega) === TIPOS_ENTREGA.SUCURSAL
    ? 'listo-para-recoger'
    : 'enviado';
}

export function determinarStatusInicialPresencial() {
  return {
    status: 'entregado',
    status_cocina1: null,
    status_cocina2: null,
  };
}

export function construirUpdateAlMarcarCocinaLista(pedido, cocina) {
  const campo = cocina === COCINAS.COCINA2 ? 'status_cocina2' : 'status_cocina1';
  const statusActual = obtenerStatusCocinaPedido(pedido, cocina);

  if (statusActual !== STATUS_COCINA.EN_COCINA) return null;

  const pedidoActualizado = { ...pedido, [campo]: STATUS_COCINA.LISTO };
  const update = { [campo]: STATUS_COCINA.LISTO };

  if (
    ['en-cocina', 'en-preparacion'].includes(pedido.status) &&
    todasCocinasRequeridasListas(pedidoActualizado)
  ) {
    update.status = obtenerStatusGlobalTrasCocinas(
      pedido.tipo_entrega,
      pedido.tipo
    );
    if (pedido.tipo === 'mostrador') {
      update.mostrador_listo_at = new Date().toISOString();
    }
  }

  return update;
}

export function mergeStatusCocinasEnEdicion(pedidoAnterior, pedidoNuevo) {
  const cocinas = prepararStatusCocinasAlEntrar(pedidoNuevo);
  if (!cocinas.requiereAlgunaCocina) {
    return {
      requiereAlgunaCocina: false,
      status_cocina1: null,
      status_cocina2: null,
    };
  }

  const conservarOIniciar = (cocina, campo) => {
    if (!pedidoRequiereCocina(pedidoNuevo, cocina)) return null;
    if (
      pedidoAnterior.status === 'en-cocina' &&
      pedidoAnterior[campo] === STATUS_COCINA.LISTO
    ) {
      return STATUS_COCINA.LISTO;
    }
    return STATUS_COCINA.EN_COCINA;
  };

  return {
    requiereAlgunaCocina: true,
    status_cocina1: conservarOIniciar(COCINAS.COCINA1, 'status_cocina1'),
    status_cocina2: conservarOIniciar(COCINAS.COCINA2, 'status_cocina2'),
  };
}

export function payloadStatusCocinasParaStatusGlobal(pedido, statusGlobal) {
  if (statusGlobal === 'en-cocina') {
    const cocinas = prepararStatusCocinasAlEntrar(pedido);
    return {
      status_cocina1: cocinas.status_cocina1,
      status_cocina2: cocinas.status_cocina2,
    };
  }

  if (statusGlobal === 'por-aceptar') {
    return { status_cocina1: null, status_cocina2: null };
  }

  if (['listo-para-recoger', 'enviado', 'entregado'].includes(statusGlobal)) {
    const req1 = pedidoRequiereCocina(pedido, COCINAS.COCINA1);
    const req2 = pedidoRequiereCocina(pedido, COCINAS.COCINA2);
    return {
      status_cocina1: req1 ? STATUS_COCINA.LISTO : null,
      status_cocina2: req2 ? STATUS_COCINA.LISTO : null,
    };
  }

  return {};
}

export function construirPayloadAvancePedido(pedido) {
  const nuevoStatus = siguienteStatus(pedido.status, pedido.tipo_entrega);
  if (nuevoStatus === pedido.status) return null;

  const payload = {
    status: nuevoStatus,
    ...payloadStatusCocinasParaStatusGlobal(pedido, nuevoStatus),
  };

  if (nuevoStatus === 'en-cocina') {
    const cocinas = prepararStatusCocinasAlEntrar(pedido);
    if (!cocinas.requiereAlgunaCocina) {
      payload.status = obtenerStatusGlobalTrasCocinas(
        pedido.tipo_entrega,
        pedido.tipo
      );
      payload.status_cocina1 = null;
      payload.status_cocina2 = null;
    }
  }

  return payload;
}

export function construirPayloadRetrocesoPedido(pedido) {
  const nuevoStatus = anteriorStatus(pedido.status, pedido.tipo_entrega);
  if (nuevoStatus === pedido.status) return null;

  return {
    status: nuevoStatus,
    ...payloadStatusCocinasParaStatusGlobal(pedido, nuevoStatus),
  };
}

export function formatearProgresoCocinas(pedido) {
  const partes = [];

  if (pedidoRequiereCocina(pedido, COCINAS.COCINA1)) {
    const listo = esStatusCocinaFinal(
      obtenerStatusCocinaPedido(pedido, COCINAS.COCINA1)
    );
    partes.push(`Cocina 1: ${listo ? 'lista' : 'en preparación'}`);
  }

  if (pedidoRequiereCocina(pedido, COCINAS.COCINA2)) {
    const listo = esStatusCocinaFinal(
      obtenerStatusCocinaPedido(pedido, COCINAS.COCINA2)
    );
    partes.push(`Cocina 2: ${listo ? 'lista' : 'en preparación'}`);
  }

  return partes.join(' · ');
}

export function pedidoVisibleEnCocina(pedido, cocina, productos, mostradorFlujoCocina = 0) {
  if (pedido?.tipo === 'presencial') return false;

  if (esPedidoMostrador(pedido)) {
    if (mostradorFlujoCocina === 0) return false;
    if (pedido.status === 'entregado') return false;

    if (
      mostradorFlujoCocina === 3 &&
      pedido.status === 'listo-para-recoger'
    ) {
      if (Array.isArray(productos) && productos.length === 0) return true;
      return pedidoRequiereCocina(pedido, cocina);
    }

    if (!['en-cocina', 'en-preparacion'].includes(pedido?.status)) return false;
    if (Array.isArray(productos) && productos.length === 0) {
      return true;
    }
    if (!pedidoRequiereCocina(pedido, cocina)) return false;
    return obtenerStatusCocinaPedido(pedido, cocina) === STATUS_COCINA.EN_COCINA;
  }

  if (!['en-cocina'].includes(pedido?.status)) return false;
  if (Array.isArray(productos) && productos.length === 0) {
    return true;
  }
  if (!pedidoRequiereCocina(pedido, cocina)) return false;
  return obtenerStatusCocinaPedido(pedido, cocina) === STATUS_COCINA.EN_COCINA;
}

export const STATUS_FLOW_DOMICILIO = ['por-aceptar', 'en-cocina', 'enviado', 'entregado'];
export const STATUS_FLOW_SUCURSAL = [
  'por-aceptar',
  'en-cocina',
  'listo-para-recoger',
  'entregado',
];

export function normalizarTipoEntrega(tipoEntrega) {
  return tipoEntrega === TIPOS_ENTREGA.SUCURSAL
    ? TIPOS_ENTREGA.SUCURSAL
    : TIPOS_ENTREGA.DOMICILIO;
}

export function obtenerFlujoStatus(tipoEntrega) {
  return normalizarTipoEntrega(tipoEntrega) === TIPOS_ENTREGA.SUCURSAL
    ? STATUS_FLOW_SUCURSAL
    : STATUS_FLOW_DOMICILIO;
}

export function siguienteStatus(status, tipoEntrega = TIPOS_ENTREGA.DOMICILIO) {
  const flujo = obtenerFlujoStatus(tipoEntrega);
  const indice = flujo.indexOf(status);
  if (indice === -1 || indice === flujo.length - 1) return status;
  return flujo[indice + 1];
}

export function anteriorStatus(status, tipoEntrega = TIPOS_ENTREGA.DOMICILIO) {
  const flujo = obtenerFlujoStatus(tipoEntrega);
  const indice = flujo.indexOf(status);
  if (indice <= 0) return status;
  return flujo[indice - 1];
}

export function normalizarTelefonoWhatsApp(telefono) {
  if (!telefono) return '';
  const digits = String(telefono).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `52${digits}`;
  return digits;
}

export function construirUrlWhatsApp(telefono, mensaje = '') {
  const numero = normalizarTelefonoWhatsApp(telefono);
  if (!numero) return null;
  if (!mensaje) return `https://wa.me/${numero}`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}

export function esPedidoWhatsapp(pedido) {
  return !pedido.tipo || pedido.tipo === 'whatsapp';
}

export function esPedidoMostrador(pedido) {
  return pedido?.tipo === 'mostrador';
}

export function esPedidoMesa(pedido) {
  return pedido?.tipo === 'mesa';
}

export const ETIQUETA_CANAL_MOSTRADOR = 'Mostrador';

export const STATUS_MOSTRADOR_LABELS = {
  'en-cocina': 'En cocina',
  'en-preparacion': 'En preparación',
  'listo-para-recoger': 'Listo para entregar',
  entregado: 'Entregado',
};

export function etiquetaStatusMostrador(status) {
  return STATUS_MOSTRADOR_LABELS[status] || status || '—';
}

export function resolverEstadoMostradorPendiente(pedido) {
  if (!esPedidoMostrador(pedido)) {
    return pedido?.status ?? null;
  }

  const status = pedido?.status;

  if (
    ['en-cocina', 'en-preparacion'].includes(status) &&
    pedidoRequiereAlgunaCocina(pedido) &&
    todasCocinasRequeridasListas(pedido)
  ) {
    return 'listo-para-recoger';
  }

  return status;
}

export function pedidoPendienteEntregaMostrador(pedido) {
  return (
    esPedidoMostrador(pedido) &&
    pedido.deleted_at == null &&
    pedido.status !== 'entregado'
  );
}

export function determinarStatusInicialMostrador(mostradorFlujoCocina, pedidoEnriquecido) {
  const ahora = new Date().toISOString();

  if (mostradorFlujoCocina === 0) {
    return {
      status: 'listo-para-recoger',
      status_cocina1: null,
      status_cocina2: null,
      mostrador_listo_at: ahora,
      mostrador_en_preparacion_at: null,
      mostrador_entregado_at: null,
    };
  }

  const cocinas = prepararStatusCocinasAlEntrar(pedidoEnriquecido);

  return {
    status: cocinas.requiereAlgunaCocina ? 'en-cocina' : 'listo-para-recoger',
    status_cocina1: cocinas.status_cocina1,
    status_cocina2: cocinas.status_cocina2,
    mostrador_listo_at: cocinas.requiereAlgunaCocina ? null : ahora,
    mostrador_en_preparacion_at: null,
    mostrador_entregado_at: null,
  };
}

export function construirUpdateMostradorEnPreparacion(pedido) {
  if (!esPedidoMostrador(pedido) || pedido.status !== 'en-cocina') {
    return null;
  }

  return {
    status: 'en-preparacion',
    mostrador_en_preparacion_at: new Date().toISOString(),
  };
}

export function construirUpdateMostradorEntregado(pedido) {
  if (!esPedidoMostrador(pedido) || pedido.status !== 'listo-para-recoger') {
    return null;
  }

  return {
    status: 'entregado',
    mostrador_entregado_at: new Date().toISOString(),
  };
}

export function construirUpdateEntregadoMostradorPendientes(pedido) {
  if (!pedidoPendienteEntregaMostrador(pedido)) {
    return null;
  }

  return {
    status: 'entregado',
    mostrador_entregado_at: new Date().toISOString(),
  };
}

export function botonesMostradorCocina(mostradorFlujoCocina, pedido) {
  if (!esPedidoMostrador(pedido) || mostradorFlujoCocina === 0) {
    return { enPreparacion: false, listo: false, entregado: false };
  }

  const enCocina = pedido.status === 'en-cocina';
  const enPreparacion = pedido.status === 'en-preparacion';
  const listoParaEntregar = pedido.status === 'listo-para-recoger';

  return {
    enPreparacion: mostradorFlujoCocina >= 2 && enCocina,
    listo:
      mostradorFlujoCocina >= 1 &&
      (enCocina || enPreparacion),
    entregado: mostradorFlujoCocina === 3 && listoParaEntregar,
  };
}

export function pedidoVisibleEnCocinaColumnaIzquierda(pedido) {
  return esPedidoMesa(pedido);
}

export function pedidoVisibleEnCocinaColumnaDerecha(pedido, mostradorFlujoCocina) {
  if (esPedidoWhatsapp(pedido)) return true;
  if (esPedidoMostrador(pedido)) return mostradorFlujoCocina > 0;
  return false;
}

export function etiquetaCanalEntregaCocina(tipoEntrega) {
  return normalizarTipoEntrega(tipoEntrega) === TIPOS_ENTREGA.SUCURSAL
    ? 'Para recoger'
    : 'Domicilio';
}

export function formatearFechaHoraCocina(createdAt) {
  if (!createdAt) return '—';

  return new Date(createdAt).toLocaleString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function clienteEtiquetaMesa(numeroMesa) {
  return `Mesa ${numeroMesa}`;
}

export function extraerNumeroRondaMesa(referencia) {
  const coincidencia = String(referencia ?? '').match(/Ronda\s+(\d+)/i);
  return coincidencia ? Number(coincidencia[1]) : null;
}

export function pedidoEsRondaMesaEnviada(pedido, { numeroMesa, abiertaEn }) {
  if (!pedido || pedido.tipo !== 'mesa' || pedido.deleted_at != null) {
    return false;
  }

  if (pedido.cliente !== clienteEtiquetaMesa(numeroMesa)) {
    return false;
  }

  if (!abiertaEn) {
    return false;
  }

  return new Date(pedido.created_at || 0) >= new Date(abiertaEn);
}

export function resolverNombreCapturaPedido(pedido, nombresPorId = {}) {
  const creadorId = pedido?.created_by;
  if (!creadorId) return null;

  return nombresPorId[String(creadorId)] ?? null;
}

function redondearMoneda(valor) {
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}

export function formatearImporte(valor) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(redondearMoneda(Number(valor) || 0));
}

export function formatearMoneda(valor) {
  return `$${formatearImporte(valor)}`;
}

export function DesgloseProductosPedido({
  pedido,
  mostrarTotal = true,
  filtrarCocina = null,
  sinPrecio = false,
}) {
  if (pedido?.lineas_detalle?.length) {
    const lineas = filtrarCocina
      ? filtrarLineasDetallePorCocina(pedido, filtrarCocina)
      : pedido.lineas_detalle;

    if (lineas.length === 0) return null;

    const total = redondearMoneda(
      lineas.reduce((suma, linea) => suma + Number(linea.subtotal || 0), 0)
    );

    return (
      <div className="pedido-desglose">
        {lineas.map((linea, index) => {
          const textoPeso = sinPrecio
            ? formatearLineaDetalleCocina(linea)
            : formatearLineaDetalleGuardada(linea);

          if (textoPeso) {
            return (
              <div key={index} className="pedido-desglose-linea pedido-desglose-linea-peso">
                <span className="pedido-desglose-nombre">{textoPeso}</span>
              </div>
            );
          }

          return (
            <div key={index} className="pedido-desglose-linea">
              <span
                className="pedido-desglose-cantidad"
                aria-label={`Cantidad: ${linea.cantidad}`}
              >
                {linea.cantidad}
              </span>
              <div className="pedido-desglose-detalle">
                <span className="pedido-desglose-nombre">{linea.descripcion}</span>
              </div>
            </div>
          );
        })}
        {mostrarTotal && (
          <p className="pedido-desglose-total">Total: {formatearMoneda(total)}</p>
        )}
      </div>
    );
  }

  if (filtrarCocina && filtrarCocina !== COCINAS.COCINA1) {
    return null;
  }

  if (!pedido?.producto?.trim()) {
    return null;
  }

  return (
    <div className="pedido-desglose">
      <p className="pedido-desglose-nombre">{pedido.producto}</p>
      {mostrarTotal && (
        <p className="pedido-desglose-total">
          Total: {formatearMoneda(pedido.total)}
        </p>
      )}
    </div>
  );
}
