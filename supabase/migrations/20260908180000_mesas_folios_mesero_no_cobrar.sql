-- Mesero: bloquear cierre/cobro de folios (UPDATE a estado = 'cerrada')
-- Aplicar manualmente en DEV/PROD tras revisión.

CREATE OR REPLACE FUNCTION public.usuario_actual_es_mesero()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios_negocio un
    WHERE un.id = public.usuario_negocio_perfil_id()
      AND un.negocio_id = public.usuario_negocio_id()
      AND un.activo = true
      AND un.rol = 'mesero'
  );
$$;

COMMENT ON FUNCTION public.usuario_actual_es_mesero() IS
  'true si el usuario autenticado tiene rol mesero activo en el negocio actual.';

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
  AND (
    creado_por = public.usuario_negocio_perfil_id()
    OR public.usuario_actual_es_admin_o_dueno()
  )
  AND NOT (
    public.usuario_actual_es_mesero()
    AND estado = 'cerrada'
  )
);
