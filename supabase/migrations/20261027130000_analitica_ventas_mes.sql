-- Analítica mensual de ventas. Depende de public.metas_ventas
-- (20261027120000_metas_ventas.sql) y de public.reporte_ventas_coincide_filtro,
-- que ya existe. No modifica esa función ni obtener_reporte_ventas.
-- Aplicar a mano en Supabase.
--
-- por_canal usa las claves de Reportes que no se traslapan:
-- caja, mostrador, whatsapp_domicilio, whatsapp_sucursal, mesas.
-- No incluye la clave whatsapp: esa junta domicilio y sucursal y duplicaría
-- esos dos canales. Un tipo distinto de presencial, mostrador, mesa, vacío
-- o whatsapp entra en total_vendido y total_pedidos, y no entra en por_canal.

BEGIN;

CREATE OR REPLACE FUNCTION public.obtener_analitica_ventas_mes(
  p_negocio_id uuid,
  p_mes date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_zona text := 'America/Merida';
  v_hoy date;
  v_mes date;
  v_fin date;
  v_dias_en_mes integer;
  v_dia_actual integer;
  v_meta numeric;
  v_total_vendido numeric;
  v_total_pedidos bigint;
  v_por_canal jsonb;
BEGIN
  IF p_negocio_id IS NULL
    OR p_negocio_id IS DISTINCT FROM public.usuario_negocio_id()
    OR coalesce(public.usuario_actual_es_admin_o_dueno(), false) IS NOT TRUE
  THEN
    RAISE EXCEPTION 'Acceso denegado al negocio solicitado'
      USING ERRCODE = '42501';
  END IF;

  v_hoy := (now() AT TIME ZONE v_zona)::date;

  IF p_mes IS NULL THEN
    v_mes := date_trunc('month', v_hoy::timestamp)::date;
  ELSE
    v_mes := date_trunc('month', p_mes::timestamp)::date;
  END IF;

  v_fin := (v_mes + interval '1 month')::date - 1;
  v_dias_en_mes := (v_fin - v_mes) + 1;

  IF v_mes = date_trunc('month', v_hoy::timestamp)::date THEN
    v_dia_actual := extract(day FROM v_hoy)::integer;
  ELSE
    v_dia_actual := NULL;
  END IF;

  SELECT mv.monto
  INTO v_meta
  FROM public.metas_ventas mv
  WHERE mv.negocio_id = p_negocio_id
    AND mv.mes = v_mes;

  WITH pedidos_del_mes AS (
    SELECT
      p.total,
      p.tipo,
      p.tipo_entrega
    FROM public.pedidos p
    LEFT JOIN public.jornadas j
      ON j.id = p.jornada_id
     AND j.negocio_id = p.negocio_id
    WHERE p.negocio_id = p_negocio_id
      AND p.deleted_at IS NULL
      AND (
        CASE
          WHEN j.id IS NOT NULL THEN (j.abierta_en AT TIME ZONE v_zona)::date
          ELSE (p.created_at AT TIME ZONE v_zona)::date
        END
      ) BETWEEN v_mes AND v_fin
  ),
  clasificados AS (
    SELECT
      CASE
        WHEN public.reporte_ventas_coincide_filtro(pm.tipo, pm.tipo_entrega, 'caja') THEN 'caja'
        WHEN public.reporte_ventas_coincide_filtro(pm.tipo, pm.tipo_entrega, 'mostrador') THEN 'mostrador'
        WHEN public.reporte_ventas_coincide_filtro(pm.tipo, pm.tipo_entrega, 'mesas') THEN 'mesas'
        WHEN public.reporte_ventas_coincide_filtro(pm.tipo, pm.tipo_entrega, 'whatsapp_sucursal') THEN 'whatsapp_sucursal'
        WHEN public.reporte_ventas_coincide_filtro(pm.tipo, pm.tipo_entrega, 'whatsapp_domicilio') THEN 'whatsapp_domicilio'
        ELSE NULL
      END AS canal,
      pm.total
    FROM pedidos_del_mes pm
  ),
  sumas AS (
    SELECT
      cl.canal,
      count(*)::bigint AS pedidos,
      coalesce(sum(coalesce(cl.total, 0)), 0)::numeric AS total
    FROM clasificados cl
    WHERE cl.canal IS NOT NULL
    GROUP BY cl.canal
  ),
  canales AS (
    SELECT *
    FROM (
      VALUES
        ('caja'::text, 1),
        ('mostrador'::text, 2),
        ('whatsapp_domicilio'::text, 3),
        ('whatsapp_sucursal'::text, 4),
        ('mesas'::text, 5)
    ) AS lista(canal, orden)
  )
  SELECT
    coalesce((SELECT count(*)::bigint FROM pedidos_del_mes), 0),
    coalesce((SELECT sum(coalesce(pm.total, 0)) FROM pedidos_del_mes pm), 0),
    coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'canal', c.canal,
          'total', public.reporte_ventas_redondear_moneda(coalesce(s.total, 0)),
          'pedidos', coalesce(s.pedidos, 0)
        )
        ORDER BY c.orden
      )
      FROM canales c
      LEFT JOIN sumas s ON s.canal = c.canal
    ), '[]'::jsonb)
  INTO v_total_pedidos, v_total_vendido, v_por_canal;

  RETURN jsonb_build_object(
    'mes', v_mes,
    'hoy', v_hoy,
    'dias_en_mes', v_dias_en_mes,
    'dia_actual', v_dia_actual,
    'meta', v_meta,
    'total_vendido', public.reporte_ventas_redondear_moneda(coalesce(v_total_vendido, 0)),
    'total_pedidos', coalesce(v_total_pedidos, 0),
    'por_canal', coalesce(v_por_canal, '[]'::jsonb)
  );
END;
$function$;

COMMENT ON FUNCTION public.obtener_analitica_ventas_mes(uuid, date) IS
  'Total vendido del mes por fecha de negocio (apertura de jornada, o created_at si no hay jornada del mismo negocio). Solo dueño o administrador del negocio.';

-- obtener_reporte_ventas solo hace GRANT a authenticated. No tiene REVOKE.
-- Aquí se revoca PUBLIC y anon para que EXECUTE quede solo en authenticated,
-- aunque los privilegios por defecto de la base concedan EXECUTE a PUBLIC.
REVOKE ALL ON FUNCTION public.obtener_analitica_ventas_mes(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.obtener_analitica_ventas_mes(uuid, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.obtener_analitica_ventas_mes(uuid, date) TO authenticated;

COMMIT;

-- Reversa (aplicar a mano):
-- DROP FUNCTION IF EXISTS public.obtener_analitica_ventas_mes(uuid, date);
