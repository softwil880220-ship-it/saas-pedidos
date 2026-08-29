-- NO EJECUTAR, ya aplicado manualmente
-- Etiqueta de dirección en pedidos a domicilio (ej. Casa, Trabajo).
-- Nullable; sin backfill de pedidos existentes.

BEGIN;

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS etiqueta text;

COMMENT ON COLUMN public.pedidos.etiqueta IS
  'Etiqueta de la dirección de entrega en pedidos a domicilio (ej. Casa, Trabajo). NULL si no aplica o no se capturó.';

COMMIT;
