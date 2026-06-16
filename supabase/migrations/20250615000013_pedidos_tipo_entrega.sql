-- Tipo de entrega en pedidos WhatsApp (domicilio | sucursal)
ALTER TABLE public.pedidos
ADD COLUMN IF NOT EXISTS tipo_entrega text NOT NULL DEFAULT 'domicilio';

COMMENT ON COLUMN public.pedidos.tipo_entrega IS 'Tipo de entrega: domicilio o sucursal';

UPDATE public.pedidos
SET tipo_entrega = 'domicilio'
WHERE tipo_entrega IS NULL;

-- Inserción pública (incluye tipo_entrega)
DROP POLICY IF EXISTS "Allow public insert on pedidos" ON public.pedidos;
CREATE POLICY "Allow public insert on pedidos"
ON public.pedidos
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Actualización pública (incluye tipo_entrega)
DROP POLICY IF EXISTS "Allow public update on pedidos" ON public.pedidos;
CREATE POLICY "Allow public update on pedidos"
ON public.pedidos
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Lectura pública (incluye tipo_entrega)
DROP POLICY IF EXISTS "Allow public read on pedidos" ON public.pedidos;
CREATE POLICY "Allow public read on pedidos"
ON public.pedidos
FOR SELECT
TO anon, authenticated
USING (true);
