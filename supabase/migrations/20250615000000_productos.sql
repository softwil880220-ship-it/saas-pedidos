-- Tabla de catálogo de productos
CREATE TABLE IF NOT EXISTS public.productos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre text NOT NULL,
  precio numeric NOT NULL,
  categoria text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;

-- Lectura pública
DROP POLICY IF EXISTS "Allow public read on productos" ON public.productos;

CREATE POLICY "Allow public read on productos"
ON public.productos
FOR SELECT
TO anon, authenticated
USING (true);

-- Inserción pública
DROP POLICY IF EXISTS "Allow public insert on productos" ON public.productos;

CREATE POLICY "Allow public insert on productos"
ON public.productos
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Eliminación pública
DROP POLICY IF EXISTS "Allow public delete on productos" ON public.productos;

CREATE POLICY "Allow public delete on productos"
ON public.productos
FOR DELETE
TO anon, authenticated
USING (true);
