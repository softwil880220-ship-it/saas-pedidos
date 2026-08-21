-- DOCUMENTACIÓN RETROACTIVA — NO EJECUTAR EN DEV NI PROD
-- Fecha: 21 ago 2026. Aplicada manualmente en DEV y PROD el mismo día vía SQL Editor.
-- Helper SECURITY DEFINER para validar zona activa del negocio (RLS INSERT direcciones).

CREATE OR REPLACE FUNCTION public.zona_valida_para_negocio(p_zona_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT p_zona_id IS NULL OR EXISTS (
    SELECT 1 FROM public.zonas z
    WHERE z.id = p_zona_id
      AND z.negocio_id = public.usuario_negocio_id()
      AND z.activa = true
  );
$function$;
