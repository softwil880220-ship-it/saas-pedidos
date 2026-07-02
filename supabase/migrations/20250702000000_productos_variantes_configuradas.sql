-- Distingue productos nunca configurados (fallback: todas las variantes)
-- de productos guardados explícitamente sin variantes seleccionadas.
ALTER TABLE public.productos
ADD COLUMN IF NOT EXISTS variantes_configuradas boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.productos.variantes_configuradas IS
  'true cuando el producto fue guardado desde el formulario de variantes dinámicas; false = usar fallback legacy en pedidos.';

-- Productos que ya tienen filas en el puente se consideran configurados.
UPDATE public.productos p
SET variantes_configuradas = true
WHERE variantes_configuradas = false
  AND EXISTS (
    SELECT 1
    FROM public.producto_categorias_variantes pcv
    WHERE pcv.producto_id = p.id
  );
