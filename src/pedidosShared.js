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

export function obtenerStatusGlobalTrasCocinas(tipoEntrega) {
  return normalizarTipoEntrega(tipoEntrega) === TIPOS_ENTREGA.SUCURSAL
    ? 'listo-para-recoger'
    : 'enviado';
}

export function construirUpdateAlMarcarCocinaLista(pedido, cocina) {
  const campo = cocina === COCINAS.COCINA2 ? 'status_cocina2' : 'status_cocina1';
  const statusActual = obtenerStatusCocinaPedido(pedido, cocina);

  if (statusActual !== STATUS_COCINA.EN_COCINA) return null;

  const pedidoActualizado = { ...pedido, [campo]: STATUS_COCINA.LISTO };
  const update = { [campo]: STATUS_COCINA.LISTO };

  if (
    pedido.status === 'en-cocina' &&
    todasCocinasRequeridasListas(pedidoActualizado)
  ) {
    update.status = obtenerStatusGlobalTrasCocinas(pedido.tipo_entrega);
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
  if (pedido.status === 'en-cocina') return null;

  const nuevoStatus = siguienteStatus(pedido.status, pedido.tipo_entrega);
  if (nuevoStatus === pedido.status) return null;

  const payload = {
    status: nuevoStatus,
    ...payloadStatusCocinasParaStatusGlobal(pedido, nuevoStatus),
  };

  if (nuevoStatus === 'en-cocina') {
    const cocinas = prepararStatusCocinasAlEntrar(pedido);
    if (!cocinas.requiereAlgunaCocina) {
      payload.status = obtenerStatusGlobalTrasCocinas(pedido.tipo_entrega);
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

export function pedidoVisibleEnCocina(pedido, cocina) {
  if (!esPedidoWhatsapp(pedido) || pedido.status !== 'en-cocina') return false;
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

export function esPedidoWhatsapp(pedido) {
  return !pedido.tipo || pedido.tipo === 'whatsapp';
}

export function DesgloseProductosPedido({ pedido, mostrarTotal = true, filtrarCocina = null }) {
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
        {lineas.map((linea, index) => (
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
        ))}
        {mostrarTotal && (
          <p className="pedido-desglose-total">Total: ${total.toFixed(2)}</p>
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
          Total: ${Number(pedido.total).toFixed(2)}
        </p>
      )}
    </div>
  );
}

function redondearMoneda(valor) {
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}
