import { supabase } from './supabase';

export const MENSAJE_NO_SE_PUDO_VERIFICAR =
  'No se pudo verificar si se puede eliminar. Intenta de nuevo.';

export function etiquetaCatalogo(nombre) {
  const texto = nombre == null ? '' : String(nombre).trim();
  return `«${texto}»`;
}

export function mensajeBloqueoEliminar(razon, nombre) {
  const etiqueta = etiquetaCatalogo(nombre);

  if (razon === 'ventas') {
    return `${etiqueta} ya se usó en pedidos, por eso no se puede eliminar.`;
  }

  if (razon === 'receta') {
    return `${etiqueta} está en una receta de inventario. Quítalo de la receta para eliminarlo.`;
  }

  if (razon === 'consumo_interno') {
    return `${etiqueta} tiene consumo interno registrado, no se puede eliminar.`;
  }

  if (razon === 'items') {
    return `${etiqueta} todavía tiene ítems. Elimínalos primero.`;
  }

  return `${etiqueta} no se puede eliminar.`;
}

export function mensajeConfirmacionEliminar(nombre) {
  return `¿Eliminar ${etiquetaCatalogo(nombre)}? Esta acción no se puede deshacer`;
}

export function mensajeFalloEliminacion(error, data, nombre) {
  if (error) {
    const mensaje = typeof error.message === 'string' ? error.message.trim() : '';
    return mensaje || 'No se pudo eliminar.';
  }

  if (!Array.isArray(data) || data.length === 0) {
    return `No se eliminó ${etiquetaCatalogo(nombre)}.`;
  }

  return null;
}

export async function obtenerRazonEnUso(tipo, id) {
  let data;
  let error;

  try {
    const respuesta = await supabase.rpc('catalogo_en_uso', {
      p_tipo: tipo,
      p_id: String(id),
    });
    data = respuesta?.data;
    error = respuesta?.error;
  } catch (err) {
    error = err;
  }

  if (error) {
    throw new Error(MENSAJE_NO_SE_PUDO_VERIFICAR);
  }

  if (data == null) return null;
  return String(data).trim();
}

export async function prepararEliminacionCatalogo(tipo, id, nombre) {
  try {
    const razon = await obtenerRazonEnUso(tipo, id);

    if (razon != null) {
      return { accion: 'aviso', mensaje: mensajeBloqueoEliminar(razon, nombre) };
    }

    return { accion: 'confirmar', mensaje: mensajeConfirmacionEliminar(nombre) };
  } catch (error) {
    return {
      accion: 'aviso',
      mensaje:
        typeof error?.message === 'string' && error.message.trim()
          ? error.message.trim()
          : MENSAJE_NO_SE_PUDO_VERIFICAR,
    };
  }
}
