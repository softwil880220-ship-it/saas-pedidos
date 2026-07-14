import { redondearMoneda } from './pedidoCarritoCalculos';
import { formatearMoneda } from './pedidosShared';
import { calcularExtrasLinea } from './variantesDinamicas';

export const UNIDAD_VENTA_PIEZA = 'pieza';
export const UNIDAD_VENTA_PESO = 'peso';

export const OPCIONES_UNIDAD_VENTA = [
  { value: UNIDAD_VENTA_PIEZA, label: 'Pieza' },
  { value: UNIDAD_VENTA_PESO, label: 'Peso (kg)' },
];

export function normalizarUnidadVenta(unidad) {
  return unidad === UNIDAD_VENTA_PESO ? UNIDAD_VENTA_PESO : UNIDAD_VENTA_PIEZA;
}

export function esProductoPorPeso(productoOrLinea) {
  return normalizarUnidadVenta(productoOrLinea?.unidad_venta ?? productoOrLinea?.unidadVenta) === UNIDAD_VENTA_PESO;
}

export function etiquetaPrecioProducto(producto) {
  return esProductoPorPeso(producto) ? 'c/kg' : 'c/u';
}

export function etiquetaCampoPrecioCatalogo(unidadVenta) {
  return normalizarUnidadVenta(unidadVenta) === UNIDAD_VENTA_PESO
    ? 'Precio por kg'
    : 'Precio';
}

export function cantidadInicialLinea(producto) {
  return esProductoPorPeso(producto) ? '' : '1';
}

export function parseCantidadPieza(valor) {
  return Math.max(1, parseInt(valor, 10) || 1);
}

export function parseGramosLinea(valor) {
  const gramos = parseInt(String(valor ?? '').trim(), 10);
  return Number.isFinite(gramos) && gramos > 0 ? gramos : 0;
}

export function calcularSubtotalPorUnidadVenta({ unidadVenta, cantidad, precioUnitario }) {
  const precio = Number(precioUnitario) || 0;

  if (normalizarUnidadVenta(unidadVenta) === UNIDAD_VENTA_PESO) {
    const gramos = parseGramosLinea(cantidad);
    if (gramos <= 0) return 0;
    return redondearMoneda((gramos / 1000) * precio);
  }

  const piezas = parseCantidadPieza(cantidad);
  return redondearMoneda(precio * piezas);
}

export function calcularSubtotalLineaDesdeProducto(linea, producto, variantesCtx) {
  const precioBase = Number(producto?.precio) || 0;
  const extras = redondearMoneda(calcularExtrasLinea(linea, variantesCtx));
  const precioUnitario = redondearMoneda(precioBase + extras);

  return calcularSubtotalPorUnidadVenta({
    unidadVenta: producto?.unidad_venta,
    cantidad: linea?.cantidad,
    precioUnitario,
  });
}

export function obtenerNombreBaseLinea(linea) {
  const nombre = String(linea?.nombre ?? '').trim();
  if (nombre) return nombre;

  const texto = String(linea?.descripcion ?? '').trim();
  const indiceVariantes = texto.indexOf(' (');
  return indiceVariantes >= 0 ? texto.slice(0, indiceVariantes).trim() : texto || 'Producto';
}

export function formatearCantidadProductoTexto(nombre, cantidad, unidadVenta, variantesTexto = '') {
  const nombreBase = String(nombre ?? '').trim() || 'Producto';

  if (normalizarUnidadVenta(unidadVenta) === UNIDAD_VENTA_PESO) {
    const gramos = parseGramosLinea(cantidad);
    let texto = gramos > 0 ? `${nombreBase} ${gramos}g` : nombreBase;
    if (variantesTexto) {
      texto += ` (${variantesTexto})`;
    }
    return texto;
  }

  const piezas = parseCantidadPieza(cantidad);
  let texto = piezas > 1 ? `${nombreBase} x${piezas}` : nombreBase;
  if (variantesTexto) {
    texto += ` (${variantesTexto})`;
  }
  return texto;
}

export function formatearLineaProductoVenta({
  nombre,
  cantidad,
  unidadVenta,
  subtotal,
  variantesTexto = '',
}) {
  const textoCantidad = formatearCantidadProductoTexto(
    nombre,
    cantidad,
    unidadVenta,
    variantesTexto
  );
  const monto = Number(subtotal);

  if (!Number.isFinite(monto) || monto <= 0) {
    return textoCantidad;
  }

  return `${textoCantidad} — ${formatearMoneda(monto)}`;
}

export function formatearLineaDetalleGuardada(linea) {
  if (!esProductoPorPeso(linea)) {
    return null;
  }

  return formatearLineaProductoVenta({
    nombre: obtenerNombreBaseLinea(linea),
    cantidad: linea?.cantidad,
    unidadVenta: linea?.unidad_venta,
    subtotal: linea?.subtotal,
  });
}

export function formatearLineaDetalleCocina(linea) {
  if (!esProductoPorPeso(linea)) {
    return null;
  }

  const nombre =
    String(linea?.descripcion ?? '').trim() || obtenerNombreBaseLinea(linea);
  const gramos = parseGramosLinea(linea?.cantidad);

  if (gramos <= 0) {
    return nombre;
  }

  return `${nombre} — ${gramos}g`;
}
