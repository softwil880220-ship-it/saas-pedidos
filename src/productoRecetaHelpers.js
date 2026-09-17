import { asegurarInsumosRecetaEnCatalogo } from './inventarioTenantHelpers';
import { payloadConNegocio, queryConNegocio } from './tenantHelpers';

export function recetaInsumoVacio() {
  return {
    insumo_id: '',
    cantidad_por_producto: '',
  };
}

export function validarRecetaInsumos(recetaInsumos) {
  const filas = Array.isArray(recetaInsumos) ? recetaInsumos : [];
  const filasValidas = [];
  const insumosUsados = new Set();

  for (const fila of filas) {
    const insumoId = fila?.insumo_id ? String(fila.insumo_id) : '';
    const cantidadTexto = String(fila?.cantidad_por_producto ?? '').trim();
    const cantidad = Number(cantidadTexto);

    if (!insumoId && !cantidadTexto) {
      continue;
    }

    if (!insumoId) {
      return {
        valido: false,
        mensaje: 'Cada fila de receta debe tener un insumo seleccionado.',
        filas: [],
      };
    }

    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      return {
        valido: false,
        mensaje: 'Cada fila de receta debe tener una cantidad mayor a cero.',
        filas: [],
      };
    }

    if (insumosUsados.has(insumoId)) {
      return {
        valido: false,
        mensaje: 'No puedes repetir el mismo insumo dos veces en la receta.',
        filas: [],
      };
    }

    insumosUsados.add(insumoId);
    filasValidas.push({
      insumo_id: insumoId,
      cantidad_por_producto: cantidad,
    });
  }

  return { valido: true, mensaje: null, filas: filasValidas };
}

export async function cargarRecetaProductoForm(supabase, productoId, negocioId) {
  if (!productoId || !negocioId) {
    return { filas: [], insumosReferenciados: [] };
  }

  const { data, error } = await queryConNegocio(
    supabase
      .from('insumo_recetas')
      .select('insumo_id, cantidad_por_producto, insumos(id, nombre, unidad_medida, activo)')
      .eq('producto_id', productoId)
      .order('created_at'),
    negocioId
  );

  if (error) {
    console.error('[producto_receta] error al cargar receta', error);
    return { filas: [], insumosReferenciados: [] };
  }

  const insumosReferenciados = [];
  const insumosVistos = new Set();

  const filas = (data || []).map((fila) => {
    const insumo = fila.insumos;
    if (insumo?.id && !insumosVistos.has(String(insumo.id))) {
      insumosVistos.add(String(insumo.id));
      insumosReferenciados.push(insumo);
    }

    return {
      insumo_id: fila.insumo_id,
      cantidad_por_producto: String(fila.cantidad_por_producto ?? ''),
    };
  });

  return { filas, insumosReferenciados };
}

export async function sincronizarProductoRecetas(
  supabase,
  productoId,
  recetaInsumos,
  negocioId,
  catalogoInsumos = []
) {
  if (!productoId || !negocioId) {
    return;
  }

  if (recetaInsumos.length > 0) {
    asegurarInsumosRecetaEnCatalogo(recetaInsumos, catalogoInsumos);
  }

  const { error: errorDelete } = await queryConNegocio(
    supabase.from('insumo_recetas').delete().eq('producto_id', productoId),
    negocioId
  );

  if (errorDelete) {
    throw new Error(errorDelete.message);
  }

  if (!recetaInsumos.length) {
    return;
  }

  const { error: errorInsert } = await supabase.from('insumo_recetas').insert(
    recetaInsumos.map((fila) =>
      payloadConNegocio(
        {
          producto_id: productoId,
          insumo_id: fila.insumo_id,
          cantidad_por_producto: fila.cantidad_por_producto,
        },
        negocioId
      )
    )
  );

  if (errorInsert) {
    throw new Error(errorInsert.message);
  }
}
