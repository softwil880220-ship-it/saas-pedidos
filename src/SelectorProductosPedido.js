import { useEffect, useMemo } from 'react';
import { formatearMoneda } from './pedidosShared';

function agruparProductosPorCategoria(productos) {
  const map = new Map();

  productos.forEach((producto) => {
    const categoria = (producto.categoria || '').trim() || 'Sin categoría';
    if (!map.has(categoria)) {
      map.set(categoria, []);
    }
    map.get(categoria).push(producto);
  });

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
    .map(([nombre, items]) => ({ nombre, productos: items }));
}

export default function SelectorProductosPedido({
  productos,
  categoriaActiva,
  onCategoriaChange,
  onAgregarProducto,
}) {
  const categorias = useMemo(
    () => agruparProductosPorCategoria(productos),
    [productos]
  );

  useEffect(() => {
    if (categorias.length === 0) return;

    const categoriaValida = categorias.some(
      (categoria) => categoria.nombre === categoriaActiva
    );

    if (!categoriaActiva || !categoriaValida) {
      onCategoriaChange(categorias[0].nombre);
    }
  }, [categorias, categoriaActiva, onCategoriaChange]);

  const categoriaSeleccionada = categorias.find(
    (categoria) => categoria.nombre === categoriaActiva
  );

  if (categorias.length === 0) {
    return null;
  }

  return (
    <div className="selector-productos-pedido">
      <div
        className="selector-productos-categorias"
        role="tablist"
        aria-label="Categorías de productos"
      >
        {categorias.map(({ nombre }) => (
          <button
            key={nombre}
            type="button"
            role="tab"
            aria-selected={categoriaActiva === nombre}
            className={`selector-productos-categoria${
              categoriaActiva === nombre ? ' activa' : ''
            }`}
            onClick={() => onCategoriaChange(nombre)}
          >
            {nombre}
          </button>
        ))}
      </div>

      {categoriaSeleccionada ? (
        <div
          className="selector-productos-lista"
          role="tabpanel"
          aria-label={`Productos de ${categoriaSeleccionada.nombre}`}
        >
          {categoriaSeleccionada.productos.map((producto) => (
            <div key={producto.id} className="selector-productos-item">
              <div className="selector-productos-item-info">
                <span className="selector-productos-item-nombre">{producto.nombre}</span>
                <span className="selector-productos-item-precio">
                  {formatearMoneda(producto.precio)}
                </span>
              </div>
              <button
                type="button"
                className="selector-productos-agregar-btn"
                onClick={() => onAgregarProducto(producto.id)}
                aria-label={`Agregar ${producto.nombre}`}
              >
                +
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
