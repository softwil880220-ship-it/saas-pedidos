-- NO EJECUTAR, ya aplicado manualmente
-- Timestamps de asignación de repartidor y entrega en pedidos a domicilio.
-- Sin backfill de pedidos existentes.

BEGIN;

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS repartidor_asignado_en timestamptz,
  ADD COLUMN IF NOT EXISTS entregado_en timestamptz;

COMMENT ON COLUMN public.pedidos.repartidor_asignado_en IS
  'Momento en que se asignó repartidor (propio o externo) al pasar a enviado.';

COMMENT ON COLUMN public.pedidos.entregado_en IS
  'Momento en que el repartidor marcó Entregado en Vista Repartidor.';

COMMIT;
