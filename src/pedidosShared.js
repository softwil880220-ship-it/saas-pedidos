export const TIPOS_ENTREGA = {
  DOMICILIO: 'domicilio',
  SUCURSAL: 'sucursal',
};

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

export function DesgloseProductosPedido({ pedido, mostrarTotal = true }) {
  if (pedido?.lineas_detalle?.length) {
    return (
      <div className="pedido-desglose">
        {pedido.lineas_detalle.map((linea, index) => (
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
          <p className="pedido-desglose-total">
            Total: ${Number(pedido.total).toFixed(2)}
          </p>
        )}
      </div>
    );
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
