-- Cocina asignada por producto (cocina1 | cocina2 | ninguna)
ALTER TABLE public.productos
ADD COLUMN IF NOT EXISTS cocina text NOT NULL DEFAULT 'cocina1';

COMMENT ON COLUMN public.productos.cocina IS 'Cocina de preparación: cocina1, cocina2 o ninguna';

UPDATE public.productos
SET cocina = 'cocina1'
WHERE cocina IS NULL;
