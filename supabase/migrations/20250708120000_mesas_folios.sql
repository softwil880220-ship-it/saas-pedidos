-- Mesas: folios abiertos/cerrados con carrito en Supabase (aplicar manualmente)

CREATE OR REPLACE FUNCTION public.usuario_negocio_perfil_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.usuarios_negocio
  WHERE supabase_user_id = auth.uid()
    AND activo = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.es_admin_o_dueno(p_usuario_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios_negocio un
    WHERE un.id = p_usuario_id
      AND un.negocio_id = public.usuario_negocio_id()
      AND un.activo = true
      AND un.rol IN ('dueno', 'administrador')
  );
$$;

CREATE OR REPLACE FUNCTION public.usuario_actual_es_admin_o_dueno()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.es_admin_o_dueno(public.usuario_negocio_perfil_id());
$$;

CREATE TABLE IF NOT EXISTS public.mesas_folios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid NOT NULL REFERENCES public.negocios(id),
  numero_mesa integer NOT NULL CHECK (numero_mesa >= 1),
  estado text NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'cerrada')),
  creado_por uuid REFERENCES public.usuarios_negocio(id) ON DELETE SET NULL,
  cerrado_por uuid REFERENCES public.usuarios_negocio(id) ON DELETE SET NULL,
  carrito_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  numero_ronda_siguiente integer NOT NULL DEFAULT 1 CHECK (numero_ronda_siguiente >= 1),
  abierta_en timestamptz NOT NULL DEFAULT now(),
  cerrada_en timestamptz,
  CONSTRAINT mesas_folios_cerrada_coherente CHECK (
    (estado = 'abierta' AND cerrada_en IS NULL AND cerrado_por IS NULL)
    OR (estado = 'cerrada' AND cerrada_en IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS mesas_folios_una_abierta_por_mesa_idx
  ON public.mesas_folios (negocio_id, numero_mesa)
  WHERE estado = 'abierta';

CREATE INDEX IF NOT EXISTS mesas_folios_negocio_estado_idx
  ON public.mesas_folios (negocio_id, estado);

ALTER TABLE public.mesas_folios ENABLE ROW LEVEL SECURITY;

ALTER PUBLICATION supabase_realtime ADD TABLE public.mesas_folios;

CREATE OR REPLACE VIEW public.mesas_folios_vista AS
SELECT
  id,
  negocio_id,
  numero_mesa,
  estado,
  creado_por,
  cerrado_por,
  abierta_en,
  cerrada_en,
  numero_ronda_siguiente,
  CASE
    WHEN creado_por = public.usuario_negocio_perfil_id()
      OR public.usuario_actual_es_admin_o_dueno()
    THEN carrito_snapshot
    ELSE NULL::jsonb
  END AS carrito_snapshot
FROM public.mesas_folios;

GRANT SELECT ON public.mesas_folios_vista TO authenticated;

DROP POLICY IF EXISTS mesas_folios_select_mismo_negocio ON public.mesas_folios;
CREATE POLICY mesas_folios_select_mismo_negocio
ON public.mesas_folios
FOR SELECT TO authenticated
USING (negocio_id = public.usuario_negocio_id());

DROP POLICY IF EXISTS mesas_folios_insert_mesa_disponible ON public.mesas_folios;
CREATE POLICY mesas_folios_insert_mesa_disponible
ON public.mesas_folios
FOR INSERT TO authenticated
WITH CHECK (
  negocio_id = public.usuario_negocio_id()
  AND creado_por = public.usuario_negocio_perfil_id()
  AND estado = 'abierta'
  AND NOT EXISTS (
    SELECT 1
    FROM public.mesas_folios mf
    WHERE mf.negocio_id = mesas_folios.negocio_id
      AND mf.numero_mesa = mesas_folios.numero_mesa
      AND mf.estado = 'abierta'
  )
);

DROP POLICY IF EXISTS mesas_folios_update_creador_o_admin ON public.mesas_folios;
CREATE POLICY mesas_folios_update_creador_o_admin
ON public.mesas_folios
FOR UPDATE TO authenticated
USING (
  negocio_id = public.usuario_negocio_id()
  AND (
    creado_por = public.usuario_negocio_perfil_id()
    OR public.usuario_actual_es_admin_o_dueno()
  )
)
WITH CHECK (
  negocio_id = public.usuario_negocio_id()
);
