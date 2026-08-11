import { useState } from 'react';
import { calcularSubtotal } from './pedidoCarritoCalculos';
import { formatearMoneda } from './pedidosShared';
import {
  cantidadInicialLinea,
  esProductoPorPeso,
  etiquetaPrecioProducto,
  parseCantidadPieza,
  parseGramosLinea,
} from './productoUnidadVenta';
import { toggleVarianteEnLinea } from './productoVariantesHelpers';
import { calcularExtrasLinea, crearVariantesLineaVacias } from './variantesDinamicas';
import VariantesPedido from './VariantesPedido.jsx';
import EntradaPesoMonto from './EntradaPesoMonto.jsx';
import { redondearMoneda } from './pedidoCarritoCalculos';

const LINEA_DRAFT_ID = 'modal-seleccion-draft';

function crearLineaDraft(producto, variantesCtx) {
  return {
    id: LINEA_DRAFT_ID,
    productoId: String(producto.id),
    cantidad: cantidadInicialLinea(producto),
    variantes: crearVariantesLineaVacias(variantesCtx.categorias),
  };
}

export default function ModalSeleccionProductoPedido({
  producto,
  productos,
  variantesCtx,
  onCancelar,
  onConfirmar,
}) {
  const [lineaDraft, setLineaDraft] = useState(() =>
    crearLineaDraft(producto, variantesCtx)
  );

  const esPorPeso = esProductoPorPeso(producto);
  const extras = redondearMoneda(calcularExtrasLinea(lineaDraft, variantesCtx));
  const subtotal = calcularSubtotal(lineaDraft, productos, variantesCtx);
  const confirmarDeshabilitado =
    esPorPeso && parseGramosLinea(lineaDraft.cantidad) <= 0;

  const handleConfirmar = () => {
    if (confirmarDeshabilitado) return;

    onConfirmar({
      productoId: lineaDraft.productoId,
      cantidad: esPorPeso
        ? String(parseGramosLinea(lineaDraft.cantidad))
        : String(parseCantidadPieza(lineaDraft.cantidad)),
      variantes: lineaDraft.variantes,
    });
  };

  return (
    <div
      className="modal-seleccion-producto-overlay"
      onClick={onCancelar}
    >
      <div
        className="modal-seleccion-producto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-seleccion-producto-titulo"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-seleccion-producto-cabecera">
          <h3 id="modal-seleccion-producto-titulo" className="modal-seleccion-producto-titulo">
            {producto.nombre}
          </h3>
          <p className="modal-seleccion-producto-precio">
            {formatearMoneda(producto.precio)}
            {etiquetaPrecioProducto(producto) === 'c/kg' ? ' /kg' : ''}
          </p>
        </header>

        <VariantesPedido
          linea={lineaDraft}
          producto={producto}
          variantesCtx={variantesCtx}
          onToggleVariante={(_lineaId, categoriaId, itemId) => {
            setLineaDraft((prev) => ({
              ...prev,
              variantes: toggleVarianteEnLinea(prev.variantes, categoriaId, itemId),
            }));
          }}
        />

        <div className="modal-seleccion-producto-cantidad">
          {!esPorPeso ? (
            <span className="modal-seleccion-producto-cantidad-label">Cantidad</span>
          ) : null}
          {esPorPeso ? (
            <EntradaPesoMonto
              cantidad={lineaDraft.cantidad}
              precioUnitario={producto.precio}
              extras={extras}
              onChangeCantidad={(valor) =>
                setLineaDraft((prev) => ({ ...prev, cantidad: valor }))
              }
              productoNombre={producto.nombre}
              idBase="modal-seleccion-peso"
            />
          ) : (
            <div
              className="cantidad-stepper"
              role="group"
              aria-label={`Cantidad de ${producto.nombre}`}
            >
              <button
                type="button"
                className="cantidad-stepper-btn"
                onClick={() =>
                  setLineaDraft((prev) => ({
                    ...prev,
                    cantidad: String(
                      Math.max(1, parseCantidadPieza(prev.cantidad) - 1)
                    ),
                  }))
                }
                disabled={parseCantidadPieza(lineaDraft.cantidad) <= 1}
                aria-label="Reducir cantidad"
              >
                −
              </button>
              <span className="cantidad-stepper-valor">
                {parseCantidadPieza(lineaDraft.cantidad)}
              </span>
              <button
                type="button"
                className="cantidad-stepper-btn"
                onClick={() =>
                  setLineaDraft((prev) => ({
                    ...prev,
                    cantidad: String(parseCantidadPieza(prev.cantidad) + 1),
                  }))
                }
                aria-label="Aumentar cantidad"
              >
                +
              </button>
            </div>
          )}
        </div>

        <p className="modal-seleccion-producto-subtotal">
          Subtotal: {subtotal > 0 ? formatearMoneda(subtotal) : '—'}
        </p>

        <footer className="modal-seleccion-producto-acciones">
          <button
            type="button"
            className="modal-seleccion-producto-cancelar"
            onClick={onCancelar}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="modal-seleccion-producto-confirmar guardar-btn"
            disabled={confirmarDeshabilitado}
            onClick={handleConfirmar}
          >
            Confirmar selección
          </button>
        </footer>
      </div>
    </div>
  );
}
