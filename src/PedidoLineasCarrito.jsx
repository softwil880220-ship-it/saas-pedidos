import {
  buscarProductoPorId,
  calcularSubtotal,
} from './pedidoCarritoCalculos';
import { formatearMoneda } from './pedidosShared';
import VariantesPedido from './VariantesPedido.jsx';

export default function PedidoLineasCarrito({
  lineas,
  productos,
  variantesCtx,
  totalPedido,
  onAjustarCantidad,
  onEliminarLinea,
  onCambiarVariante,
  children,
}) {
  return (
    <>
      <div className="pedido-lineas">
        <div className="pedido-lineas-encabezado">
          <span>Productos del pedido</span>
        </div>
        {lineas.map((linea, indice) => {
          const productoSeleccionado = buscarProductoPorId(productos, linea.productoId);
          const subtotal = calcularSubtotal(linea, productos, variantesCtx);

          return (
            <div key={linea.id} className="pedido-linea-contenedor">
              <div className="pedido-linea">
                <div className="pedido-linea-numero">#{indice + 1}</div>
                <div className="formulario-campo pedido-linea-producto">
                  <span className="pedido-linea-producto-label">Producto</span>
                  <span className="pedido-linea-producto-nombre">
                    {productoSeleccionado
                      ? `${productoSeleccionado.nombre} — ${formatearMoneda(productoSeleccionado.precio)} c/u`
                      : ''}
                  </span>
                </div>
                <div className="formulario-campo pedido-linea-cantidad">
                  <span className="pedido-linea-cantidad-label">Cantidad</span>
                  <div
                    className="cantidad-stepper"
                    role="group"
                    aria-label={`Cantidad producto ${indice + 1}`}
                  >
                    <button
                      type="button"
                      className="cantidad-stepper-btn"
                      onClick={() => onAjustarCantidad(linea.id, -1)}
                      disabled={(parseInt(linea.cantidad, 10) || 1) <= 1}
                      aria-label="Reducir cantidad"
                    >
                      −
                    </button>
                    <span className="cantidad-stepper-valor" id={`cantidad-${linea.id}`}>
                      {parseInt(linea.cantidad, 10) || 1}
                    </span>
                    <button
                      type="button"
                      className="cantidad-stepper-btn"
                      onClick={() => onAjustarCantidad(linea.id, 1)}
                      aria-label="Aumentar cantidad"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="formulario-campo pedido-linea-subtotal">
                  <label htmlFor={`subtotal-${linea.id}`}>Subtotal</label>
                  <input
                    id={`subtotal-${linea.id}`}
                    type="text"
                    value={subtotal > 0 ? formatearMoneda(subtotal) : ''}
                    readOnly
                  />
                </div>
                <button
                  type="button"
                  className="eliminar-linea-btn"
                  onClick={() => onEliminarLinea(linea.id)}
                  aria-label={`Eliminar producto ${indice + 1}`}
                >
                  ✕
                </button>
              </div>
              {onCambiarVariante && productoSeleccionado ? (
                <VariantesPedido
                  key={`variantes-${linea.id}-${linea.productoId}`}
                  linea={linea}
                  producto={productoSeleccionado}
                  variantesCtx={variantesCtx}
                  onToggleVariante={onCambiarVariante}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="pedido-acciones">
        <div className="pedido-total-pedido">
          <span className="pedido-total-label">Total del pedido</span>
          <span className="pedido-total-valor">{formatearMoneda(totalPedido)}</span>
        </div>
        {children}
      </div>
    </>
  );
}
