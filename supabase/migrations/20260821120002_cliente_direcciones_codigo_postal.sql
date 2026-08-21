-- DOCUMENTACIÓN RETROACTIVA — NO EJECUTAR EN DEV NI PROD
-- Fecha: 21 ago 2026. Aplicada manualmente en DEV y PROD el mismo día vía SQL Editor.
-- Columna codigo_postal en cliente_direcciones.

ALTER TABLE public.cliente_direcciones
ADD COLUMN codigo_postal text;
