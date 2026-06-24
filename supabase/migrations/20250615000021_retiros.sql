-- Retiros de efectivo por negocio

CREATE TABLE IF NOT EXISTS public.retiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid NOT NULL REFERENCES public.negocios (id) ON DELETE RESTRICT,
  monto numeric NOT NULL,
  motivo text NOT NULL,
  usuario text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS retiros_negocio_id_idx ON public.retiros (negocio_id);
CREATE INDEX IF NOT EXISTS retiros_created_at_idx ON public.retiros (created_at DESC);

ALTER TABLE public.retiros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_select_retiros" ON public.retiros;
CREATE POLICY "tenant_select_retiros"
ON public.retiros
FOR SELECT
TO authenticated
USING (negocio_id = public.usuario_negocio_id());

DROP POLICY IF EXISTS "tenant_insert_retiros" ON public.retiros;
CREATE POLICY "tenant_insert_retiros"
ON public.retiros
FOR INSERT
TO authenticated
WITH CHECK (negocio_id = public.usuario_negocio_id());
