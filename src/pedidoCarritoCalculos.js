import { normalizarCocinaProducto } from './pedidosShared';
import {
  UNIDAD_VENTA_PESO,
  calcularSubtotalPorUnidadVenta,
  esProductoPorPeso,
  normalizarUnidadVenta,
  parseCantidadPieza,
  parseGramosLinea,
} from './productoUnidadVenta';
import {
  calcularExtrasLinea,
  clonarVariantesLinea,
  formatearDetalleVariantesLinea,
} from './variantesDinamicas';

export function consolidarLineasPorProducto(lineas, ctx) {
  const productos = ctx?.productos || [];
  const orden = [];
  const map = new Map();

  (lineas || []).forEach((linea) => {
    if (!linea?.productoId) return;

    const productoId = String(linea.productoId);
    const producto = buscarProductoPorId(productos, productoId);

    if (esProductoPorPeso(producto)) {
      const clave = `${productoId}-${linea.id}`;
      map.set(clave, {
        ...linea,
        productoId,
        cantidad: String(linea.cantidad ?? ''),
        variantes: clonarVariantesLinea(linea.variantes, ctx?.categorias),
      });
      orden.push(clave);
      return;
    }

    const cantidad = parseCantidadPieza(linea.cantidad);

    if (map.has(productoId)) {
      const existente = map.get(productoId);
      map.set(productoId, {
        ...existente,
        cantidad: String(parseCantidadPieza(existente.cantidad) + cantidad),
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

  return orden.map((clave) => map.get(clave));
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

  const unidadVenta = normalizarUnidadVenta(producto.unidad_venta);
  const precioBase = parsePrecioCatalogo(producto.precio);
  const extras = redondearMoneda(calcularExtrasLinea(linea, variantesCtx));
  const precioUnitario = redondearMoneda(precioBase + extras);
  const descripcion = formatearDescripcionLinea(linea, producto, variantesCtx);

  if (unidadVenta === UNIDAD_VENTA_PESO) {
    const cantidad = parseGramosLinea(linea.cantidad);
    if (cantidad <= 0) return null;

    const subtotal = calcularSubtotalPorUnidadVenta({
      unidadVenta,
      cantidad,
      precioUnitario,
    });

    return {
      productoId: String(producto.id),
      nombre: producto.nombre,
      cantidad,
      unidad_venta: unidadVenta,
      precioBase,
      extras,
      precioUnitario,
      precio_unitario: precioUnitario,
      subtotal,
      descripcion,
      cocina: normalizarCocinaProducto(producto.cocina),
    };
  }

  const cantidad = parseCantidadPieza(linea.cantidad);
  const subtotal = calcularSubtotalPorUnidadVenta({
    unidadVenta,
    cantidad,
    precioUnitario,
  });

  return {
    productoId: String(producto.id),
    nombre: producto.nombre,
    cantidad,
    unidad_venta: unidadVenta,
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
