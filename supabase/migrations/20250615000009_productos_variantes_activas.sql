-- Categorías de variantes habilitadas por producto (array JSON de keys)
ALTER TABLE public.productos
ADD COLUMN IF NOT EXISTS variantes_activas jsonb NOT NULL DEFAULT '["quesos","cremas","chiles","mayonesas","untables","toppings","salsas"]'::jsonb;

UPDATE public.productos
SET variantes_activas = '["quesos","cremas","chiles","mayonesas","untables","toppings","salsas"]'::jsonb
WHERE variantes_activas IS NULL;
