-- Snapshot inmutable de retiros incluidos al cerrar el arqueo

ALTER TABLE public.arqueos
ADD COLUMN IF NOT EXISTS retiros_detalle jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.arqueos.retiros_detalle IS
  'Copia de retiros de la jornada al momento del arqueo. No se actualiza después del insert.';

ALTER TABLE public.arqueos
ADD CONSTRAINT arqueos_retiros_detalle_es_array
CHECK (jsonb_typeof(retiros_detalle) = 'array');

CREATE INDEX IF NOT EXISTS fondos_fijos_jornada_id_idx
  ON public.fondos_fijos (jornada_id);
