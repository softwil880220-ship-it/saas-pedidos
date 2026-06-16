-- Actualización pública de productos (necesaria para editar en el catálogo)
DROP POLICY IF EXISTS "Allow public update on productos" ON public.productos;

CREATE POLICY "Allow public update on productos"
ON public.productos
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);
