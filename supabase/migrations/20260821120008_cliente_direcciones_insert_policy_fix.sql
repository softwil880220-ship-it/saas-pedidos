-- DOCUMENTACIÓN RETROACTIVA — NO EJECUTAR EN DEV NI PROD
-- Fecha: 21 ago 2026. Aplicada manualmente en DEV y PROD el mismo día vía SQL Editor.
-- Fix política tenant_insert_cliente_direcciones (usa cliente_pertenece_al_negocio y zona_valida_para_negocio).

DROP POLICY IF EXISTS tenant_insert_cliente_direcciones ON public.cliente_direcciones;

CREATE POLICY tenant_insert_cliente_direcciones
ON public.cliente_direcciones
FOR INSERT
WITH CHECK (
  COALESCE(public.negocio_modulo_habilitado('clientes'), false)
  AND public.cliente_pertenece_al_negocio(cliente_id)
  AND public.zona_valida_para_negocio(zona_id)
);
