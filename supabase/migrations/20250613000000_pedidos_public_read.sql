-- Lectura pública de pedidos (sin autenticación, rol anon)
DROP POLICY IF EXISTS "Allow public read on pedidos" ON public.pedidos;

CREATE POLICY "Allow public read on pedidos"
ON public.pedidos
FOR SELECT
TO anon, authenticated
USING (true);
