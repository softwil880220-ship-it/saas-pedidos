import { normalizarCocinaProducto } from './pedidosShared';
import {
  calcularExtrasLinea,
  clonarVariantesLinea,
  formatearDetalleVariantesLinea,
} from './variantesDinamicas';

export function consolidarLineasPorProducto(lineas, ctx) {
  const orden = [];
  const map = new Map();

  (lineas || []).forEach((linea) => {
    if (!linea?.productoId) return;

    const productoId = String(linea.productoId);
    const cantidad = Math.max(1, parseInt(linea.cantidad, 10) || 1);

    if (map.has(productoId)) {
      const existente = map.get(productoId);
      map.set(productoId, {
        ...existente,
        cantidad: String((parseInt(existente.cantidad, 10) || 1) + cantidad),
        variantes: clonarVariantesLinea(existente.variantes, ctx?.categorias),
      });
      return;
    }

    const copia = {
      ...linea,
      productoId,
      cantidad: String(cantidad),
      variantes: clonarVariantesLinea(linea.variantes, ctx?.categorias),
    };
    map.set(productoId, copia);
    orden.push(productoId);
  });

  return orden.map((productoId) => map.get(productoId));
}

function buscarPorId(lista, id) {
  if (id === '' || id === null || id === undefined) {
    return null;
  }

  return lista.find((item) => String(item.id) === String(id)) || null;
}

export function buscarProductoPorId(listaProductos, productoId) {
  return buscarPorId(listaProductos, productoId);
}

function parsePrecioCatalogo(valor) {
  const precio = Number(valor);
  return Number.isFinite(precio) ? redondearMoneda(precio) : 0;
}

export function redondearMoneda(valor) {
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}

export function formatearDescripcionLinea(linea, producto, variantesCtx) {
  const detalles = formatearDetalleVariantesLinea(linea, variantesCtx);
  if (detalles.length === 0) return producto.nombre;
  return `${producto.nombre} (${detalles.join('; ')})`;
}

export function calcularDetalleLineaPedido(linea, listaProductos, variantesCtx) {
  const producto = buscarProductoPorId(listaProductos, linea.productoId);
  if (!producto) return null;

  const cantidad = Math.max(1, parseInt(linea.cantidad, 10) || 1);
  const precioBase = parsePrecioCatalogo(producto.precio);
  const extras = redondearMoneda(calcularExtrasLinea(linea, variantesCtx));
  const precioUnitario = redondearMoneda(precioBase + extras);
  const subtotal = redondearMoneda(precioUnitario * cantidad);
  const descripcion = formatearDescripcionLinea(linea, producto, variantesCtx);

  return {
    productoId: String(producto.id),
    nombre: producto.nombre,
    cantidad,
    precioBase,
    extras,
    precioUnitario,
    precio_unitario: precioUnitario,
    subtotal,
    descripcion,
    cocina: normalizarCocinaProducto(producto.cocina),
  };
}

export function calcularDetalleLineasPedido(lineas, listaProductos, variantesCtx) {
  const lineasDetalle = lineas
    .map((linea) => calcularDetalleLineaPedido(linea, listaProductos, variantesCtx))
    .filter(Boolean);

  const total = redondearMoneda(
    lineasDetalle.reduce((suma, linea) => suma + linea.subtotal, 0)
  );

  return { lineas: lineasDetalle, total };
}

export function calcularSubtotal(linea, listaProductos, variantesCtx) {
  return calcularDetalleLineaPedido(linea, listaProductos, variantesCtx)?.subtotal ?? 0;
}

export function calcularTotalLineas(lineas, listaProductos, variantesCtx) {
  return calcularDetalleLineasPedido(lineas, listaProductos, variantesCtx).total;
}
