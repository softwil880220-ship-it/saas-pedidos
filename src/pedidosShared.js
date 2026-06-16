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
  if (cocina === COCINAS.COCINA2) return COCINAS.COCINA2;
  if (cocina === COCINAS.NINGUNA) return COCINAS.NINGUNA;
  return COCINAS.COCINA1;
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

  return pedido.lineas_detalle.filter(
    (linea) => normalizarCocinaProducto(linea.cocina) === cocina
  );
}

export function pedidoVisibleEnCocina(pedido, cocina) {
  if (!esPedidoWhatsapp(pedido) || pedido.status !== 'en-cocina') return false;
  return filtrarLineasDetallePorCocina(pedido, cocina).length > 0;
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
