-- Consumo de personal: extras/variantes seleccionados por línea (mapa categoría → ids).

BEGIN;

ALTER TABLE public.inventario_consumo_interno
  ADD COLUMN IF NOT EXISTS variantes jsonb NULL;

COMMIT;
