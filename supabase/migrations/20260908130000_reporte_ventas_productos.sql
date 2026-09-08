-- Extensión de obtener_reporte_ventas: desglose por producto.
-- Aplicar manualmente en DEV y luego en PROD vía Supabase SQL Editor.
-- Requiere que ya existan los helpers reporte_ventas_* y obtener_reporte_ventas base.
-- Replica calcularReportePorProducto (reportesHelpers.js).

CREATE OR REPLACE FUNCTION public.reporte_ventas_nombre_base_producto_linea(p_linea jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_nombre text;
  v_texto text;
  v_pos integer;
BEGIN
  v_nombre := nullif(btrim(coalesce(p_linea->>'nombre', '')), '');

  IF v_nombre IS NOT NULL THEN
    RETURN v_nombre;
  END IF;

  v_texto := btrim(coalesce(p_linea->>'descripcion', ''));

  IF v_texto = '' THEN
    RETURN 'Producto';
  END IF;

  v_pos := position(' (' IN v_texto);

  IF v_pos > 0 THEN
    RETURN btrim(substring(v_texto FROM 1 FOR v_pos - 1));
  END IF;

  RETURN v_texto;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reporte_ventas_clave_producto_linea(p_linea jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_producto_id text;
BEGIN
  v_producto_id := nullif(btrim(coalesce(p_linea->>'productoId', p_linea->>'producto_id', '')), '');

  IF v_producto_id IS NOT NULL THEN
    RETURN 'id:' || v_producto_id;
  END IF;

  RETURN 'nombre:' || lower(public.reporte_ventas_nombre_base_producto_linea(p_linea));
END;
$function$;

CREATE OR REPLACE FUNCTION public.obtener_reporte_ventas(
  p_negocio_id uuid,
  p_fecha_inicio timestamptz,
  p_fecha_fin timestamptz,
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

  IF p_fecha_inicio IS NULL OR p_fecha_fin IS NULL THEN
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
    WHERE p.negocio_id = p_negocio_id
      AND p.deleted_at IS NULL
      AND p.created_at >= p_fecha_inicio
      AND p.created_at <= p_fecha_fin
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

COMMENT ON FUNCTION public.obtener_reporte_ventas(uuid, timestamptz, timestamptz, text) IS
'Agrega el reporte de Ventas (conteo, monto, desglose por categoría y por producto) sin límite de filas PostgREST.';

GRANT EXECUTE ON FUNCTION public.obtener_reporte_ventas(uuid, timestamptz, timestamptz, text) TO authenticated;
