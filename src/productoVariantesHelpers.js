import {
  categoriasVariantesActivas,
  filtrarItemsVariantesProducto,
  parsearVariantesActivasProducto,
} from './variantesDinamicas';

export function productoTieneVariantesSeleccionables(producto, variantesCtx) {
  if (!producto) return false;

  const mapa = parsearVariantesActivasProducto(producto, variantesCtx);
  const categorias = categoriasVariantesActivas(variantesCtx.categorias).filter(
    (categoria) => (mapa[String(categoria.id)] || []).length > 0
  );

  return categorias.some((categoria) => {
    const items = filtrarItemsVariantesProducto(
      producto,
      String(categoria.id),
      variantesCtx
    );
    return items.length > 0;
  });
}

export function toggleVarianteEnLinea(variantes, categoriaId, itemId) {
  const categoria = String(categoriaId);
  const idStr = String(itemId);
  const lista = variantes?.[categoria] || [];

  if (lista.some((item) => String(item) === idStr)) {
    return {
      ...variantes,
      [categoria]: lista.filter((item) => String(item) !== idStr),
    };
  }

  return {
    ...variantes,
    [categoria]: [...lista, idStr],
  };
}
