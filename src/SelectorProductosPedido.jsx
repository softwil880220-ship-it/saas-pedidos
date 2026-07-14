import { useEffect, useMemo, useRef } from 'react';
import {
  normalizarNombreCategoria,
  ordenarCategoriasPorFrecuencia,
} from './categoriaFrecuenciaPedidos';
import { formatearMoneda } from './pedidosShared';
import { etiquetaPrecioProducto } from './productoUnidadVenta';

function agruparProductosPorCategoria(productos, frecuenciaCategorias) {
  const map = new Map();

  productos.forEach((producto) => {
    const categoria = normalizarNombreCategoria(producto.categoria);
    if (!map.has(categoria)) {
      map.set(categoria, []);
    }
    map.get(categoria).push(producto);
  });

  const nombresOrdenados = ordenarCategoriasPorFrecuencia(
    [...map.keys()],
    frecuenciaCategorias
  );

  return nombresOrdenados.map((nombre) => ({
    nombre,
    productos: map.get(nombre),
  }));
}

export default function SelectorProductosPedido({
  productos,
  frecuenciaCategorias,
  frecuenciaLista = false,
  categoriaActiva,
  onCategoriaChange,
  onAgregarProducto,
}) {
  const frecuencia = frecuenciaCategorias ?? new Map();
  const seleccionPorFrecuenciaAplicadaRef = useRef(false);

  const categorias = useMemo(
    () => agruparProductosPorCategoria(productos, frecuencia),
    [productos, frecuencia]
  );

  useEffect(() => {
    if (!frecuenciaLista) {
      seleccionPorFrecuenciaAplicadaRef.current = false;
    }
  }, [frecuenciaLista]);

  useEffect(() => {
    if (categorias.length === 0 || !frecuenciaLista) return;

    if (!seleccionPorFrecuenciaAplicadaRef.current) {
      seleccionPorFrecuenciaAplicadaRef.current = true;
      onCategoriaChange(categorias[0].nombre);
      return;
    }

    const categoriaValida = categorias.some(
      (categoria) => categoria.nombre === categoriaActiva
    );

    if (!categoriaActiva || !categoriaValida) {
      onCategoriaChange(categorias[0].nombre);
    }
  }, [categorias, categoriaActiva, onCategoriaChange, frecuenciaLista]);

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
                  {etiquetaPrecioProducto(producto) === 'c/kg' ? ' /kg' : ''}
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
