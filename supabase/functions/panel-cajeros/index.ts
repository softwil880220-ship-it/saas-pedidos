import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ROLES_AUTORIZADOS = ['dueno', 'administrador'] as const;
const ROLES_CREATABLE = [
  'cajero',
  'cocina',
  'cocina2',
  'repartidor',
  'administrador',
  'mesero',
] as const;

type Action = 'list' | 'create' | 'toggle';

interface PanelCajerosRequest {
  action?: Action;
  negocio_id?: string;
  email?: string;
  nombre?: string;
  rol?: string;
  username?: string | null;
  pin?: string | null;
  usuario_id?: string;
  activo?: boolean;
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

async function verificarPermisoPanel(
  req: Request,
  negocioId: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const authHeader = req.headers.get('Authorization');

  if (!authHeader) {
    return { ok: false, status: 401, error: 'Falta el header Authorization.' };
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
  } = await supabaseUser.auth.getUser();

  if (userError || !user) {
    return { ok: false, status: 401, error: 'Token inválido o expirado.' };
  }

  const { data: perfil, error: perfilError } = await supabaseUser
    .from('usuarios_negocio')
    .select('id, rol')
    .eq('supabase_user_id', user.id)
    .eq('negocio_id', negocioId)
    .in('rol', [...ROLES_AUTORIZADOS])
    .maybeSingle();

  if (perfilError) {
    return { ok: false, status: 500, error: perfilError.message };
  }

  if (!perfil) {
    return {
      ok: false,
      status: 403,
      error: 'No tienes permiso para administrar usuarios de este negocio.',
    };
  }

  return { ok: true };
}

async function handleList(
  supabaseAdmin: SupabaseClient,
  negocioId: string
): Promise<Response> {
  const { data, error } = await supabaseAdmin
    .from('usuarios_negocio')
    .select('id, negocio_id, rol, nombre, email, activo')
    .eq('negocio_id', negocioId)
    .order('nombre', { ascending: true });

  if (error) {
    return jsonResponse({ success: false, error: error.message }, 500);
  }

  return jsonResponse({ success: true, data: data ?? [] });
}

function pinValido(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

async function handleCreate(
  supabaseAdmin: SupabaseClient,
  negocioId: string,
  body: PanelCajerosRequest
): Promise<Response> {
  const nombre = body.nombre?.trim();
  const email = body.email?.trim().toLowerCase();
  const rol = body.rol?.trim();
  const pin = body.pin?.trim() ?? '';
  const username = body.username?.trim() || null;

  if (!nombre) {
    return jsonResponse({ success: false, error: 'El nombre es obligatorio.' }, 400);
  }

  if (!email) {
    return jsonResponse({ success: false, error: 'El correo es obligatorio.' }, 400);
  }

  if (!rol || !ROLES_CREATABLE.includes(rol as (typeof ROLES_CREATABLE)[number])) {
    return jsonResponse({ success: false, error: 'Rol inválido.' }, 400);
  }

  if (!pinValido(pin)) {
    return jsonResponse(
      { success: false, error: 'El PIN debe ser numérico de 4 a 6 dígitos.' },
      400
    );
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: pin,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    return jsonResponse(
      { success: false, error: authError?.message ?? 'No se pudo crear el usuario en auth.' },
      500
    );
  }

  const { data: insertData, error: insertError } = await supabaseAdmin
    .from('usuarios_negocio')
    .insert({
      negocio_id: negocioId,
      rol,
      nombre,
      email,
      username,
      supabase_user_id: authData.user.id,
      pin_hash: pin,
      activo: true,
    })
    .select('id, negocio_id, rol, nombre, email, activo')
    .single();

  if (insertError) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    return jsonResponse({ success: false, error: insertError.message }, 500);
  }

  return jsonResponse({ success: true, data: insertData });
}

async function handleToggle(
  supabaseAdmin: SupabaseClient,
  negocioId: string,
  body: PanelCajerosRequest
): Promise<Response> {
  const usuarioId = body.usuario_id?.trim();
  const activo = body.activo;

  if (!usuarioId) {
    return jsonResponse({ success: false, error: 'usuario_id es obligatorio.' }, 400);
  }

  if (typeof activo !== 'boolean') {
    return jsonResponse({ success: false, error: 'activo debe ser boolean.' }, 400);
  }

  const { data, error } = await supabaseAdmin
    .from('usuarios_negocio')
    .update({ activo })
    .eq('id', usuarioId)
    .eq('negocio_id', negocioId)
    .select('id, negocio_id, rol, nombre, email, activo')
    .maybeSingle();

  if (error) {
    return jsonResponse({ success: false, error: error.message }, 500);
  }

  if (!data) {
    return jsonResponse({ success: false, error: 'Usuario no encontrado.' }, 404);
  }

  return jsonResponse({ success: true, data });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Método no permitido.' }, 405);
  }

  let body: PanelCajerosRequest;

  try {
    body = (await req.json()) as PanelCajerosRequest;
  } catch {
    return jsonResponse({ success: false, error: 'Body JSON inválido.' }, 400);
  }

  const action = body.action;
  const negocioId = body.negocio_id?.trim();

  if (!action || !['list', 'create', 'toggle'].includes(action)) {
    return jsonResponse({ success: false, error: 'action inválida.' }, 400);
  }

  if (!negocioId) {
    return jsonResponse({ success: false, error: 'negocio_id es obligatorio.' }, 400);
  }

  const permiso = await verificarPermisoPanel(req, negocioId);
  if (!permiso.ok) {
    return jsonResponse({ success: false, error: permiso.error }, permiso.status);
  }

  const supabaseAdmin = createAdminClient();
  if (!supabaseAdmin) {
    return jsonResponse(
      { success: false, error: 'Configuración de service role incompleta.' },
      500
    );
  }

  switch (action) {
    case 'list':
      return handleList(supabaseAdmin, negocioId);
    case 'create':
      return handleCreate(supabaseAdmin, negocioId, body);
    case 'toggle':
      return handleToggle(supabaseAdmin, negocioId, body);
    default:
      return jsonResponse({ success: false, error: 'action inválida.' }, 400);
  }
});
