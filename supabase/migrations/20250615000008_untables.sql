-- Catálogo independiente de untables
CREATE TABLE IF NOT EXISTS public.untables (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre text NOT NULL,
  precio numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.untables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on untables" ON public.untables;
CREATE POLICY "Allow public read on untables"
ON public.untables
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Allow public insert on untables" ON public.untables;
CREATE POLICY "Allow public insert on untables"
ON public.untables
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update on untables" ON public.untables;
CREATE POLICY "Allow public update on untables"
ON public.untables
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public delete on untables" ON public.untables;
CREATE POLICY "Allow public delete on untables"
ON public.untables
FOR DELETE
TO anon, authenticated
USING (true);
