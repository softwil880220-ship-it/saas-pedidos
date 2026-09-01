import { useState } from 'react';
import {
  buscarProductoPorId,
  calcularSubtotal,
  keyRenderLineaCarrito,
  redondearMoneda,
} from './pedidoCarritoCalculos';
import { formatearMoneda } from './pedidosShared';
import {
  esProductoPorPeso,
  etiquetaPrecioProducto,
  formatearLineaProductoVenta,
  parseCantidadPieza,
} from './productoUnidadVenta';
import { calcularExtrasLinea } from './variantesDinamicas';
import VariantesPedido from './VariantesPedido.jsx';
import EntradaPesoMonto from './EntradaPesoMonto.jsx';

function contarUnidadesFisicasCarrito(lineas, productos) {
  return lineas.reduce((total, linea) => {
    const producto = buscarProductoPorId(productos, linea.productoId);

    if (esProductoPorPeso(producto)) {
      return total + 1;
    }

    return total + parseCantidadPieza(linea.cantidad);
  }, 0);
}

function etiquetaResumenLineas(cantidad, totalPedido) {
  const etiquetaCantidad =
    cantidad === 1 ? '1 producto' : `${cantidad} productos`;

  return `${etiquetaCantidad} · ${formatearMoneda(totalPedido)}`;
}

export default function PedidoLineasCarrito({
  lineas,
  productos,
  variantesCtx,
  totalPedido,
  colapsablePorDefecto = false,
  etiquetaResumenColapsado,
  onAjustarCantidad,
  onActualizarCantidad,
  onEliminarLinea,
  onCambiarVariante,
  children,
}) {
  const [expandido, setExpandido] = useState(!colapsablePorDefecto);
  const resumenColapsado =
    etiquetaResumenColapsado ??
    etiquetaResumenLineas(contarUnidadesFisicasCarrito(lineas, productos), totalPedido);

  return (
    <>
      <div className="pedido-lineas">
        {colapsablePorDefecto ? (
          <button
            type="button"
            className="pedido-lineas-resumen"
            aria-expanded={expandido}
            onClick={() => setExpandido((valor) => !valor)}
          >
            <span>{resumenColapsado}</span>
            <span className="pedido-lineas-resumen-chevron" aria-hidden="true">
              {expandido ? '▴' : '▾'}
            </span>
          </button>
        ) : (
          <div className="pedido-lineas-encabezado">
            <span>Productos del pedido</span>
          </div>
        )}

        {(!colapsablePorDefecto || expandido) &&
          lineas.map((linea, indice) => {
            const productoSeleccionado = buscarProductoPorId(productos, linea.productoId);
            const subtotal = calcularSubtotal(linea, productos, variantesCtx);
            const extras = redondearMoneda(calcularExtrasLinea(linea, variantesCtx));
            const esPorPeso = esProductoPorPeso(productoSeleccionado);
            const ctxRender = { ...variantesCtx, productos };
            const keyRender = keyRenderLineaCarrito(linea, ctxRender, indice);
            const textoLinea =
              esPorPeso && subtotal > 0
                ? formatearLineaProductoVenta({
                    nombre: productoSeleccionado.nombre,
                    cantidad: linea.cantidad,
                    unidadVenta: productoSeleccionado.unidad_venta,
                    subtotal,
                  })
                : null;

            return (
              <div key={keyRender} className="pedido-linea-contenedor">
                <div className="pedido-linea-cabecera">
                  <div className="pedido-linea-numero">#{indice + 1}</div>
                  <button
                    type="button"
                    className="eliminar-linea-btn"
                    onClick={() => onEliminarLinea(linea.id)}
                    aria-label={`Eliminar producto ${indice + 1}`}
                  >
                    ✕
                  </button>
                </div>
                <div className="pedido-linea">
                  <div className="formulario-campo pedido-linea-producto">
                    <span className="pedido-linea-producto-label">Producto</span>
                    <span className="pedido-linea-producto-nombre">
                      {productoSeleccionado
                        ? `${productoSeleccionado.nombre} — ${formatearMoneda(productoSeleccionado.precio)} ${etiquetaPrecioProducto(productoSeleccionado)}`
                        : ''}
                    </span>
                    {textoLinea ? (
                      <span className="pedido-linea-producto-resumen">{textoLinea}</span>
                    ) : null}
                  </div>
                  {esPorPeso ? (
                    <EntradaPesoMonto
                      cantidad={linea.cantidad}
                      precioUnitario={productoSeleccionado.precio}
                      extras={extras}
                      onChangeCantidad={(valor) =>
                        onActualizarCantidad?.(linea.id, valor)
                      }
                      productoNombre={productoSeleccionado.nombre}
                      idBase={`cantidad-${keyRender}`}
                    />
                  ) : (
                    <>
                  <div className="formulario-campo pedido-linea-cantidad">
                    <span className="pedido-linea-cantidad-label">
                      Cantidad
                    </span>
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
                    </>
                  )}
                </div>
                {onCambiarVariante && productoSeleccionado ? (
                  <VariantesPedido
                    key={`variantes-${keyRender}-${linea.productoId}`}
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
