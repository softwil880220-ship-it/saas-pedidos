-- DOCUMENTACIÓN RETROACTIVA — NO EJECUTAR EN DEV NI PROD
-- Fecha: 21 ago 2026. Aplicada manualmente en DEV y PROD el mismo día vía SQL Editor.
-- Fix política tenant_insert_cliente_telefonos (usa cliente_pertenece_al_negocio, sin SELECT directo).

DROP POLICY IF EXISTS tenant_insert_cliente_telefonos ON public.cliente_telefonos;

CREATE POLICY tenant_insert_cliente_telefonos
ON public.cliente_telefonos
FOR INSERT
WITH CHECK (
  COALESCE(public.negocio_modulo_habilitado('clientes'), false)
  AND public.cliente_pertenece_al_negocio(cliente_id)
);
