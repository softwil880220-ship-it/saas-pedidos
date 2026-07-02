import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { compareSync, hashSync, genSaltSync } from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ROLES_AUTORIZADOS = ['dueno', 'administrador'] as const;
const BCRYPT_COST = 10;

type Action = 'configurar' | 'verificar';

interface PanelPinAutorizacionRequest {
  action?: Action;
  negocio_id?: string;
  pin?: string | null;
}

function jsonResponse(
  body: { success: boolean; data?: unknown; error?: string },
  status = 200
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function getEnv(name: string): string | null {
  return Deno.env.get(name) ?? null;
}

function createAdminClient(): SupabaseClient | null {
  const supabaseUrl = getEnv('SUPABASE_URL');
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function crearClienteUsuario(
  req: Request
): Promise<
  | { ok: true; supabaseUser: SupabaseClient; authUserId: string }
  | { ok: false; status: number; error: string }
> {
  const authHeader = req.headers.get('Authorization');

  if (!authHeader) {
    return { ok: false, status: 401, error: 'Falta el header Authorization.' };
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  console.log('[panel-pin-autorizacion] Token recibido (primeros 20 chars):', token.substring(0, 20), '- longitud:', token.length);
  if (!token) {
    return { ok: false, status: 401, error: 'Token inválido o expirado.' };
  }

  const supabaseUrl = getEnv('SUPABASE_URL');
  const anonKey = getEnv('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !anonKey) {
    return { ok: false, status: 500, error: 'Configuración de Supabase incompleta.' };
  }

  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: {
      headers: { Authorization: authHeader },
    },
  });

  const {
    data: { user },
    error: userError,
  } = await supabaseUser.auth.getUser(token);

  if (userError || !user) {
    console.error('[panel-pin-autorizacion] Error de auth:', JSON.stringify(userError));
    return { ok: false, status: 401, error: 'Token inválido o expirado.' };
  }

  return { ok: true, supabaseUser, authUserId: user.id };
}

function pinAutorizacionValido(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

async function verificarPermisoConfigurar(
  supabaseUser: SupabaseClient,
  authUserId: string
): Promise<
  | { ok: true; perfil: { id: string; negocio_id: string; rol: string } }
  | { ok: false; status: number; error: string }
> {
  const { data: perfil, error: perfilError } = await supabaseUser
    .from('usuarios_negocio')
    .select('id, negocio_id, rol')
    .eq('supabase_user_id', authUserId)
    .in('rol', [...ROLES_AUTORIZADOS])
    .eq('activo', true)
    .maybeSingle();

  if (perfilError) {
    return { ok: false, status: 500, error: perfilError.message };
  }

  if (!perfil) {
    return {
      ok: false,
      status: 403,
      error: 'No tienes permiso para configurar el PIN de autorización.',
    };
  }

  return { ok: true, perfil };
}

async function verificarPerteneceNegocio(
  supabaseUser: SupabaseClient,
  authUserId: string,
  negocioId: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { data: perfil, error: perfilError } = await supabaseUser
    .from('usuarios_negocio')
    .select('id')
    .eq('supabase_user_id', authUserId)
    .eq('negocio_id', negocioId)
    .eq('activo', true)
    .maybeSingle();

  if (perfilError) {
    return { ok: false, status: 500, error: perfilError.message };
  }

  if (!perfil) {
    return {
      ok: false,
      status: 403,
      error: 'No tienes permiso para operar en este negocio.',
    };
  }

  return { ok: true };
}

interface NegocioPinEstado {
  pin_intentos_fallidos: number | null;
  pin_nivel_bloqueo: number | null;
  pin_bloqueado_hasta: string | null;
}

function obtenerBloqueoActivo(
  negocio: NegocioPinEstado
): { bloqueado: true; bloqueadoHasta: string } | { bloqueado: false } {
  if (!negocio.pin_bloqueado_hasta) {
    return { bloqueado: false };
  }

  const bloqueadoHastaMs = new Date(negocio.pin_bloqueado_hasta).getTime();
  if (!Number.isFinite(bloqueadoHastaMs) || bloqueadoHastaMs <= Date.now()) {
    return { bloqueado: false };
  }

  return { bloqueado: true, bloqueadoHasta: negocio.pin_bloqueado_hasta };
}

function calcularBloqueoEscalonado(nivelActual: number): {
  minutos: number;
  nuevoNivel: number;
} {
  if (nivelActual <= 0) {
    return { minutos: 1, nuevoNivel: 1 };
  }

  if (nivelActual === 1) {
    return { minutos: 5, nuevoNivel: 2 };
  }

  return { minutos: 15, nuevoNivel: 2 };
}

async function cargarEstadoPinNegocio(
  supabaseAdmin: SupabaseClient,
  negocioId: string
): Promise<
  | { ok: true; negocio: NegocioPinEstado }
  | { ok: false; error: string }
> {
  const { data, error } = await supabaseAdmin
    .from('negocios')
    .select('pin_intentos_fallidos, pin_nivel_bloqueo, pin_bloqueado_hasta')
    .eq('id', negocioId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }

  if (!data) {
    return { ok: false, error: 'Negocio no encontrado.' };
  }

  return { ok: true, negocio: data };
}

async function registrarIntentoFallido(
  supabaseAdmin: SupabaseClient,
  negocioId: string,
  negocio: NegocioPinEstado
): Promise<
  | { ok: true; bloqueado: false }
  | { ok: true; bloqueado: true; bloqueadoHasta: string }
  | { ok: false; error: string }
> {
  const intentosActuales = negocio.pin_intentos_fallidos ?? 0;
  const nuevosIntentos = intentosActuales + 1;

  if (nuevosIntentos >= 3) {
    const { minutos, nuevoNivel } = calcularBloqueoEscalonado(negocio.pin_nivel_bloqueo ?? 0);
    const bloqueadoHasta = new Date(Date.now() + minutos * 60 * 1000).toISOString();

    const { error } = await supabaseAdmin
      .from('negocios')
      .update({
        pin_intentos_fallidos: 0,
        pin_nivel_bloqueo: nuevoNivel,
        pin_bloqueado_hasta: bloqueadoHasta,
      })
      .eq('id', negocioId);

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true, bloqueado: true, bloqueadoHasta };
  }

  const { error } = await supabaseAdmin
    .from('negocios')
    .update({ pin_intentos_fallidos: nuevosIntentos })
    .eq('id', negocioId);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, bloqueado: false };
}

async function reiniciarEstadoPinNegocio(
  supabaseAdmin: SupabaseClient,
  negocioId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabaseAdmin
    .from('negocios')
    .update({
      pin_intentos_fallidos: 0,
      pin_nivel_bloqueo: 0,
      pin_bloqueado_hasta: null,
    })
    .eq('id', negocioId);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

async function handleConfigurar(
  supabaseAdmin: SupabaseClient,
  perfilId: string,
  body: PanelPinAutorizacionRequest
): Promise<Response> {
  const pin = body.pin?.trim() ?? '';

  if (!pinAutorizacionValido(pin)) {
    return jsonResponse(
      { success: false, error: 'El PIN debe ser numérico de exactamente 4 dígitos.' },
      400
    );
  }

  const pinAutorizacionHash = hashSync(pin, genSaltSync(BCRYPT_COST));

  const { error } = await supabaseAdmin
    .from('usuarios_negocio')
    .update({ pin_autorizacion_hash: pinAutorizacionHash })
    .eq('id', perfilId);

  if (error) {
    return jsonResponse({ success: false, error: error.message }, 500);
  }

  return jsonResponse({ success: true, data: { configurado: true } });
}

async function todosAutorizadoresSinPinConfigurado(
  supabaseAdmin: SupabaseClient,
  negocioId: string
): Promise<
  | { ok: true; sinConfigurar: true }
  | { ok: true; sinConfigurar: false }
  | { ok: false; error: string }
> {
  const { data: autorizadores, error } = await supabaseAdmin
    .from('usuarios_negocio')
    .select('pin_autorizacion_hash')
    .eq('negocio_id', negocioId)
    .in('rol', [...ROLES_AUTORIZADOS])
    .eq('activo', true);

  if (error) {
    return { ok: false, error: error.message };
  }

  const lista = autorizadores ?? [];
  const sinConfigurar =
    lista.length === 0 || lista.every((autorizador) => !autorizador.pin_autorizacion_hash);

  return { ok: true, sinConfigurar };
}

async function handleVerificar(
  supabaseAdmin: SupabaseClient,
  negocioId: string,
  body: PanelPinAutorizacionRequest
): Promise<Response> {
  const pin = body.pin?.trim() ?? '';

  const estadoPinNegocio = await todosAutorizadoresSinPinConfigurado(supabaseAdmin, negocioId);
  if (!estadoPinNegocio.ok) {
    return jsonResponse({ success: false, error: estadoPinNegocio.error }, 500);
  }

  if (estadoPinNegocio.sinConfigurar) {
    return jsonResponse({
      success: true,
      data: {
        autorizado: false,
        sin_configurar: true,
      },
    });
  }

  const estadoNegocio = await cargarEstadoPinNegocio(supabaseAdmin, negocioId);
  if (!estadoNegocio.ok) {
    return jsonResponse({ success: false, error: estadoNegocio.error }, 500);
  }

  const bloqueoActivo = obtenerBloqueoActivo(estadoNegocio.negocio);
  if (bloqueoActivo.bloqueado) {
    return jsonResponse({
      success: true,
      data: {
        autorizado: false,
        bloqueado: true,
        bloqueado_hasta: bloqueoActivo.bloqueadoHasta,
      },
    });
  }

  if (!pinAutorizacionValido(pin)) {
    return jsonResponse({
      success: true,
      data: { autorizado: false },
    });
  }

  const { data: autorizadores, error } = await supabaseAdmin
    .from('usuarios_negocio')
    .select('id, nombre, pin_autorizacion_hash')
    .eq('negocio_id', negocioId)
    .in('rol', [...ROLES_AUTORIZADOS])
    .eq('activo', true)
    .not('pin_autorizacion_hash', 'is', null);

  if (error) {
    return jsonResponse({ success: false, error: error.message }, 500);
  }

  for (const autorizador of autorizadores ?? []) {
    const hashGuardado = autorizador.pin_autorizacion_hash;
    if (!hashGuardado) continue;

    const coincide = compareSync(pin, hashGuardado);
    if (coincide) {
      const reinicio = await reiniciarEstadoPinNegocio(supabaseAdmin, negocioId);
      if (!reinicio.ok) {
        return jsonResponse({ success: false, error: reinicio.error }, 500);
      }

      return jsonResponse({
        success: true,
        data: {
          autorizado: true,
          autorizado_por: autorizador.id,
          nombre: autorizador.nombre,
        },
      });
    }
  }

  const registroFallo = await registrarIntentoFallido(
    supabaseAdmin,
    negocioId,
    estadoNegocio.negocio
  );
  if (!registroFallo.ok) {
    return jsonResponse({ success: false, error: registroFallo.error }, 500);
  }

  if (registroFallo.bloqueado) {
    return jsonResponse({
      success: true,
      data: {
        autorizado: false,
        bloqueado: true,
        bloqueado_hasta: registroFallo.bloqueadoHasta,
      },
    });
  }

  return jsonResponse({
    success: true,
    data: { autorizado: false },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Método no permitido.' }, 405);
  }

  let body: PanelPinAutorizacionRequest;

  try {
    body = (await req.json()) as PanelPinAutorizacionRequest;
  } catch {
    return jsonResponse({ success: false, error: 'Body JSON inválido.' }, 400);
  }

  const action = body.action;

  if (!action || !['configurar', 'verificar'].includes(action)) {
    return jsonResponse({ success: false, error: 'action inválida.' }, 400);
  }

  const auth = await crearClienteUsuario(req);
  if (!auth.ok) {
    return jsonResponse({ success: false, error: auth.error }, auth.status);
  }

  const supabaseAdmin = createAdminClient();
  if (!supabaseAdmin) {
    return jsonResponse(
      { success: false, error: 'Configuración de service role incompleta.' },
      500
    );
  }

  if (action === 'configurar') {
    const permiso = await verificarPermisoConfigurar(auth.supabaseUser, auth.authUserId);
    if (!permiso.ok) {
      return jsonResponse({ success: false, error: permiso.error }, permiso.status);
    }

    return handleConfigurar(supabaseAdmin, permiso.perfil.id, body);
  }

  const negocioId = body.negocio_id?.trim();
  if (!negocioId) {
    return jsonResponse({ success: false, error: 'negocio_id es obligatorio.' }, 400);
  }

  const pertenece = await verificarPerteneceNegocio(
    auth.supabaseUser,
    auth.authUserId,
    negocioId
  );
  if (!pertenece.ok) {
    return jsonResponse({ success: false, error: pertenece.error }, pertenece.status);
  }

  return handleVerificar(supabaseAdmin, negocioId, body);
});
