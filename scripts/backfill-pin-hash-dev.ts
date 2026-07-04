/**
 * Backfill de un solo uso: hashea pin_hash en texto plano en usuarios_negocio (DEV).
 *
 * NO ejecutar contra PROD.
 *
 * Uso:
 *   deno run --allow-env --allow-net scripts/backfill-pin-hash-dev.ts
 *   deno run --allow-env --allow-net scripts/backfill-pin-hash-dev.ts --execute
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { hashSync, genSaltSync } from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';

const BCRYPT_COST = 10;

const DEV_PROJECT_HINT =
  Deno.env.get('DEV_PROJECT_HINT') ?? 'saas-pedidos-dev';

interface UsuarioPinPlano {
  id: string;
  negocio_id: string;
  nombre: string;
  email: string | null;
  rol: string;
  pin_hash: string;
}

function esHashBcrypt(valor: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(valor);
}

function obtenerEnv(nombre: string): string {
  const valor = Deno.env.get(nombre)?.trim();
  if (!valor) {
    console.error(`Falta la variable de entorno ${nombre}.`);
    Deno.exit(1);
  }
  return valor;
}

function assertEntornoDev(): void {
  if (Deno.env.get('CONFIRM_DEV_BACKFILL') !== 'yes') {
    console.error(
      'Abortado: debes confirmar DEV con CONFIRM_DEV_BACKFILL=yes'
    );
    Deno.exit(1);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';

  if (/prod/i.test(supabaseUrl)) {
    console.error(
      'Abortado: SUPABASE_URL parece apuntar a PROD (contiene "prod").'
    );
    Deno.exit(1);
  }

  const hint = DEV_PROJECT_HINT.toLowerCase();
  const urlOk =
    supabaseUrl.toLowerCase().includes(hint) ||
    supabaseUrl.toLowerCase().includes('dev');

  if (!urlOk) {
    console.error(
      `Abortado: SUPABASE_URL no contiene "${DEV_PROJECT_HINT}" ni "dev".`
    );
    console.error(`URL actual: ${supabaseUrl}`);
    console.error(
      'Si es DEV, ajusta DEV_PROJECT_HINT o verifica que la URL sea la correcta.'
    );
    Deno.exit(1);
  }
}

async function main(): Promise<void> {
  assertEntornoDev();

  const ejecutar = Deno.args.includes('--execute');
  const supabaseUrl = obtenerEnv('SUPABASE_URL');
  const serviceRoleKey = obtenerEnv('SUPABASE_SERVICE_ROLE_KEY');

  console.log('Entorno:', supabaseUrl);
  console.log(
    ejecutar
      ? 'Modo: EJECUCIÓN (actualizará filas)'
      : 'Modo: DRY-RUN (solo lectura, sin updates)'
  );
  console.log('');

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from('usuarios_negocio')
    .select('id, negocio_id, nombre, email, rol, pin_hash')
    .not('pin_hash', 'is', null)
    .neq('pin_hash', '');

  if (error) {
    console.error('Error al leer usuarios_negocio:', error.message);
    Deno.exit(1);
  }

  const filas = (data ?? []).filter(
    (row): row is UsuarioPinPlano =>
      typeof row.pin_hash === 'string' && !esHashBcrypt(row.pin_hash)
  );

  if (filas.length === 0) {
    console.log('No hay filas con pin_hash en texto plano. Nada que hacer.');
    return;
  }

  console.log(`Filas con pin_hash en texto plano: ${filas.length}`);
  console.log('');

  for (const fila of filas) {
    const pinPlano = fila.pin_hash;
    const hashNuevo = hashSync(pinPlano, genSaltSync(BCRYPT_COST));

    console.log(`- id=${fila.id} rol=${fila.rol} email=${fila.email ?? '—'}`);
    console.log(`  pin_hash actual (plano): ${pinPlano}`);
    console.log(`  pin_hash nuevo (bcrypt): ${hashNuevo.slice(0, 20)}...`);

    if (!ejecutar) continue;

    const { error: updateError } = await supabase
      .from('usuarios_negocio')
      .update({ pin_hash: hashNuevo })
      .eq('id', fila.id);

    if (updateError) {
      console.error(`  ERROR al actualizar ${fila.id}:`, updateError.message);
      Deno.exit(1);
    }

    console.log('  OK actualizado');
  }

  console.log('');
  if (ejecutar) {
    console.log(`Backfill completado: ${filas.length} fila(s) actualizada(s).`);
  } else {
    console.log(
      'Dry-run terminado. Para aplicar cambios, vuelve a correr con --execute'
    );
  }
}

main();
