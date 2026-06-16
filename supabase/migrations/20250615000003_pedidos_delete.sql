-- Eliminación pública de pedidos
DROP POLICY IF EXISTS "Allow public delete on pedidos" ON public.pedidos;

CREATE POLICY "Allow public delete on pedidos"
ON public.pedidos
FOR DELETE
TO anon, authenticated
USING (true);
