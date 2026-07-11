-- DOCUMENTACIÓN RETROACTIVA — NO EJECUTAR EN DEV NI PROD
-- Este SQL ya fue aplicado manualmente en ambas bases de datos (fix "Capturado por"
-- en Vista Cocina). El archivo existe solo para versionar el cambio en el repo.

-- 1) Helper: negocio_id del perfil autenticado (usuarios_negocio)
CREATE OR REPLACE FUNCTION public.usuario_negocio_id_perfil()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT negocio_id
  FROM public.usuarios_negocio
  WHERE supabase_user_id = auth.uid()
    AND activo = true
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.usuario_negocio_id_perfil() IS
  'negocio_id del usuario autenticado según usuarios_negocio (para RLS multitenant).';

-- 2) Eliminar políticas SELECT redundantes (misma condición: supabase_user_id = auth.uid())
DROP POLICY IF EXISTS "usuarios pueden ver su propio registro" ON public.usuarios_negocio;
DROP POLICY IF EXISTS ver_propio_registro ON public.usuarios_negocio;

-- 3) SELECT: compañeros activos del mismo negocio (mapa nombres en cocina, etc.)
CREATE POLICY usuarios_negocio_select_mismo_negocio
ON public.usuarios_negocio
FOR SELECT
TO authenticated
USING (
  activo = true
  AND negocio_id IS NOT NULL
  AND negocio_id = public.usuario_negocio_id_perfil()
);

-- 4) SELECT: fila propia siempre (login / AuthContext, incluso si activo = false)
CREATE POLICY usuarios_negocio_select_propio
ON public.usuarios_negocio
FOR SELECT
TO authenticated
USING (supabase_user_id = auth.uid());

-- No toca: dueno_puede_insertar_usuarios (INSERT)
