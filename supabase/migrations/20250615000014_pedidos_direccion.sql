-- Dirección de entrega en pedidos WhatsApp a domicilio
ALTER TABLE public.pedidos
ADD COLUMN IF NOT EXISTS direccion text;

COMMENT ON COLUMN public.pedidos.direccion IS 'Dirección de entrega para pedidos a domicilio';

-- Inserción pública (incluye direccion)
DROP POLICY IF EXISTS "Allow public insert on pedidos" ON public.pedidos;
CREATE POLICY "Allow public insert on pedidos"
ON public.pedidos
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Actualización pública (incluye direccion)
DROP POLICY IF EXISTS "Allow public update on pedidos" ON public.pedidos;
CREATE POLICY "Allow public update on pedidos"
ON public.pedidos
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Lectura pública (incluye direccion)
DROP POLICY IF EXISTS "Allow public read on pedidos" ON public.pedidos;
CREATE POLICY "Allow public read on pedidos"
ON public.pedidos
FOR SELECT
TO anon, authenticated
USING (true);
