-- Variantes de producto (toppings y salsas) en JSON
ALTER TABLE public.productos
ADD COLUMN IF NOT EXISTS variantes jsonb NOT NULL DEFAULT '{"toppings":[],"salsas":[]}'::jsonb;

UPDATE public.productos
SET variantes = '{"toppings":[],"salsas":[]}'::jsonb
WHERE variantes IS NULL;
