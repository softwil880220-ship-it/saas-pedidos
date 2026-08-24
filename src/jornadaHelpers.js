import { queryConNegocio, payloadConNegocio } from './tenantHelpers';
import { redondearMoneda } from './pedidoCarritoCalculos';

export const JORNADA_ESTADO_ABIERTA = 'abierta';
export const JORNADA_ESTADO_CERRADA = 'cerrada';

export const ROLES_GESTION_JORNADA = ['dueno', 'administrador'];

export const MENSAJE_JORNADA_YA_ABIERTA = 'Ya hay una jornada abierta';

export function puedeGestionarJornada(rol) {
  return ROLES_GESTION_JORNADA.includes(rol);
}

export function formatearClaveFechaJornada(fecha) {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, '0');
  const day = String(fecha.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function pedidoPerteneceJornada(pedido, jornada) {
  const jornadaId = jornada?.id;
  if (!pedido?.created_at || !jornadaId) return false;

  if (pedido.jornada_id) {
    return pedido.jornada_id === jornadaId;
  }

  const abiertaEn = jornada?.abierta_en;
  if (!abiertaEn) return false;

  const fechaCreacion = new Date(pedido.created_at);
  const hoyClave = formatearClaveFechaJornada(new Date());

  return (
    formatearClaveFechaJornada(fechaCreacion) === hoyClave &&
    fechaCreacion >= new Date(abiertaEn)
  );
}

export function formatearHoraJornada(iso) {
  if (!iso) return '—';

  return new Date(iso).toLocaleTimeString('es-MX', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function esErrorJornadaDuplicada(error) {
  if (!error) return false;

  return (
    error.code === '23505' ||
    /duplicate key|unique constraint|jornadas_negocio_abierta_unique/i.test(
      error.message || ''
    )
  );
}

export async function cargarJornadaAbierta(supabase, negocioId) {
  if (!negocioId) return { data: null, error: null };

  const { data, error } = await queryConNegocio(
    supabase
      .from('jornadas')
      .select('id, negocio_id, estado, abierta_en, abierta_por')
      .eq('estado', JORNADA_ESTADO_ABIERTA)
      .order('abierta_en', { ascending: false })
      .limit(1)
      .maybeSingle(),
    negocioId
  );

  return { data: data ?? null, error };
}

export async function cargarMesasAbiertasJornada(supabase, negocioId) {
  if (!negocioId) return { data: [], error: null };

  const { data, error } = await queryConNegocio(
    supabase
      .from('mesas_folios')
      .select('id, numero_mesa, abierta_en')
      .eq('estado', 'abierta')
      .order('numero_mesa', { ascending: true }),
    negocioId
  );

  return { data: data ?? [], error };
}

export async function abrirJornada(supabase, negocioId, usuarioNegocioId) {
  if (!negocioId || !usuarioNegocioId) {
    return { data: null, error: new Error('No se pudo identificar el negocio o el usuario.') };
  }

  const { data, error } = await supabase
    .from('jornadas')
    .insert(
      payloadConNegocio(
        {
          abierta_por: usuarioNegocioId,
        },
        negocioId
      )
    )
    .select('id, negocio_id, estado, abierta_en, abierta_por')
    .single();

  return { data: data ?? null, error };
}

export async function cerrarJornada(supabase, negocioId, jornadaId, usuarioNegocioId) {
  if (!negocioId || !jornadaId || !usuarioNegocioId) {
    return { data: null, error: new Error('No se pudo identificar la jornada o el usuario.') };
  }

  const { data, error } = await queryConNegocio(
    supabase
      .from('jornadas')
      .update({
        estado: JORNADA_ESTADO_CERRADA,
        cerrada_en: new Date().toISOString(),
        cerrada_por: usuarioNegocioId,
      })
      .eq('id', jornadaId)
      .eq('estado', JORNADA_ESTADO_ABIERTA)
      .select('id, negocio_id, estado, abierta_en, cerrada_en')
      .maybeSingle(),
    negocioId
  );

  return { data: data ?? null, error };
}

export async function cargarRetirosJornada(supabase, negocioId, jornadaId) {
  if (!negocioId || !jornadaId) return { total: 0, error: null };

  const { data, error } = await queryConNegocio(
    supabase.from('retiros').select('monto').eq('jornada_id', jornadaId),
    negocioId
  );

  if (error) {
    return { total: 0, error };
  }

  const total = redondearMoneda(
    (data || []).reduce((suma, retiro) => suma + (Number(retiro.monto) || 0), 0)
  );

  return { total, error: null };
}

export async function cargarFondoFijoJornada(supabase, negocioId, jornadaId) {
  if (!negocioId || !jornadaId) {
    return { monto: 0, id: null, jornada_id: null, error: null };
  }

  const { data, error } = await queryConNegocio(
    supabase
      .from('fondos_fijos')
      .select('id, monto, jornada_id')
      .eq('jornada_id', jornadaId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    negocioId
  );

  if (error) {
    return { monto: 0, id: null, jornada_id: null, error };
  }

  return {
    monto: data ? redondearMoneda(Number(data.monto) || 0) : 0,
    id: data?.id ?? null,
    jornada_id: data?.jornada_id ?? null,
    error: null,
  };
}

export async function jornadaEstaCerrada(supabase, jornadaId) {
  if (!jornadaId) return false;

  const { data, error } = await supabase
    .from('jornadas')
    .select('estado')
    .eq('id', jornadaId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.estado === JORNADA_ESTADO_CERRADA;
}
