-- =============================================================================
-- Verificación manual: RLS inventario bloquea INSERT cross-tenant (FK hijas)
-- =============================================================================
-- Ejecutar en Supabase SQL Editor (DEV), como usuario con acceso SQL.
--
-- IMPORTANTE — Simular sesión authenticated del negocio A:
--   Las políticas usan auth.uid() → usuario_negocio_id(). Si corres como
--   postgres/superuser sin configurar JWT, RLS se omite y las pruebas no valen.
--
-- Requisitos previos:
--   • Negocio A: habilitar_inventario = true
--   • {{USUARIO_AUTH_NEGOCIO_A}} = auth.users.id vinculado a negocio A
--     (usuarios.id o usuarios_negocio.supabase_user_id)
--   • {{CREADO_POR_NEGOCIO_A}} = usuarios_negocio.id de un usuario del negocio A
--   • Negocio B ≠ A, con registros reales en catálogos/jornadas (placeholders abajo)
--
-- Resultado esperado por bloque: NOTICE "... OK — RLS bloqueó ..."
-- Si ves "... PRUEBA FALLIDA: el INSERT cross-tenant no fue bloqueado", el fix no aplica.
--
-- Al final: ROLLBACK (no persiste filas de prueba).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- (Opcional) Consultas para obtener UUIDs — ejecuta aparte, copia resultados
-- -----------------------------------------------------------------------------
/*
-- Negocios
SELECT id, nombre, habilitar_inventario FROM public.negocios ORDER BY nombre;

-- Usuario auth ↔ negocio (elige fila del negocio A)
SELECT un.id AS creado_por_id, un.nombre, un.negocio_id, un.supabase_user_id AS auth_uid
FROM public.usuarios_negocio un
WHERE un.negocio_id = '{{NEGOCIO_A}}'::uuid;

-- Insumo / producto / empleado / jornada del negocio B
SELECT id, nombre, negocio_id FROM public.insumos WHERE negocio_id = '{{NEGOCIO_B}}'::uuid LIMIT 3;
SELECT id, nombre, negocio_id FROM public.productos WHERE negocio_id = '{{NEGOCIO_B}}'::uuid LIMIT 3;
SELECT id, nombre, negocio_id FROM public.empleados WHERE negocio_id = '{{NEGOCIO_B}}'::uuid LIMIT 3;
SELECT id, estado, negocio_id, abierta_en FROM public.jornadas WHERE negocio_id = '{{NEGOCIO_B}}'::uuid ORDER BY abierta_en DESC LIMIT 3;

-- item_variante del negocio B (vía categoría)
SELECT iv.id AS item_variante_id, iv.nombre, cv.negocio_id
FROM public.items_variantes iv
JOIN public.categorias_variantes cv ON cv.id = iv.categoria_id
WHERE cv.negocio_id = '{{NEGOCIO_B}}'::uuid
LIMIT 3;
*/

-- =============================================================================
-- Placeholders — reemplaza todos antes de ejecutar
-- =============================================================================
-- {{NEGOCIO_A}}              UUID del tenant desde el que “actúas”
-- {{NEGOCIO_B}}              UUID de otro tenant (B ≠ A)
-- {{USUARIO_AUTH_NEGOCIO_A}} UUID auth.users (supabase_user_id en usuarios_negocio)
-- {{CREADO_POR_NEGOCIO_A}}   UUID usuarios_negocio.id (negocio A)
-- {{INSUMO_ID_NEGOCIO_B}}    insumos.id del negocio B
-- {{PRODUCTO_ID_NEGOCIO_B}}  productos.id (bigint) del negocio B
-- {{JORNADA_ID_NEGOCIO_B}}   jornadas.id del negocio B
-- {{EMPLEADO_ID_NEGOCIO_B}}  empleados.id del negocio B
-- {{ITEM_VARIANTE_ID_NEGOCIO_B}} items_variantes.id cuya categoría es del negocio B

BEGIN;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '{{USUARIO_AUTH_NEGOCIO_A}}', true);

DO $precheck$
DECLARE
  v_negocio uuid;
  v_modulo boolean;
BEGIN
  v_negocio := public.usuario_negocio_id();
  IF v_negocio IS NULL THEN
    RAISE EXCEPTION 'Pre-check fallido: usuario_negocio_id() es NULL. Revisa {{USUARIO_AUTH_NEGOCIO_A}}.';
  END IF;
  IF v_negocio::text <> '{{NEGOCIO_A}}' THEN
    RAISE EXCEPTION 'Pre-check fallido: usuario_negocio_id() = %, se esperaba {{NEGOCIO_A}}', v_negocio;
  END IF;
  SELECT COALESCE(public.negocio_modulo_habilitado('inventario'), false) INTO v_modulo;
  IF NOT v_modulo THEN
    RAISE EXCEPTION 'Pre-check fallido: inventario no habilitado para negocio A.';
  END IF;
  RAISE NOTICE 'Pre-check OK — auth simula negocio A (%), módulo inventario activo.', v_negocio;
END $precheck$;

-- -----------------------------------------------------------------------------
-- 1) insumo_recetas — FKs: producto_id, insumo_id (ambas del negocio B)
-- -----------------------------------------------------------------------------
DO $test$
BEGIN
  INSERT INTO public.insumo_recetas (
    negocio_id,
    producto_id,
    insumo_id,
    cantidad_por_producto
  ) VALUES (
    '{{NEGOCIO_A}}'::uuid,
    {{PRODUCTO_ID_NEGOCIO_B}},
    '{{INSUMO_ID_NEGOCIO_B}}'::uuid,
    1
  );
  RAISE EXCEPTION '[insumo_recetas] PRUEBA FALLIDA: el INSERT cross-tenant no fue bloqueado';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM LIKE '%row-level security%'
      OR SQLERRM LIKE '%violates row-level security%'
      OR SQLSTATE = '42501'
    THEN
      RAISE NOTICE '[insumo_recetas] OK — RLS bloqueó: %', SQLERRM;
    ELSE
      RAISE NOTICE '[insumo_recetas] Error (revisar si es RLS): % [%]', SQLERRM, SQLSTATE;
      RAISE;
    END IF;
END $test$;

-- -----------------------------------------------------------------------------
-- 2) inventario_cargas — FKs: jornada_id, insumo_id (negocio B)
-- -----------------------------------------------------------------------------
DO $test$
BEGIN
  INSERT INTO public.inventario_cargas (
    negocio_id,
    jornada_id,
    insumo_id,
    cantidad,
    tipo,
    creado_por
  ) VALUES (
    '{{NEGOCIO_A}}'::uuid,
    '{{JORNADA_ID_NEGOCIO_B}}'::uuid,
    '{{INSUMO_ID_NEGOCIO_B}}'::uuid,
    1,
    'carga_inicial',
    '{{CREADO_POR_NEGOCIO_A}}'::uuid
  );
  RAISE EXCEPTION '[inventario_cargas] PRUEBA FALLIDA: el INSERT cross-tenant no fue bloqueado';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM LIKE '%row-level security%'
      OR SQLERRM LIKE '%violates row-level security%'
      OR SQLSTATE = '42501'
    THEN
      RAISE NOTICE '[inventario_cargas] OK — RLS bloqueó: %', SQLERRM;
    ELSE
      RAISE NOTICE '[inventario_cargas] Error (revisar si es RLS): % [%]', SQLERRM, SQLSTATE;
      RAISE;
    END IF;
END $test$;

-- -----------------------------------------------------------------------------
-- 3) inventario_consumo_interno — FKs: jornada_id, producto_id, empleado_id (B)
-- -----------------------------------------------------------------------------
DO $test$
BEGIN
  INSERT INTO public.inventario_consumo_interno (
    negocio_id,
    jornada_id,
    empleado_id,
    producto_id,
    cantidad,
    creado_por
  ) VALUES (
    '{{NEGOCIO_A}}'::uuid,
    '{{JORNADA_ID_NEGOCIO_B}}'::uuid,
    '{{EMPLEADO_ID_NEGOCIO_B}}'::uuid,
    {{PRODUCTO_ID_NEGOCIO_B}},
    1,
    '{{CREADO_POR_NEGOCIO_A}}'::uuid
  );
  RAISE EXCEPTION '[inventario_consumo_interno] PRUEBA FALLIDA: el INSERT cross-tenant no fue bloqueado';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM LIKE '%row-level security%'
      OR SQLERRM LIKE '%violates row-level security%'
      OR SQLSTATE = '42501'
    THEN
      RAISE NOTICE '[inventario_consumo_interno] OK — RLS bloqueó: %', SQLERRM;
    ELSE
      RAISE NOTICE '[inventario_consumo_interno] Error (revisar si es RLS): % [%]', SQLERRM, SQLSTATE;
      RAISE;
    END IF;
END $test$;

-- -----------------------------------------------------------------------------
-- 4) insumo_recetas_variantes — FKs: item_variante_id, insumo_id (negocio B)
-- -----------------------------------------------------------------------------
DO $test$
BEGIN
  INSERT INTO public.insumo_recetas_variantes (
    negocio_id,
    item_variante_id,
    insumo_id,
    cantidad_por_extra
  ) VALUES (
    '{{NEGOCIO_A}}'::uuid,
    '{{ITEM_VARIANTE_ID_NEGOCIO_B}}'::uuid,
    '{{INSUMO_ID_NEGOCIO_B}}'::uuid,
    1
  );
  RAISE EXCEPTION '[insumo_recetas_variantes] PRUEBA FALLIDA: el INSERT cross-tenant no fue bloqueado';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM LIKE '%row-level security%'
      OR SQLERRM LIKE '%violates row-level security%'
      OR SQLSTATE = '42501'
    THEN
      RAISE NOTICE '[insumo_recetas_variantes] OK — RLS bloqueó: %', SQLERRM;
    ELSE
      RAISE NOTICE '[insumo_recetas_variantes] Error (revisar si es RLS): % [%]', SQLERRM, SQLSTATE;
      RAISE;
    END IF;
END $test$;

-- -----------------------------------------------------------------------------
-- 5) inventario_snapshots — FK: jornada_id (negocio B)
-- -----------------------------------------------------------------------------
DO $test$
BEGIN
  INSERT INTO public.inventario_snapshots (
    negocio_id,
    jornada_id,
    detalle,
    creado_por
  ) VALUES (
    '{{NEGOCIO_A}}'::uuid,
    '{{JORNADA_ID_NEGOCIO_B}}'::uuid,
    '[]'::jsonb,
    '{{CREADO_POR_NEGOCIO_A}}'::uuid
  );
  RAISE EXCEPTION '[inventario_snapshots] PRUEBA FALLIDA: el INSERT cross-tenant no fue bloqueado';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM LIKE '%row-level security%'
      OR SQLERRM LIKE '%violates row-level security%'
      OR SQLSTATE = '42501'
    THEN
      RAISE NOTICE '[inventario_snapshots] OK — RLS bloqueó: %', SQLERRM;
    ELSE
      RAISE NOTICE '[inventario_snapshots] Error (revisar si es RLS): % [%]', SQLERRM, SQLSTATE;
      RAISE;
    END IF;
END $test$;

ROLLBACK;

-- =============================================================================
-- Tras ejecutar, en el panel de Messages deberías ver:
--   Pre-check OK
--   [insumo_recetas] OK — RLS bloqueó ...
--   [inventario_cargas] OK — RLS bloqueó ...
--   [inventario_consumo_interno] OK — RLS bloqueó ...
--   [insumo_recetas_variantes] OK — RLS bloqueó ...
--   [inventario_snapshots] OK — RLS bloqueó ...
-- =============================================================================
