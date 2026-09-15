import { payloadConNegocio, queryConNegocio } from './tenantHelpers';

export function recetaInsumoVacio() {
  return {
    insumo_id: '',
    cantidad_por_extra: '',
  };
}

export function validarRecetaInsumos(recetaInsumos) {
  const filas = Array.isArray(recetaInsumos) ? recetaInsumos : [];
  const filasValidas = [];
  const insumosUsados = new Set();

  for (const fila of filas) {
    const insumoId = fila?.insumo_id ? String(fila.insumo_id) : '';
    const cantidadTexto = String(fila?.cantidad_por_extra ?? '').trim();
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
      cantidad_por_extra: cantidad,
    });
  }

  return { valido: true, mensaje: null, filas: filasValidas };
}

export async function cargarRecetaVarianteForm(supabase, itemVarianteId, negocioId) {
  if (!itemVarianteId || !negocioId) {
    return { filas: [], insumosReferenciados: [] };
  }

  const { data, error } = await queryConNegocio(
    supabase
      .from('insumo_recetas_variantes')
      .select('insumo_id, cantidad_por_extra, insumos(id, nombre, unidad_medida, activo)')
      .eq('item_variante_id', itemVarianteId)
      .order('created_at'),
    negocioId
  );

  if (error) {
    console.error('[variante_receta] error al cargar receta', error);
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
      cantidad_por_extra: String(fila.cantidad_por_extra ?? ''),
    };
  });

  return { filas, insumosReferenciados };
}

export async function sincronizarRecetaVariante(
  supabase,
  itemVarianteId,
  recetaInsumos,
  negocioId
) {
  if (!itemVarianteId || !negocioId) {
    return;
  }

  const { error: errorDelete } = await queryConNegocio(
    supabase.from('insumo_recetas_variantes').delete().eq('item_variante_id', itemVarianteId),
    negocioId
  );

  if (errorDelete) {
    throw new Error(errorDelete.message);
  }

  if (!recetaInsumos.length) {
    return;
  }

  const { error: errorInsert } = await supabase.from('insumo_recetas_variantes').insert(
    recetaInsumos.map((fila) =>
      payloadConNegocio(
        {
          item_variante_id: itemVarianteId,
          insumo_id: fila.insumo_id,
          cantidad_por_extra: fila.cantidad_por_extra,
        },
        negocioId
      )
    )
  );

  if (errorInsert) {
    throw new Error(errorInsert.message);
  }
}
