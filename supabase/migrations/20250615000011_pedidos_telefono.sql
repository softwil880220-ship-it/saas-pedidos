-- Teléfono WhatsApp del cliente en pedidos
ALTER TABLE public.pedidos
ADD COLUMN IF NOT EXISTS telefono text;

COMMENT ON COLUMN public.pedidos.telefono IS 'Teléfono WhatsApp del cliente';

-- Inserción pública (incluye telefono)
DROP POLICY IF EXISTS "Allow public insert on pedidos" ON public.pedidos;
CREATE POLICY "Allow public insert on pedidos"
ON public.pedidos
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Actualización pública (incluye telefono)
DROP POLICY IF EXISTS "Allow public update on pedidos" ON public.pedidos;
CREATE POLICY "Allow public update on pedidos"
ON public.pedidos
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Lectura pública (incluye telefono)
DROP POLICY IF EXISTS "Allow public read on pedidos" ON public.pedidos;
CREATE POLICY "Allow public read on pedidos"
ON public.pedidos
FOR SELECT
TO anon, authenticated
USING (true);
