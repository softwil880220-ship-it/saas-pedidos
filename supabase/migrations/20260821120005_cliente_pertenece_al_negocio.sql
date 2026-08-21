-- DOCUMENTACIÓN RETROACTIVA — NO EJECUTAR EN DEV NI PROD
-- Fecha: 21 ago 2026. Aplicada manualmente en DEV y PROD el mismo día vía SQL Editor.
-- Helper SECURITY DEFINER para validar pertenencia de cliente al negocio del usuario (RLS INSERT).

CREATE OR REPLACE FUNCTION public.cliente_pertenece_al_negocio(p_cliente_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id = p_cliente_id
      AND c.negocio_id = public.usuario_negocio_id()
  );
$function$;
