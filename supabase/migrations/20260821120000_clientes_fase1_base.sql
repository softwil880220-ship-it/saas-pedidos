-- DOCUMENTACIÓN RETROACTIVA — NO EJECUTAR EN DEV NI PROD
-- Fecha: 21 ago 2026. Aplicada manualmente en DEV y PROD el mismo día vía SQL Editor.
-- Migración base Fase 1: módulo clientes (tablas, RLS, negocio_modulo_habilitado, buscar_cliente inicial).

BEGIN;

ALTER TABLE public.negocios
  ADD COLUMN IF NOT EXISTS habilitar_clientes boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.negocios.habilitar_clientes IS
  'Módulo base de datos de clientes (admin + búsqueda RPC). false = deshabilitado por plan.';

CREATE OR REPLACE FUNCTION public.negocio_modulo_habilitado(p_modulo text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE p_modulo
    WHEN 'caja' THEN n.habilitar_caja
    WHEN 'mostrador' THEN n.habilitar_mostrador
    WHEN 'recoger_domicilio' THEN n.habilitar_recoger_domicilio
    WHEN 'mesas' THEN n.habilitar_mesas
    WHEN 'clientes' THEN n.habilitar_clientes
    ELSE false
  END
  FROM public.negocios n
  WHERE n.id = public.usuario_negocio_id()
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.negocio_modulo_habilitado(text) IS
  'Módulo habilitado para el negocio del usuario autenticado. '
  'Valores: caja | mostrador | recoger_domicilio | mesas | clientes.';

CREATE TABLE IF NOT EXISTS public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid NOT NULL REFERENCES public.negocios (id) ON DELETE CASCADE,
  nombre text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clientes_negocio_id_idx
  ON public.clientes (negocio_id);

CREATE TABLE IF NOT EXISTS public.zonas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid NOT NULL REFERENCES public.negocios (id) ON DELETE CASCADE,
  nombre text NOT NULL,
  tarifa_flete numeric NOT NULL CHECK (tarifa_flete >= 0),
  activa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS zonas_negocio_id_idx
  ON public.zonas (negocio_id);

CREATE UNIQUE INDEX IF NOT EXISTS zonas_negocio_nombre_uidx
  ON public.zonas (negocio_id, lower(trim(nombre)));

CREATE TABLE IF NOT EXISTS public.cliente_telefonos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes (id) ON DELETE CASCADE,
  telefono text NOT NULL,
  es_principal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cliente_telefonos_cliente_id_idx
  ON public.cliente_telefonos (cliente_id);

CREATE UNIQUE INDEX IF NOT EXISTS cliente_telefonos_un_principal_por_cliente_idx
  ON public.cliente_telefonos (cliente_id)
  WHERE es_principal = true;

CREATE TABLE IF NOT EXISTS public.cliente_direcciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes (id) ON DELETE CASCADE,
  zona_id uuid REFERENCES public.zonas (id) ON DELETE SET NULL,
  etiqueta text,
  calle text,
  entre_calles text,
  colonia text,
  municipio text,
  estado text,
  pais text,
  es_principal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cliente_direcciones_cliente_id_idx
  ON public.cliente_direcciones (cliente_id);

CREATE INDEX IF NOT EXISTS cliente_direcciones_zona_id_idx
  ON public.cliente_direcciones (zona_id);

CREATE UNIQUE INDEX IF NOT EXISTS cliente_direcciones_un_principal_por_cliente_idx
  ON public.cliente_direcciones (cliente_id)
  WHERE es_principal = true;

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_select_clientes ON public.clientes;
DROP POLICY IF EXISTS tenant_insert_clientes ON public.clientes;
DROP POLICY IF EXISTS tenant_update_clientes ON public.clientes;
DROP POLICY IF EXISTS tenant_delete_clientes ON public.clientes;

CREATE POLICY tenant_select_clientes
ON public.clientes
FOR SELECT TO authenticated
USING (
  negocio_id = public.usuario_negocio_id()
  AND public.usuario_actual_es_admin_o_dueno()
  AND COALESCE(public.negocio_modulo_habilitado('clientes'), false)
);

CREATE POLICY tenant_insert_clientes
ON public.clientes
FOR INSERT TO authenticated
WITH CHECK (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('clientes'), false)
);

CREATE POLICY tenant_update_clientes
ON public.clientes
FOR UPDATE TO authenticated
USING (
  negocio_id = public.usuario_negocio_id()
  AND public.usuario_actual_es_admin_o_dueno()
  AND COALESCE(public.negocio_modulo_habilitado('clientes'), false)
)
WITH CHECK (
  negocio_id = public.usuario_negocio_id()
  AND public.usuario_actual_es_admin_o_dueno()
  AND COALESCE(public.negocio_modulo_habilitado('clientes'), false)
);

CREATE POLICY tenant_delete_clientes
ON public.clientes
FOR DELETE TO authenticated
USING (
  negocio_id = public.usuario_negocio_id()
  AND public.usuario_actual_es_admin_o_dueno()
  AND COALESCE(public.negocio_modulo_habilitado('clientes'), false)
);

ALTER TABLE public.cliente_telefonos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_select_cliente_telefonos ON public.cliente_telefonos;
DROP POLICY IF EXISTS tenant_insert_cliente_telefonos ON public.cliente_telefonos;
DROP POLICY IF EXISTS tenant_update_cliente_telefonos ON public.cliente_telefonos;
DROP POLICY IF EXISTS tenant_delete_cliente_telefonos ON public.cliente_telefonos;

CREATE POLICY tenant_select_cliente_telefonos
ON public.cliente_telefonos
FOR SELECT TO authenticated
USING (
  public.usuario_actual_es_admin_o_dueno()
  AND COALESCE(public.negocio_modulo_habilitado('clientes'), false)
  AND EXISTS (
    SELECT 1
    FROM public.clientes c
    WHERE c.id = cliente_telefonos.cliente_id
      AND c.negocio_id = public.usuario_negocio_id()
  )
);

CREATE POLICY tenant_insert_cliente_telefonos
ON public.cliente_telefonos
FOR INSERT TO authenticated
WITH CHECK (
  COALESCE(public.negocio_modulo_habilitado('clientes'), false)
  AND EXISTS (
    SELECT 1
    FROM public.clientes c
    WHERE c.id = cliente_telefonos.cliente_id
      AND c.negocio_id = public.usuario_negocio_id()
  )
);

CREATE POLICY tenant_update_cliente_telefonos
ON public.cliente_telefonos
FOR UPDATE TO authenticated
USING (
  public.usuario_actual_es_admin_o_dueno()
  AND COALESCE(public.negocio_modulo_habilitado('clientes'), false)
  AND EXISTS (
    SELECT 1
    FROM public.clientes c
    WHERE c.id = cliente_telefonos.cliente_id
      AND c.negocio_id = public.usuario_negocio_id()
  )
)
WITH CHECK (
  public.usuario_actual_es_admin_o_dueno()
  AND COALESCE(public.negocio_modulo_habilitado('clientes'), false)
  AND EXISTS (
    SELECT 1
    FROM public.clientes c
    WHERE c.id = cliente_telefonos.cliente_id
      AND c.negocio_id = public.usuario_negocio_id()
  )
);

CREATE POLICY tenant_delete_cliente_telefonos
ON public.cliente_telefonos
FOR DELETE TO authenticated
USING (
  public.usuario_actual_es_admin_o_dueno()
  AND COALESCE(public.negocio_modulo_habilitado('clientes'), false)
  AND EXISTS (
    SELECT 1
    FROM public.clientes c
    WHERE c.id = cliente_telefonos.cliente_id
      AND c.negocio_id = public.usuario_negocio_id()
  )
);

ALTER TABLE public.cliente_direcciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_select_cliente_direcciones ON public.cliente_direcciones;
DROP POLICY IF EXISTS tenant_insert_cliente_direcciones ON public.cliente_direcciones;
DROP POLICY IF EXISTS tenant_update_cliente_direcciones ON public.cliente_direcciones;
DROP POLICY IF EXISTS tenant_delete_cliente_direcciones ON public.cliente_direcciones;

CREATE POLICY tenant_select_cliente_direcciones
ON public.cliente_direcciones
FOR SELECT TO authenticated
USING (
  public.usuario_actual_es_admin_o_dueno()
  AND COALESCE(public.negocio_modulo_habilitado('clientes'), false)
  AND EXISTS (
    SELECT 1
    FROM public.clientes c
    WHERE c.id = cliente_direcciones.cliente_id
      AND c.negocio_id = public.usuario_negocio_id()
  )
);

CREATE POLICY tenant_insert_cliente_direcciones
ON public.cliente_direcciones
FOR INSERT TO authenticated
WITH CHECK (
  COALESCE(public.negocio_modulo_habilitado('clientes'), false)
  AND EXISTS (
    SELECT 1
    FROM public.clientes c
    WHERE c.id = cliente_direcciones.cliente_id
      AND c.negocio_id = public.usuario_negocio_id()
  )
  AND (
    cliente_direcciones.zona_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.zonas z
      WHERE z.id = cliente_direcciones.zona_id
        AND z.negocio_id = public.usuario_negocio_id()
        AND z.activa = true
    )
  )
);

CREATE POLICY tenant_update_cliente_direcciones
ON public.cliente_direcciones
FOR UPDATE TO authenticated
USING (
  public.usuario_actual_es_admin_o_dueno()
  AND COALESCE(public.negocio_modulo_habilitado('clientes'), false)
  AND EXISTS (
    SELECT 1
    FROM public.clientes c
    WHERE c.id = cliente_direcciones.cliente_id
      AND c.negocio_id = public.usuario_negocio_id()
  )
)
WITH CHECK (
  public.usuario_actual_es_admin_o_dueno()
  AND COALESCE(public.negocio_modulo_habilitado('clientes'), false)
  AND EXISTS (
    SELECT 1
    FROM public.clientes c
    WHERE c.id = cliente_direcciones.cliente_id
      AND c.negocio_id = public.usuario_negocio_id()
  )
  AND (
    cliente_direcciones.zona_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.zonas z
      WHERE z.id = cliente_direcciones.zona_id
        AND z.negocio_id = public.usuario_negocio_id()
    )
  )
);

CREATE POLICY tenant_delete_cliente_direcciones
ON public.cliente_direcciones
FOR DELETE TO authenticated
USING (
  public.usuario_actual_es_admin_o_dueno()
  AND COALESCE(public.negocio_modulo_habilitado('clientes'), false)
  AND EXISTS (
    SELECT 1
    FROM public.clientes c
    WHERE c.id = cliente_direcciones.cliente_id
      AND c.negocio_id = public.usuario_negocio_id()
  )
);

ALTER TABLE public.zonas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_select_zonas ON public.zonas;
DROP POLICY IF EXISTS tenant_insert_zonas ON public.zonas;
DROP POLICY IF EXISTS tenant_update_zonas ON public.zonas;
DROP POLICY IF EXISTS tenant_delete_zonas ON public.zonas;

CREATE POLICY tenant_select_zonas
ON public.zonas
FOR SELECT TO authenticated
USING (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('clientes'), false)
);

CREATE POLICY tenant_insert_zonas
ON public.zonas
FOR INSERT TO authenticated
WITH CHECK (
  negocio_id = public.usuario_negocio_id()
  AND public.usuario_actual_es_admin_o_dueno()
  AND COALESCE(public.negocio_modulo_habilitado('clientes'), false)
);

CREATE POLICY tenant_update_zonas
ON public.zonas
FOR UPDATE TO authenticated
USING (
  negocio_id = public.usuario_negocio_id()
  AND public.usuario_actual_es_admin_o_dueno()
  AND COALESCE(public.negocio_modulo_habilitado('clientes'), false)
)
WITH CHECK (
  negocio_id = public.usuario_negocio_id()
  AND public.usuario_actual_es_admin_o_dueno()
  AND COALESCE(public.negocio_modulo_habilitado('clientes'), false)
);

CREATE POLICY tenant_delete_zonas
ON public.zonas
FOR DELETE TO authenticated
USING (
  negocio_id = public.usuario_negocio_id()
  AND public.usuario_actual_es_admin_o_dueno()
  AND COALESCE(public.negocio_modulo_habilitado('clientes'), false)
);

CREATE OR REPLACE FUNCTION public.buscar_cliente(p_query text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
            'entre_calles', cd.entre_calles,
            'colonia', cd.colonia,
            'municipio', cd.municipio,
            'estado', cd.estado,
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
$$;

COMMENT ON FUNCTION public.buscar_cliente(text) IS
  'Búsqueda acotada de clientes (mín. 3 caracteres, máx. 5 resultados). '
  'SECURITY DEFINER filtrado por negocio del usuario autenticado. '
  'Única vía de lectura para cajero.';

GRANT EXECUTE ON FUNCTION public.buscar_cliente(text) TO authenticated;

COMMIT;
