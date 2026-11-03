-- =============================================================================
-- Verificación manual: reporte ventas por fecha de jornada (fase 1 SQL)
-- =============================================================================
-- Ejecutar en Supabase SQL Editor (DEV). Cada bloque (a, b, c) es independiente:
-- copia SOLO un bloque BEGIN…ROLLBACK y ejecútalo por separado.
--
-- Antes de ejecutar, reemplaza en el bloque que vayas a correr:
--   • UID de auth.users (dueño/admin del negocio, o usuario de otro negocio en b)
--   • negocio_id (UUID del tenant)
--   • fecha_desde / fecha_hasta (date, inclusive; fecha de negocio America/Merida)
--   • filtro_venta (p. ej. 'todos')
--
-- El editor no muestra RAISE NOTICE; cada bloque termina en RAISE EXCEPTION
-- 'RESULTADO …' para ver el outcome en el panel de resultados.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- (a) Comparación viejo vs nuevo + conteo de lista
-- ---------------------------------------------------------------------------
BEGIN;

DO $bloque_a$
DECLARE
  -- Reemplazar:
  v_auth_sub text := '00000000-0000-0000-0000-000000000001';
  v_negocio uuid := '00000000-0000-0000-0000-000000000010'::uuid;
  v_desde date := '2026-10-01'::date;
  v_hasta date := '2026-10-31'::date;
  v_filtro text := 'todos';

  v_inicio timestamptz;
  v_fin timestamptz;
  v_viejo jsonb;
  v_nuevo jsonb;
  v_pedidos_viejo bigint;
  v_pedidos_nuevo bigint;
  v_monto_viejo numeric;
  v_monto_nuevo numeric;
  v_lista bigint;
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_auth_sub, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';

  v_inicio := (v_desde::timestamp AT TIME ZONE 'America/Merida');
  v_fin := ((v_hasta + 1)::timestamp AT TIME ZONE 'America/Merida') - interval '1 microsecond';

  v_viejo := public.obtener_reporte_ventas(v_negocio, v_inicio, v_fin, v_filtro);
  v_nuevo := public.obtener_reporte_ventas_jornada(v_negocio, v_desde, v_hasta, v_filtro);

  v_pedidos_viejo := coalesce((v_viejo->>'total_pedidos')::bigint, 0);
  v_pedidos_nuevo := coalesce((v_nuevo->>'total_pedidos')::bigint, 0);
  v_monto_viejo := coalesce((v_viejo->>'monto_acumulado')::numeric, 0);
  v_monto_nuevo := coalesce((v_nuevo->>'monto_acumulado')::numeric, 0);

  SELECT count(*)::bigint
  INTO v_lista
  FROM public.listar_pedidos_reporte_ventas_jornada(v_negocio, v_desde, v_hasta);

  RAISE EXCEPTION
    'RESULTADO comparacion: viejo pedidos=% monto=% | nuevo pedidos=% monto=% | diff pedidos=% diff monto=% | lista_jornada=% filas',
    v_pedidos_viejo,
    v_monto_viejo,
    v_pedidos_nuevo,
    v_monto_nuevo,
    v_pedidos_nuevo - v_pedidos_viejo,
    v_monto_nuevo - v_monto_viejo,
    v_lista;
END $bloque_a$;

ROLLBACK;

-- ---------------------------------------------------------------------------
-- (b) Rechazo entre negocios (42501 en resumen y lista)
-- ---------------------------------------------------------------------------
BEGIN;

DO $bloque_b$
DECLARE
  -- Reemplazar: usuario auth de negocio B pidiendo datos de negocio A
  v_auth_sub_otro text := '00000000-0000-0000-0000-000000000002';
  v_negocio_a uuid := '00000000-0000-0000-0000-000000000010'::uuid;
  v_desde date := '2026-10-01'::date;
  v_hasta date := '2026-10-31'::date;
  v_filtro text := 'todos';

  v_resumen_ok boolean := false;
  v_lista_ok boolean := false;
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_auth_sub_otro, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';

  BEGIN
    PERFORM public.obtener_reporte_ventas_jornada(v_negocio_a, v_desde, v_hasta, v_filtro);
  EXCEPTION
    WHEN SQLSTATE '42501' THEN
      v_resumen_ok := true;
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%Acceso denegado al negocio solicitado%' THEN
        v_resumen_ok := true;
      ELSE
        RAISE;
      END IF;
  END;

  BEGIN
    PERFORM 1
    FROM public.listar_pedidos_reporte_ventas_jornada(v_negocio_a, v_desde, v_hasta)
    LIMIT 1;
  EXCEPTION
    WHEN SQLSTATE '42501' THEN
      v_lista_ok := true;
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%Acceso denegado al negocio solicitado%' THEN
        v_lista_ok := true;
      ELSE
        RAISE;
      END IF;
  END;

  IF v_resumen_ok AND v_lista_ok THEN
    RAISE EXCEPTION 'RESULTADO acceso cruzado: resumen=OK rechazado | lista=OK rechazado';
  END IF;

  RAISE EXCEPTION 'RESULTADO acceso cruzado FALLO: resumen=% lista=%',
    CASE WHEN v_resumen_ok THEN 'OK rechazado' ELSE 'FALLO' END,
    CASE WHEN v_lista_ok THEN 'OK rechazado' ELSE 'FALLO' END;
END $bloque_b$;

ROLLBACK;

-- ---------------------------------------------------------------------------
-- (c) anon sin privilegio EXECUTE
-- ---------------------------------------------------------------------------
BEGIN;

DO $bloque_c$
DECLARE
  v_negocio uuid := '00000000-0000-0000-0000-000000000010'::uuid;
  v_desde date := '2026-10-01'::date;
  v_hasta date := '2026-10-31'::date;
  v_anon_bloqueado boolean := false;
BEGIN
  EXECUTE 'SET LOCAL ROLE anon';

  BEGIN
    PERFORM public.obtener_reporte_ventas_jornada(v_negocio, v_desde, v_hasta, 'todos');
  EXCEPTION
    WHEN insufficient_privilege THEN
      v_anon_bloqueado := true;
    WHEN OTHERS THEN
      IF SQLERRM ILIKE '%permission denied%' THEN
        v_anon_bloqueado := true;
      ELSE
        RAISE;
      END IF;
  END;

  IF v_anon_bloqueado THEN
    RAISE EXCEPTION 'RESULTADO anon: OK sin EXECUTE (permission denied)';
  END IF;

  RAISE EXCEPTION 'RESULTADO anon FALLO: anon pudo ejecutar obtener_reporte_ventas_jornada';
END $bloque_c$;

ROLLBACK;
