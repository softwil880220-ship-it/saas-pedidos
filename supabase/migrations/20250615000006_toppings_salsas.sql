-- Catálogo independiente de toppings
CREATE TABLE IF NOT EXISTS public.toppings (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre text NOT NULL,
  precio numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.toppings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on toppings" ON public.toppings;
CREATE POLICY "Allow public read on toppings"
ON public.toppings
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Allow public insert on toppings" ON public.toppings;
CREATE POLICY "Allow public insert on toppings"
ON public.toppings
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update on toppings" ON public.toppings;
CREATE POLICY "Allow public update on toppings"
ON public.toppings
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public delete on toppings" ON public.toppings;
CREATE POLICY "Allow public delete on toppings"
ON public.toppings
FOR DELETE
TO anon, authenticated
USING (true);

-- Catálogo independiente de salsas
CREATE TABLE IF NOT EXISTS public.salsas (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre text NOT NULL,
  precio numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.salsas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on salsas" ON public.salsas;
CREATE POLICY "Allow public read on salsas"
ON public.salsas
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Allow public insert on salsas" ON public.salsas;
CREATE POLICY "Allow public insert on salsas"
ON public.salsas
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update on salsas" ON public.salsas;
CREATE POLICY "Allow public update on salsas"
ON public.salsas
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public delete on salsas" ON public.salsas;
CREATE POLICY "Allow public delete on salsas"
ON public.salsas
FOR DELETE
TO anon, authenticated
USING (true);
