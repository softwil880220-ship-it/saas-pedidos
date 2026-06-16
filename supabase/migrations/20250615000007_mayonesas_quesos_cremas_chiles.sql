-- Catálogo independiente de mayonesas
CREATE TABLE IF NOT EXISTS public.mayonesas (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre text NOT NULL,
  precio numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mayonesas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on mayonesas" ON public.mayonesas;
CREATE POLICY "Allow public read on mayonesas"
ON public.mayonesas FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow public insert on mayonesas" ON public.mayonesas;
CREATE POLICY "Allow public insert on mayonesas"
ON public.mayonesas FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update on mayonesas" ON public.mayonesas;
CREATE POLICY "Allow public update on mayonesas"
ON public.mayonesas FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public delete on mayonesas" ON public.mayonesas;
CREATE POLICY "Allow public delete on mayonesas"
ON public.mayonesas FOR DELETE TO anon, authenticated USING (true);

-- Catálogo independiente de quesos
CREATE TABLE IF NOT EXISTS public.quesos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre text NOT NULL,
  precio numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quesos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on quesos" ON public.quesos;
CREATE POLICY "Allow public read on quesos"
ON public.quesos FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow public insert on quesos" ON public.quesos;
CREATE POLICY "Allow public insert on quesos"
ON public.quesos FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update on quesos" ON public.quesos;
CREATE POLICY "Allow public update on quesos"
ON public.quesos FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public delete on quesos" ON public.quesos;
CREATE POLICY "Allow public delete on quesos"
ON public.quesos FOR DELETE TO anon, authenticated USING (true);

-- Catálogo independiente de cremas
CREATE TABLE IF NOT EXISTS public.cremas (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre text NOT NULL,
  precio numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cremas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on cremas" ON public.cremas;
CREATE POLICY "Allow public read on cremas"
ON public.cremas FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow public insert on cremas" ON public.cremas;
CREATE POLICY "Allow public insert on cremas"
ON public.cremas FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update on cremas" ON public.cremas;
CREATE POLICY "Allow public update on cremas"
ON public.cremas FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public delete on cremas" ON public.cremas;
CREATE POLICY "Allow public delete on cremas"
ON public.cremas FOR DELETE TO anon, authenticated USING (true);

-- Catálogo independiente de chiles
CREATE TABLE IF NOT EXISTS public.chiles (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre text NOT NULL,
  precio numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on chiles" ON public.chiles;
CREATE POLICY "Allow public read on chiles"
ON public.chiles FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow public insert on chiles" ON public.chiles;
CREATE POLICY "Allow public insert on chiles"
ON public.chiles FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update on chiles" ON public.chiles;
CREATE POLICY "Allow public update on chiles"
ON public.chiles FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public delete on chiles" ON public.chiles;
CREATE POLICY "Allow public delete on chiles"
ON public.chiles FOR DELETE TO anon, authenticated USING (true);
