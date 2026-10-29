-- Analítica anual de ventas, mes a mes. Usa la misma fecha de negocio que
-- public.obtener_analitica_ventas_mes
-- (20261027130000_analitica_ventas_mes.sql): apertura de jornada, o
-- created_at si el pedido no tiene jornada del mismo negocio.
-- No modifica esa función. Aplicar a mano en Supabase.
--
-- meses va del primer mes del año con pedidos hasta el mes en curso
-- (o hasta diciembre, si el año no es el actual). Los meses intermedios
-- sin pedidos van en 0. Sin pedidos en ese rango, meses es [].

BEGIN;

CREATE OR REPLACE FUNCTION public.obtener_analitica_ventas_anio(
  p_negocio_id uuid,
  p_anio int DEFAULT NULL
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
  v_anio int;
  v_mes_actual date;
  v_mes_tope date;
  v_inicio_anio date;
  v_fin_rango date;
  v_meses jsonb;
BEGIN
  IF p_negocio_id IS NULL
    OR p_negocio_id IS DISTINCT FROM public.usuario_negocio_id()
    OR coalesce(public.usuario_actual_es_admin_o_dueno(), false) IS NOT TRUE
  THEN
    RAISE EXCEPTION 'Acceso denegado al negocio solicitado'
      USING ERRCODE = '42501';
  END IF;

  v_hoy := (now() AT TIME ZONE v_zona)::date;
  v_anio := coalesce(p_anio, extract(year FROM v_hoy)::int);

  IF v_anio = extract(year FROM v_hoy)::int THEN
    v_mes_actual := date_trunc('month', v_hoy::timestamp)::date;
    v_mes_tope := v_mes_actual;
  ELSE
    v_mes_actual := NULL;
    v_mes_tope := make_date(v_anio, 12, 1);
  END IF;

  v_inicio_anio := make_date(v_anio, 1, 1);
  v_fin_rango := (v_mes_tope + interval '1 month')::date - 1;

  WITH pedidos_del_rango AS (
    SELECT
      date_trunc(
        'month',
        (
          CASE
            WHEN j.id IS NOT NULL THEN (j.abierta_en AT TIME ZONE v_zona)::date
            ELSE (p.created_at AT TIME ZONE v_zona)::date
          END
        )::timestamp
      )::date AS mes,
      p.total
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
      ) BETWEEN v_inicio_anio AND v_fin_rango
  ),
  sumas AS (
    SELECT
      pr.mes,
      coalesce(sum(coalesce(pr.total, 0)), 0)::numeric AS total
    FROM pedidos_del_rango pr
    GROUP BY pr.mes
  ),
  arranque AS (
    SELECT min(s.mes) AS mes_inicio
    FROM sumas s
  )
  SELECT
    CASE
      WHEN a.mes_inicio IS NULL OR a.mes_inicio > v_mes_tope THEN '[]'::jsonb
      ELSE coalesce((
        SELECT jsonb_agg(
          jsonb_build_object(
            'mes', calendario.mes::date,
            'total', public.reporte_ventas_redondear_moneda(coalesce(s.total, 0))
          )
          ORDER BY calendario.mes
        )
        FROM generate_series(
          a.mes_inicio::timestamp,
          v_mes_tope::timestamp,
          interval '1 month'
        ) AS calendario(mes)
        LEFT JOIN sumas s ON s.mes = calendario.mes::date
      ), '[]'::jsonb)
    END
  INTO v_meses
  FROM arranque a;

  RETURN jsonb_build_object(
    'anio', v_anio,
    'mes_actual', v_mes_actual,
    'meses', coalesce(v_meses, '[]'::jsonb)
  );
END;
$function$;

COMMENT ON FUNCTION public.obtener_analitica_ventas_anio(uuid, int) IS
  'Totales mensuales del año por fecha de negocio (apertura de jornada, o created_at si no hay jornada del mismo negocio). Solo dueño o administrador del negocio.';

-- obtener_reporte_ventas solo hace GRANT a authenticated. No tiene REVOKE.
-- Aquí se revoca PUBLIC y anon para que EXECUTE quede solo en authenticated,
-- aunque los privilegios por defecto de la base concedan EXECUTE a PUBLIC.
REVOKE ALL ON FUNCTION public.obtener_analitica_ventas_anio(uuid, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.obtener_analitica_ventas_anio(uuid, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.obtener_analitica_ventas_anio(uuid, int) TO authenticated;

COMMIT;

-- Reversa (aplicar a mano):
-- DROP FUNCTION IF EXISTS public.obtener_analitica_ventas_anio(uuid, int);
