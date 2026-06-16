-- Habilitar Supabase Realtime en productos (INSERT, UPDATE, DELETE)
ALTER TABLE public.productos REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'productos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.productos;
  END IF;
END $$;
