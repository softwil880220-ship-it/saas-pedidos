-- Reporte de Ventas: agregación en SQL (sin límite de 1000 filas de PostgREST).
-- Aplicar manualmente en DEV y luego en PROD vía Supabase SQL Editor.
-- Replica la lógica de:
--   - pedidoCoincideFiltroVenta / filtrarPedidosReporte (reportesHelpers.js)
--   - calcularResumenReporte
--   - calcularReportePorCategoria + resolverProductoDeLinea (categoriaFrecuenciaPedidos.js)
--   - obtenerCantidadLineaReporte / obtenerSubtotalLineaReporte (reportesHelpers.js + productoUnidadVenta.js)

-- ---------------------------------------------------------------------------
-- Helpers internos (prefijo reporte_ventas_)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reporte_ventas_entero_seguro(p_texto text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_num integer;
BEGIN
  IF p_texto IS NULL OR btrim(p_texto) = '' THEN
    RETURN NULL;
  END IF;

  BEGIN
    v_num := btrim(p_texto)::integer;
  EXCEPTION
    WHEN others THEN
      RETURN NULL;
  END;

  RETURN v_num;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reporte_ventas_redondear_moneda(p_valor numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT round(coalesce(p_valor, 0)::numeric, 2);
$function$;

CREATE OR REPLACE FUNCTION public.reporte_ventas_normalizar_tipo_entrega(p_tipo_entrega text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN btrim(coalesce(p_tipo_entrega, '')) = 'sucursal' THEN 'sucursal'
    ELSE 'domicilio'
  END;
$function$;

CREATE OR REPLACE FUNCTION public.reporte_ventas_coincide_filtro(
  p_tipo text,
  p_tipo_entrega text,
  p_filtro_venta text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE coalesce(nullif(btrim(p_filtro_venta), ''), 'todos')
    WHEN 'caja' THEN coalesce(btrim(p_tipo), '') = 'presencial'
    WHEN 'mostrador' THEN coalesce(btrim(p_tipo), '') = 'mostrador'
    WHEN 'mesas' THEN coalesce(btrim(p_tipo), '') = 'mesa'
    WHEN 'whatsapp' THEN coalesce(btrim(p_tipo), '') IN ('', 'whatsapp')
    WHEN 'whatsapp_domicilio' THEN
      coalesce(btrim(p_tipo), '') IN ('', 'whatsapp')
      AND public.reporte_ventas_normalizar_tipo_entrega(p_tipo_entrega) = 'domicilio'
    WHEN 'whatsapp_sucursal' THEN
      coalesce(btrim(p_tipo), '') IN ('', 'whatsapp')
      AND public.reporte_ventas_normalizar_tipo_entrega(p_tipo_entrega) = 'sucursal'
    ELSE true
  END;
$function$;

CREATE OR REPLACE FUNCTION public.reporte_ventas_es_por_peso(p_linea jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT coalesce(
    nullif(btrim(coalesce(p_linea->>'unidad_venta', p_linea->>'unidadVenta', '')), ''),
    'pieza'
  ) = 'peso';
$function$;

CREATE OR REPLACE FUNCTION public.reporte_ventas_cantidad_linea(p_linea jsonb)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_cantidad integer;
BEGIN
  v_cantidad := public.reporte_ventas_entero_seguro(p_linea->>'cantidad');

  IF public.reporte_ventas_es_por_peso(p_linea) THEN
    RETURN coalesce(v_cantidad, 0);
  END IF;

  IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
    RETURN 1;
  END IF;

  RETURN v_cantidad;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reporte_ventas_subtotal_linea(p_linea jsonb)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_subtotal numeric;
  v_precio numeric;
  v_cantidad integer;
  v_gramos integer;
BEGIN
  BEGIN
    v_subtotal := nullif(btrim(coalesce(p_linea->>'subtotal', '')), '')::numeric;
  EXCEPTION
    WHEN others THEN
      v_subtotal := NULL;
  END;

  IF v_subtotal IS NOT NULL THEN
    RETURN public.reporte_ventas_redondear_moneda(v_subtotal);
  END IF;

  BEGIN
    v_precio := nullif(
      btrim(coalesce(p_linea->>'precio_unitario', p_linea->>'precioUnitario', '')),
      ''
    )::numeric;
  EXCEPTION
    WHEN others THEN
      RETURN 0;
  END;

  IF v_precio IS NULL THEN
    RETURN 0;
  END IF;

  IF public.reporte_ventas_es_por_peso(p_linea) THEN
    v_gramos := public.reporte_ventas_entero_seguro(p_linea->>'cantidad');
    IF v_gramos IS NULL OR v_gramos <= 0 THEN
      RETURN 0;
    END IF;
    RETURN public.reporte_ventas_redondear_moneda((v_gramos::numeric / 1000) * v_precio);
  END IF;

  v_cantidad := public.reporte_ventas_entero_seguro(p_linea->>'cantidad');
  IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
    v_cantidad := 1;
  END IF;

  RETURN public.reporte_ventas_redondear_moneda(v_precio * v_cantidad);
END;
$function$;

CREATE OR REPLACE FUNCTION public.reporte_ventas_normalizar_categoria(p_categoria text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN btrim(coalesce(p_categoria, '')) = '' THEN 'Sin categoría'
    ELSE btrim(p_categoria)
  END;
$function$;

CREATE OR REPLACE FUNCTION public.reporte_ventas_resolver_categoria_linea(
  p_linea jsonb,
  p_negocio_id uuid
)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_producto_id text;
  v_categoria text;
  v_nombre_linea text;
  v_nombre_base text;
  v_pos integer;
BEGIN
  v_producto_id := nullif(btrim(coalesce(p_linea->>'productoId', p_linea->>'producto_id', '')), '');

  IF v_producto_id IS NOT NULL THEN
    SELECT public.reporte_ventas_normalizar_categoria(pr.categoria)
    INTO v_categoria
    FROM public.productos pr
    WHERE pr.negocio_id = p_negocio_id
      AND pr.id::text = v_producto_id
    LIMIT 1;

    IF v_categoria IS NOT NULL THEN
      RETURN v_categoria;
    END IF;
  END IF;

  v_nombre_linea := coalesce(
    nullif(btrim(coalesce(p_linea->>'nombre', '')), ''),
    nullif(btrim(coalesce(p_linea->>'descripcion', '')), '')
  );

  IF v_nombre_linea IS NULL THEN
    RETURN 'Sin categoría';
  END IF;

  SELECT public.reporte_ventas_normalizar_categoria(pr.categoria)
  INTO v_categoria
  FROM public.productos pr
  WHERE pr.negocio_id = p_negocio_id
    AND lower(btrim(pr.nombre)) = lower(v_nombre_linea)
  ORDER BY pr.id
  LIMIT 1;

  IF v_categoria IS NOT NULL THEN
    RETURN v_categoria;
  END IF;

  v_pos := position(' (' IN v_nombre_linea);
  IF v_pos > 0 THEN
    v_nombre_base := btrim(substring(v_nombre_linea FROM 1 FOR v_pos - 1));
  ELSE
    v_nombre_base := v_nombre_linea;
  END IF;

  SELECT public.reporte_ventas_normalizar_categoria(pr.categoria)
  INTO v_categoria
  FROM public.productos pr
  WHERE pr.negocio_id = p_negocio_id
    AND lower(btrim(pr.nombre)) = lower(v_nombre_base)
  ORDER BY pr.id
  LIMIT 1;

  RETURN coalesce(v_categoria, 'Sin categoría');
END;
$function$;

-- ---------------------------------------------------------------------------
-- RPC principal
-- ---------------------------------------------------------------------------

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
      'categorias', '[]'::jsonb
    );
  END IF;

  WITH pedidos_filtrados AS (
    SELECT
      p.total,
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
    )
  INTO v_total_pedidos, v_monto_acumulado, v_categorias
  FROM resumen r;

  RETURN jsonb_build_object(
    'total_pedidos', coalesce(v_total_pedidos, 0),
    'monto_acumulado', coalesce(v_monto_acumulado, 0),
    'categorias', coalesce(v_categorias, '[]'::jsonb)
  );
END;
$function$;

COMMENT ON FUNCTION public.obtener_reporte_ventas(uuid, timestamptz, timestamptz, text) IS
'Agrega el reporte de Ventas (conteo, monto y desglose por categoría) sin límite de filas PostgREST.';

GRANT EXECUTE ON FUNCTION public.obtener_reporte_ventas(uuid, timestamptz, timestamptz, text) TO authenticated;
