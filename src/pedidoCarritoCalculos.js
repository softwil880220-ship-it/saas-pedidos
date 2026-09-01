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
  categoriasVariantesActivas,
  clonarVariantesLinea,
  formatearDetalleVariantesLinea,
} from './variantesDinamicas';

export function huellaVariantesLineaCarrito(linea, ctx) {
  const variantes = clonarVariantesLinea(linea?.variantes, ctx?.categorias);

  return categoriasVariantesActivas(ctx?.categorias)
    .map((categoria) => {
      const categoriaId = String(categoria.id);
      const ids = [...(variantes[categoriaId] || [])]
        .map(String)
        .sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));

      return `${categoriaId}:${ids.join(',')}`;
    })
    .join(';');
}

export function claveConsolidacionLineaCarrito(linea, ctx) {
  const productoId = String(linea.productoId);
  const producto = buscarProductoPorId(ctx?.productos || [], productoId);

  if (esProductoPorPeso(producto)) {
    return `${productoId}-${linea.id}`;
  }

  return `${productoId}|${huellaVariantesLineaCarrito(linea, ctx)}`;
}

export function consolidarLineasPorProducto(lineas, ctx) {
  const productos = ctx?.productos || [];
  const orden = [];
  const map = new Map();

  (lineas || []).forEach((linea) => {
    if (!linea?.productoId) return;

    const productoId = String(linea.productoId);
    const producto = buscarProductoPorId(productos, productoId);
    const clave = claveConsolidacionLineaCarrito(linea, ctx);
    const variantes = clonarVariantesLinea(linea.variantes, ctx?.categorias);

    if (esProductoPorPeso(producto)) {
      map.set(clave, {
        ...linea,
        productoId,
        cantidad: String(linea.cantidad ?? ''),
        variantes,
      });
      orden.push(clave);
      return;
    }

    const cantidad = parseCantidadPieza(linea.cantidad);

    if (map.has(clave)) {
      const existente = map.get(clave);
      map.set(clave, {
        ...existente,
        cantidad: String(parseCantidadPieza(existente.cantidad) + cantidad),
        variantes: clonarVariantesLinea(existente.variantes, ctx?.categorias),
      });
      return;
    }

    map.set(clave, {
      ...linea,
      productoId,
      cantidad: String(cantidad),
      variantes,
    });
    orden.push(clave);
  });

  return orden.map((clave) => map.get(clave));
}

/** Key de render React: estable al editar gramos/monto; no incluye cantidad. */
export function keyRenderLineaCarrito(linea, ctx, indice = 0) {
  const productoId = String(linea?.productoId ?? '');
  const producto = buscarProductoPorId(ctx?.productos || [], productoId);

  if (!esProductoPorPeso(producto)) {
    return String(linea?.id ?? indice);
  }

  const huella = huellaVariantesLineaCarrito(linea, ctx);
  return `peso-render:${productoId}:${huella}:${indice}`;
}

/** Id estable para React/handlers: una clave de consolidación → un id único. */
export function idEstableLineaCarrito(linea, ctx) {
  const productoId = String(linea.productoId);
  const producto = buscarProductoPorId(ctx?.productos || [], productoId);

  if (esProductoPorPeso(producto)) {
    return `peso:${productoId}:${huellaVariantesLineaCarrito(linea, ctx)}:${String(linea.cantidad ?? '')}`;
  }

  return `pieza:${claveConsolidacionLineaCarrito(linea, ctx)}`;
}

export function calcularNextLineaIdDesdeLineas(lineas, nextLineaIdFallback = 2) {
  let max = 1;
  let tieneIdNumerico = false;

  for (const linea of lineas || []) {
    const n = Number(linea?.id);
    if (Number.isFinite(n)) {
      tieneIdNumerico = true;
      max = Math.max(max, n);
    }
  }

  if (tieneIdNumerico) {
    return max + 1;
  }

  const fallback = Number(nextLineaIdFallback);
  return Number.isFinite(fallback) && fallback >= 2 ? fallback : 2;
}

export function aplicarConsolidacionCarrito(lineas, ctx) {
  const vacias = (lineas || []).filter((linea) => !linea?.productoId);
  const consolidadas = consolidarLineasPorProducto(
    (lineas || []).filter((linea) => linea?.productoId),
    ctx
  ).map((linea) => ({
    ...linea,
    id: idEstableLineaCarrito(linea, ctx),
  }));

  return [...consolidadas, ...vacias];
}

export function normalizarFormLineasCarrito(form, ctx) {
  if (!form) return form;

  return {
    ...form,
    lineas: aplicarConsolidacionCarrito(form.lineas || [], ctx),
  };
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
  const descripcion = formatearDescripcionLinea(linea, producto, variantesCtx);
  const variantes = clonarVariantesLinea(linea.variantes, variantesCtx?.categorias);

  if (unidadVenta === UNIDAD_VENTA_PESO) {
    const cantidad = parseGramosLinea(linea.cantidad);
    if (cantidad <= 0) return null;

    const subtotalBase = calcularSubtotalPorUnidadVenta({
      unidadVenta,
      cantidad,
      precioUnitario: precioBase,
    });
    const subtotal = redondearMoneda(subtotalBase + extras);

    return {
      productoId: String(producto.id),
      nombre: producto.nombre,
      cantidad,
      unidad_venta: unidadVenta,
      precioBase,
      extras,
      precioUnitario: precioBase,
      precio_unitario: precioBase,
      subtotal,
      descripcion,
      variantes,
      cocina: normalizarCocinaProducto(producto.cocina),
    };
  }

  const precioUnitario = redondearMoneda(precioBase + extras);
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
    variantes,
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
