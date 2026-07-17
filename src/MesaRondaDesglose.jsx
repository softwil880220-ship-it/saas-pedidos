import {
  formatearPrecioLineaRecibo,
  obtenerDesgloseLineasPedido,
} from './pedidoDesglose';
import { formatearMoneda } from './pedidosShared';
import {
  etiquetaEstadoLineaRondaMesa,
  obtenerLineasRondaMesaConEstado,
} from './mesaRondaEstado';

function formatearDescripcionLineaRondaMesa({ cantidad, nombre, precioLinea }) {
  const cantidadNumerica = Number(cantidad);
  const nombreTexto = String(nombre ?? '').trim();
  const descripcionBase =
    Number.isFinite(cantidadNumerica) && cantidadNumerica > 0
      ? `${cantidadNumerica} ${nombreTexto}`
      : nombreTexto;

  if (!Number.isFinite(cantidadNumerica) || cantidadNumerica <= 1) {
    return descripcionBase;
  }

  const totalLinea = Number(precioLinea);
  if (!Number.isFinite(totalLinea)) {
    return descripcionBase;
  }

  const precioUnitario =
    Math.round((totalLinea / cantidadNumerica + Number.EPSILON) * 100) / 100;

  return `${descripcionBase} (${formatearMoneda(precioUnitario)} c/u)`;
}

function obtenerFilasDesgloseRondaMesa(pedido, productos, variantesCtx) {
  const lineasConEstado = obtenerLineasRondaMesaConEstado(pedido, productos);

  if (lineasConEstado.length === 0) {
    return [];
  }

  if (pedido?.lineas_detalle?.length) {
    return lineasConEstado.flatMap(({ linea, estado }, lineaIndex) => {
      const { lineas } = obtenerDesgloseLineasPedido(
        { lineas_detalle: [linea] },
        productos,
        variantesCtx
      );

      return lineas.map((fila, filaIndex) => ({
        ...fila,
        key: `${lineaIndex}-${filaIndex}`,
        estado: filaIndex === 0 ? estado : null,
      }));
    });
  }

  const { lineas } = obtenerDesgloseLineasPedido(pedido, productos, variantesCtx);
  const estadoFallback = lineasConEstado[0]?.estado ?? null;

  return lineas.map((fila, index) => ({
    ...fila,
    key: `fallback-${index}`,
    estado: index === 0 ? estadoFallback : null,
  }));
}

function renderEstadoLinea(estado) {
  if (!estado) {
    return null;
  }

  return (
    <span
      className={`mesa-rondas-enviadas-estado status-${estado}`}
      aria-label={`Estado: ${etiquetaEstadoLineaRondaMesa(estado)}`}
    >
      {etiquetaEstadoLineaRondaMesa(estado)}
    </span>
  );
}

export default function MesaRondaDesglose({
  pedido,
  productos,
  variantesCtx,
  mostrarEstado = true,
}) {
  const filas = obtenerFilasDesgloseRondaMesa(pedido, productos, variantesCtx);

  if (filas.length === 0) {
    return null;
  }

  return (
    <div className="mesa-rondas-enviadas-productos" role="list">
      {filas.map((fila) => (
        <div
          key={fila.key}
          className={`mesa-rondas-enviadas-linea${
            fila.textoLinea ? ' mesa-rondas-enviadas-linea-peso' : ''
          }${mostrarEstado ? '' : ' mesa-rondas-enviadas-linea-sin-estado'}`}
          role="listitem"
        >
          {fila.textoLinea ? (
            <>
              <span className="mesa-rondas-enviadas-descripcion">{fila.textoLinea}</span>
              <span className="mesa-rondas-enviadas-precio">
                {formatearPrecioLineaRecibo(fila.precioLinea)}
              </span>
              {mostrarEstado ? renderEstadoLinea(fila.estado) : null}
            </>
          ) : (
            <>
              <span className="mesa-rondas-enviadas-descripcion">
                {formatearDescripcionLineaRondaMesa(fila)}
              </span>
              <span className="mesa-rondas-enviadas-precio">
                {formatearPrecioLineaRecibo(fila.precioLinea)}
              </span>
              {mostrarEstado ? renderEstadoLinea(fila.estado) : null}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
