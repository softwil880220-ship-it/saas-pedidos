import { formatearMoneda } from './pedidosShared';
import {
  categoriasVariantesActivas,
  filtrarItemsVariantesProducto,
  parsearVariantesActivasProducto,
} from './variantesDinamicas';

export default function VariantesPedido({ linea, producto, variantesCtx, onToggleVariante }) {
  if (!producto) return null;

  const mapa = parsearVariantesActivasProducto(producto, variantesCtx);
  const categorias = categoriasVariantesActivas(variantesCtx.categorias).filter(
    (categoria) => (mapa[String(categoria.id)] || []).length > 0
  );
  if (categorias.length === 0) return null;

  const grupos = categorias
    .map((categoria) => {
      const categoriaId = String(categoria.id);
      const items = filtrarItemsVariantesProducto(producto, categoriaId, variantesCtx);
      if (items.length === 0) return null;

      return { categoriaId, label: categoria.nombre, items };
    })
    .filter(Boolean);

  if (grupos.length === 0) return null;

  return (
    <div className="linea-variantes">
      {grupos.map(({ categoriaId, label, items }) => (
        <div key={categoriaId} className="linea-variantes-grupo">
          <span className="linea-variantes-titulo">{label} (múltiple)</span>
          <div className="linea-variantes-opciones">
            {items.map((item) => (
              <label key={item.id} className="variante-opcion">
                <input
                  type="checkbox"
                  checked={(linea.variantes?.[categoriaId] || []).some(
                    (id) => String(id) === String(item.id)
                  )}
                  onChange={() => onToggleVariante(linea.id, categoriaId, item.id)}
                />
                <span>
                  {item.nombre}
                  {Number(item.precio) > 0 ? ` (+${formatearMoneda(item.precio)})` : ''}
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
