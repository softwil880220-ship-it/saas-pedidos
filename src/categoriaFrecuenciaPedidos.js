function normalizarNombreCategoria(categoria) {
  return (categoria || '').trim() || 'Sin categoría';
}

function indiceProductoPorId(productos) {
  return new Map(productos.map((producto) => [String(producto.id), producto]));
}

function indiceProductoPorNombre(productos) {
  const mapa = new Map();

  productos.forEach((producto) => {
    const nombre = producto.nombre?.trim();
    if (!nombre) return;

    const clave = nombre.toLowerCase();
    if (!mapa.has(clave)) {
      mapa.set(clave, producto);
    }
  });

  return mapa;
}

function resolverProductoDeLinea(linea, porId, porNombre) {
  if (linea?.productoId != null && linea.productoId !== '') {
    return porId.get(String(linea.productoId)) || null;
  }

  const nombreLinea = (linea?.nombre || linea?.descripcion || '').trim();
  if (!nombreLinea) return null;

  const porNombreExacto = porNombre.get(nombreLinea.toLowerCase());
  if (porNombreExacto) return porNombreExacto;

  const nombreBase = nombreLinea.split(' (')[0].trim().toLowerCase();
  return porNombre.get(nombreBase) || null;
}

export function calcularFrecuenciaCategoriasDesdePedidos(pedidos, productos) {
  const frecuencia = new Map();
  const porId = indiceProductoPorId(productos);
  const porNombre = indiceProductoPorNombre(productos);

  (pedidos || []).forEach((pedido) => {
    const lineas = pedido?.lineas_detalle;
    if (!Array.isArray(lineas)) return;

    lineas.forEach((linea) => {
      const producto = resolverProductoDeLinea(linea, porId, porNombre);
      if (!producto) return;

      const categoria = normalizarNombreCategoria(producto.categoria);
      const cantidad = Math.max(1, parseInt(linea.cantidad, 10) || 1);

      frecuencia.set(categoria, (frecuencia.get(categoria) || 0) + cantidad);
    });
  });

  return frecuencia;
}

export function ordenarCategoriasPorFrecuencia(nombresCategorias, frecuenciaCategorias) {
  return [...nombresCategorias].sort((a, b) => {
    const freqA = frecuenciaCategorias.get(a) || 0;
    const freqB = frecuenciaCategorias.get(b) || 0;

    if (freqB !== freqA) {
      return freqB - freqA;
    }

    return a.localeCompare(b, 'es', { sensitivity: 'base' });
  });
}

export { normalizarNombreCategoria };
