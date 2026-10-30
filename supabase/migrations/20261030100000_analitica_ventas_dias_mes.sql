-- Analítica diaria de ventas dentro de un mes. Usa la misma fecha de negocio que
-- public.obtener_analitica_ventas_mes
-- (20261027130000_analitica_ventas_mes.sql): apertura de jornada, o
-- created_at si el pedido no tiene jornada del mismo negocio.
-- No modifica esa función. Aplicar a mano en Supabase.
--
-- dias va del día 1 hasta el último día del mes (o hasta hoy si el mes es el
-- actual). Los días intermedios sin pedidos van en 0. Mes futuro: dias es [].
-- Sin pedidos en el mes, dias es [].

BEGIN;

CREATE OR REPLACE FUNCTION public.obtener_analitica_ventas_dias_mes(
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
  v_mes_actual date;
  v_fin date;
  v_dia_tope date;
  v_dias_en_mes integer;
  v_dia_actual integer;
  v_dias jsonb;
BEGIN
  IF p_negocio_id IS NULL
    OR p_negocio_id IS DISTINCT FROM public.usuario_negocio_id()
    OR coalesce(public.usuario_actual_es_admin_o_dueno(), false) IS NOT TRUE
  THEN
    RAISE EXCEPTION 'Acceso denegado al negocio solicitado'
      USING ERRCODE = '42501';
  END IF;

  v_hoy := (now() AT TIME ZONE v_zona)::date;
  v_mes_actual := date_trunc('month', v_hoy::timestamp)::date;

  IF p_mes IS NULL THEN
    v_mes := v_mes_actual;
  ELSE
    v_mes := date_trunc('month', p_mes::timestamp)::date;
  END IF;

  v_fin := (v_mes + interval '1 month')::date - 1;
  v_dias_en_mes := (v_fin - v_mes) + 1;

  IF v_mes = v_mes_actual THEN
    v_dia_actual := extract(day FROM v_hoy)::integer;
    v_dia_tope := v_hoy;
  ELSE
    v_dia_actual := NULL;
    v_dia_tope := v_fin;
  END IF;

  IF v_mes > v_mes_actual THEN
    RETURN jsonb_build_object(
      'mes', v_mes,
      'dia_actual', v_dia_actual,
      'dias_en_mes', v_dias_en_mes,
      'dias', '[]'::jsonb
    );
  END IF;

  WITH pedidos_del_mes AS (
    SELECT
      (
        CASE
          WHEN j.id IS NOT NULL THEN (j.abierta_en AT TIME ZONE v_zona)::date
          ELSE (p.created_at AT TIME ZONE v_zona)::date
        END
      ) AS fecha,
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
      ) BETWEEN v_mes AND v_dia_tope
  ),
  sumas AS (
    SELECT
      pm.fecha,
      coalesce(sum(coalesce(pm.total, 0)), 0)::numeric AS total
    FROM pedidos_del_mes pm
    GROUP BY pm.fecha
  ),
  arranque AS (
    SELECT exists(SELECT 1 FROM pedidos_del_mes) AS tiene_pedidos
  )
  SELECT
    CASE
      WHEN NOT a.tiene_pedidos THEN '[]'::jsonb
      ELSE coalesce((
        SELECT jsonb_agg(
          jsonb_build_object(
            'dia', extract(day FROM calendario.fecha)::integer,
            'fecha', calendario.fecha::date,
            'dow', extract(isodow FROM calendario.fecha)::integer,
            'total', public.reporte_ventas_redondear_moneda(coalesce(s.total, 0))
          )
          ORDER BY calendario.fecha
        )
        FROM generate_series(
          v_mes::timestamp,
          v_dia_tope::timestamp,
          interval '1 day'
        ) AS calendario(fecha)
        LEFT JOIN sumas s ON s.fecha = calendario.fecha::date
      ), '[]'::jsonb)
    END
  INTO v_dias
  FROM arranque a;

  RETURN jsonb_build_object(
    'mes', v_mes,
    'dia_actual', v_dia_actual,
    'dias_en_mes', v_dias_en_mes,
    'dias', coalesce(v_dias, '[]'::jsonb)
  );
END;
$function$;

COMMENT ON FUNCTION public.obtener_analitica_ventas_dias_mes(uuid, date) IS
  'Totales diarios del mes por fecha de negocio (apertura de jornada, o created_at si no hay jornada del mismo negocio). Solo dueño o administrador del negocio.';

-- obtener_reporte_ventas solo hace GRANT a authenticated. No tiene REVOKE.
-- Aquí se revoca PUBLIC y anon para que EXECUTE quede solo en authenticated,
-- aunque los privilegios por defecto de la base concedan EXECUTE a PUBLIC.
REVOKE ALL ON FUNCTION public.obtener_analitica_ventas_dias_mes(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.obtener_analitica_ventas_dias_mes(uuid, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.obtener_analitica_ventas_dias_mes(uuid, date) TO authenticated;

COMMIT;

-- Reversa (aplicar a mano):
-- DROP FUNCTION IF EXISTS public.obtener_analitica_ventas_dias_mes(uuid, date);
