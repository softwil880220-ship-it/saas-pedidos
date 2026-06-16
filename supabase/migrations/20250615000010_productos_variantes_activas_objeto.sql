-- variantes_activas: objeto JSON { "quesos": ["1","2"], "toppings": ["5"] }
-- Cada key es una categoría; el valor es un array de IDs de items de esa categoría.
-- La app convierte el formato anterior (array de categorías) al leer productos existentes.

ALTER TABLE public.productos
ALTER COLUMN variantes_activas SET DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.productos.variantes_activas IS
'Mapa de variantes por producto: categoría -> array de IDs de items del catálogo';
