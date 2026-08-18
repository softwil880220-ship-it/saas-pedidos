-- DOCUMENTACIÓN RETROACTIVA — NO EJECUTAR EN DEV NI PROD
-- Este SQL ya está aplicado en producción (confirmado vía pg_get_functiondef).
-- El archivo existe solo para versionar el estado real en el repo.
--
-- Difiere de la definición original en 20250615000020_multitenant_negocios_usuarios.sql,
-- que solo leía public.usuarios WHERE id = auth.uid(). El fallback a usuarios_negocio
-- (UNION con supabase_user_id = auth.uid()) fue agregado manualmente en producción en
-- algún momento no documentado, para resolver el drift entre ambas tablas de identidad
-- (public.usuarios vs public.usuarios_negocio).

CREATE OR REPLACE FUNCTION public.usuario_negocio_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT negocio_id FROM public.usuarios WHERE id = auth.uid()
  UNION
  SELECT negocio_id FROM public.usuarios_negocio WHERE supabase_user_id = auth.uid()
  LIMIT 1;
$function$;
