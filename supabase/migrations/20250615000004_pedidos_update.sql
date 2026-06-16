-- Actualización pública de pedidos (necesaria para editar pedidos)
DROP POLICY IF EXISTS "Allow public update on pedidos" ON public.pedidos;

CREATE POLICY "Allow public update on pedidos"
ON public.pedidos
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);
