ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS jornada_id uuid REFERENCES public.jornadas(id) ON DELETE SET NULL;
ALTER TABLE public.mesas_folios ADD COLUMN IF NOT EXISTS jornada_id uuid REFERENCES public.jornadas(id) ON DELETE SET NULL;
ALTER TABLE public.arqueos ADD COLUMN IF NOT EXISTS jornada_id uuid REFERENCES public.jornadas(id) ON DELETE SET NULL;
ALTER TABLE public.fondos_fijos ADD COLUMN IF NOT EXISTS jornada_id uuid REFERENCES public.jornadas(id) ON DELETE SET NULL;
ALTER TABLE public.retiros ADD COLUMN IF NOT EXISTS jornada_id uuid REFERENCES public.jornadas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS pedidos_jornada_id_idx ON public.pedidos (jornada_id);
CREATE INDEX IF NOT EXISTS mesas_folios_jornada_id_idx ON public.mesas_folios (jornada_id);
