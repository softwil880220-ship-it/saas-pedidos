-- DOCUMENTACIÓN RETROACTIVA — NO EJECUTAR EN DEV NI PROD
-- Fecha: 21 ago 2026. Aplicada manualmente en DEV y PROD el mismo día vía SQL Editor.
-- buscar_cliente() versión final (incluye numero, codigo_postal, referencia en direcciones).

CREATE OR REPLACE FUNCTION public.buscar_cliente(p_query text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_negocio_id uuid;
  v_q text;
BEGIN
  v_negocio_id := public.usuario_negocio_id();

  IF v_negocio_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF NOT COALESCE(public.negocio_modulo_habilitado('clientes'), false) THEN
    RETURN '[]'::jsonb;
  END IF;

  v_q := lower(trim(coalesce(p_query, '')));

  IF char_length(v_q) < 3 THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(t)::jsonb)
    FROM (
      SELECT
        c.id,
        c.nombre,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', ct.id,
            'telefono', ct.telefono,
            'es_principal', ct.es_principal
          ) ORDER BY ct.es_principal DESC, ct.created_at)
          FROM public.cliente_telefonos ct
          WHERE ct.cliente_id = c.id
        ), '[]'::jsonb) AS telefonos,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', cd.id,
            'etiqueta', cd.etiqueta,
            'calle', cd.calle,
            'numero', cd.numero,
            'entre_calles', cd.entre_calles,
            'referencia', cd.referencia,
            'colonia', cd.colonia,
            'municipio', cd.municipio,
            'estado', cd.estado,
            'codigo_postal', cd.codigo_postal,
            'pais', cd.pais,
            'es_principal', cd.es_principal,
            'zona_id', cd.zona_id,
            'zona_nombre', z.nombre,
            'tarifa_flete', z.tarifa_flete
          ) ORDER BY cd.es_principal DESC, cd.created_at)
          FROM public.cliente_direcciones cd
          LEFT JOIN public.zonas z ON z.id = cd.zona_id
          WHERE cd.cliente_id = c.id
        ), '[]'::jsonb) AS direcciones
      FROM public.clientes c
      WHERE c.negocio_id = v_negocio_id
        AND (
          lower(c.nombre) LIKE '%' || v_q || '%'
          OR EXISTS (
            SELECT 1
            FROM public.cliente_telefonos ct
            WHERE ct.cliente_id = c.id
              AND lower(ct.telefono) LIKE '%' || v_q || '%'
          )
        )
      ORDER BY c.nombre
      LIMIT 5
    ) t
  ), '[]'::jsonb);
END;
$function$;
