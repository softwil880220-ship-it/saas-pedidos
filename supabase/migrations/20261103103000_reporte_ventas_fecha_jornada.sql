-- Reversa (aplicar a mano si hace falta deshacer):
-- DROP FUNCTION IF EXISTS public.listar_pedidos_reporte_ventas_jornada(uuid, date, date);
-- DROP FUNCTION IF EXISTS public.obtener_reporte_ventas_jornada(uuid, date, date, text);
-- DROP FUNCTION IF EXISTS public.fecha_venta_negocio(timestamptz, timestamptz);

-- Reportes > Ventas (fase 1): funciones nuevas con fecha de negocio (jornada / Mérida).
-- No modifica obtener_reporte_ventas ni helpers reporte_ventas_* existentes.
-- Aplicar manualmente en DEV y luego en PROD vía Supabase SQL Editor.

BEGIN;

-- ---------------------------------------------------------------------------
-- Fecha de venta de negocio (misma regla que Analítica)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fecha_venta_negocio(
  p_created_at timestamptz,
  p_abierta_en timestamptz
)
RETURNS date
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN p_abierta_en IS NOT NULL THEN (p_abierta_en AT TIME ZONE 'America/Merida')::date
    ELSE (p_created_at AT TIME ZONE 'America/Merida')::date
  END;
$function$;

COMMENT ON FUNCTION public.fecha_venta_negocio(timestamptz, timestamptz) IS
  'Fecha calendario de venta en America/Merida: abierta_en de jornada si se pasa; si no, created_at del pedido.';

-- STABLE: convierte timestamptz con AT TIME ZONE (depende del catálogo de zonas, no es IMMUTABLE).

-- ---------------------------------------------------------------------------
-- Agregado de ventas (mismo jsonb que obtener_reporte_ventas)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.obtener_reporte_ventas_jornada(
  p_negocio_id uuid,
  p_fecha_desde date,
  p_fecha_hasta date,
  p_filtro_venta text DEFAULT 'todos'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_negocio_usuario uuid;
  v_total_pedidos bigint;
  v_monto_acumulado numeric;
  v_categorias jsonb;
  v_productos jsonb;
BEGIN
  v_negocio_usuario := public.usuario_negocio_id();

  IF p_negocio_id IS NULL OR v_negocio_usuario IS NULL OR p_negocio_id <> v_negocio_usuario THEN
    RAISE EXCEPTION 'Acceso denegado al negocio solicitado'
      USING ERRCODE = '42501';
  END IF;

  IF p_fecha_desde IS NULL OR p_fecha_hasta IS NULL THEN
    RETURN jsonb_build_object(
      'total_pedidos', 0,
      'monto_acumulado', 0,
      'categorias', '[]'::jsonb,
      'productos', '[]'::jsonb
    );
  END IF;

  WITH pedidos_filtrados AS (
    SELECT
      p.total,
      p.producto,
      p.lineas_detalle
    FROM public.pedidos p
    LEFT JOIN public.jornadas j
      ON j.id = p.jornada_id
     AND j.negocio_id = p.negocio_id
    WHERE p.negocio_id = p_negocio_id
      AND p.deleted_at IS NULL
      AND (
        CASE
          WHEN j.id IS NOT NULL THEN (j.abierta_en AT TIME ZONE 'America/Merida')::date
          ELSE (p.created_at AT TIME ZONE 'America/Merida')::date
        END
      ) BETWEEN p_fecha_desde AND p_fecha_hasta
      AND public.reporte_ventas_coincide_filtro(p.tipo, p.tipo_entrega, p_filtro_venta)
  ),
  resumen AS (
    SELECT
      count(*)::bigint AS total_pedidos,
      coalesce(sum(coalesce(pf.total, 0)), 0)::numeric AS monto_acumulado
    FROM pedidos_filtrados pf
  ),
  lineas_expandidas AS (
    SELECT
      public.reporte_ventas_resolver_categoria_linea(linea.value, p_negocio_id) AS categoria,
      public.reporte_ventas_cantidad_linea(linea.value) AS cantidad,
      public.reporte_ventas_subtotal_linea(linea.value) AS subtotal
    FROM pedidos_filtrados pf
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(pf.lineas_detalle) = 'array' THEN pf.lineas_detalle
        ELSE '[]'::jsonb
      END
    ) AS linea(value)
  ),
  categorias AS (
    SELECT
      le.categoria AS nombre,
      sum(le.cantidad) AS cantidad_vendida,
      public.reporte_ventas_redondear_moneda(sum(le.subtotal)) AS total_facturado
    FROM lineas_expandidas le
    GROUP BY le.categoria
  ),
  lineas_producto AS (
    SELECT
      public.reporte_ventas_clave_producto_linea(linea.value) AS clave,
      public.reporte_ventas_nombre_base_producto_linea(linea.value) AS nombre,
      public.reporte_ventas_cantidad_linea(linea.value) AS cantidad,
      public.reporte_ventas_subtotal_linea(linea.value) AS subtotal
    FROM pedidos_filtrados pf
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(pf.lineas_detalle) = 'array' THEN pf.lineas_detalle
        ELSE '[]'::jsonb
      END
    ) AS linea(value)
  ),
  legacy_producto AS (
    SELECT
      'resumen:' || btrim(pf.producto) AS clave,
      btrim(pf.producto) AS nombre,
      1::numeric AS cantidad,
      public.reporte_ventas_redondear_moneda(coalesce(pf.total, 0)) AS subtotal
    FROM pedidos_filtrados pf
    WHERE (
      jsonb_typeof(pf.lineas_detalle) <> 'array'
      OR jsonb_array_length(pf.lineas_detalle) = 0
    )
      AND nullif(btrim(coalesce(pf.producto, '')), '') IS NOT NULL
  ),
  lineas_agregadas AS (
    SELECT lp.clave, lp.nombre, lp.cantidad, lp.subtotal
    FROM lineas_producto lp

    UNION ALL

    SELECT lg.clave, lg.nombre, lg.cantidad, lg.subtotal
    FROM legacy_producto lg
  ),
  productos AS (
    SELECT
      min(la.nombre) AS nombre,
      sum(la.cantidad) AS cantidad_vendida,
      public.reporte_ventas_redondear_moneda(sum(la.subtotal)) AS total_facturado
    FROM lineas_agregadas la
    GROUP BY la.clave
  )
  SELECT
    r.total_pedidos,
    public.reporte_ventas_redondear_moneda(r.monto_acumulado),
    coalesce(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'nombre', c.nombre,
            'cantidad_vendida', c.cantidad_vendida,
            'total_facturado', c.total_facturado
          )
          ORDER BY lower(c.nombre)
        )
        FROM categorias c
      ),
      '[]'::jsonb
    ),
    coalesce(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'nombre', p.nombre,
            'cantidad_vendida', p.cantidad_vendida,
            'total_facturado', p.total_facturado
          )
          ORDER BY lower(p.nombre)
        )
        FROM productos p
      ),
      '[]'::jsonb
    )
  INTO v_total_pedidos, v_monto_acumulado, v_categorias, v_productos
  FROM resumen r;

  RETURN jsonb_build_object(
    'total_pedidos', coalesce(v_total_pedidos, 0),
    'monto_acumulado', coalesce(v_monto_acumulado, 0),
    'categorias', coalesce(v_categorias, '[]'::jsonb),
    'productos', coalesce(v_productos, '[]'::jsonb)
  );
END;
$function$;

COMMENT ON FUNCTION public.obtener_reporte_ventas_jornada(uuid, date, date, text) IS
  'Igual que obtener_reporte_ventas pero filtra por fecha de negocio (jornada.abierta_en o created_at en America/Merida).';

-- ---------------------------------------------------------------------------
-- Lista de pedidos para el reporte (equivalente a select * con filtro de fecha)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.listar_pedidos_reporte_ventas_jornada(
  p_negocio_id uuid,
  p_fecha_desde date,
  p_fecha_hasta date
)
RETURNS SETOF public.pedidos
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_negocio_usuario uuid;
BEGIN
  v_negocio_usuario := public.usuario_negocio_id();

  IF p_negocio_id IS NULL OR v_negocio_usuario IS NULL OR p_negocio_id <> v_negocio_usuario THEN
    RAISE EXCEPTION 'Acceso denegado al negocio solicitado'
      USING ERRCODE = '42501';
  END IF;

  IF p_fecha_desde IS NULL OR p_fecha_hasta IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.*
  FROM public.pedidos p
  LEFT JOIN public.jornadas j
    ON j.id = p.jornada_id
   AND j.negocio_id = p.negocio_id
  WHERE p.negocio_id = p_negocio_id
    AND p.deleted_at IS NULL
    AND (
      CASE
        WHEN j.id IS NOT NULL THEN (j.abierta_en AT TIME ZONE 'America/Merida')::date
        ELSE (p.created_at AT TIME ZONE 'America/Merida')::date
      END
    ) BETWEEN p_fecha_desde AND p_fecha_hasta
  ORDER BY p.created_at DESC;
END;
$function$;

COMMENT ON FUNCTION public.listar_pedidos_reporte_ventas_jornada(uuid, date, date) IS
  'Pedidos del reporte de ventas por fecha de negocio; aplica RLS de pedidos (SECURITY INVOKER).';

-- ---------------------------------------------------------------------------
-- Privilegios
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.fecha_venta_negocio(timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fecha_venta_negocio(timestamptz, timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.fecha_venta_negocio(timestamptz, timestamptz) TO authenticated;

REVOKE ALL ON FUNCTION public.obtener_reporte_ventas_jornada(uuid, date, date, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.obtener_reporte_ventas_jornada(uuid, date, date, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.obtener_reporte_ventas_jornada(uuid, date, date, text) TO authenticated;

REVOKE ALL ON FUNCTION public.listar_pedidos_reporte_ventas_jornada(uuid, date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.listar_pedidos_reporte_ventas_jornada(uuid, date, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.listar_pedidos_reporte_ventas_jornada(uuid, date, date) TO authenticated;

COMMIT;
