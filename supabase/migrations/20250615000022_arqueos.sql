-- Arqueos de caja por negocio

CREATE TABLE IF NOT EXISTS public.arqueos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid NOT NULL REFERENCES public.negocios (id) ON DELETE RESTRICT,
  usuario text,
  efectivo_sistema numeric NOT NULL,
  efectivo_contado numeric NOT NULL,
  tarjeta_sistema numeric NOT NULL,
  tarjeta_contado numeric NOT NULL,
  transferencia_sistema numeric NOT NULL,
  transferencia_contado numeric NOT NULL,
  link_sistema numeric NOT NULL,
  link_contado numeric NOT NULL,
  total_sistema numeric NOT NULL,
  total_contado numeric NOT NULL,
  diferencia numeric NOT NULL,
  retiros_del_dia numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS arqueos_negocio_id_idx ON public.arqueos (negocio_id);
CREATE INDEX IF NOT EXISTS arqueos_created_at_idx ON public.arqueos (created_at DESC);

ALTER TABLE public.arqueos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_select_arqueos" ON public.arqueos;
CREATE POLICY "tenant_select_arqueos"
ON public.arqueos
FOR SELECT
TO authenticated
USING (negocio_id = public.usuario_negocio_id());

DROP POLICY IF EXISTS "tenant_insert_arqueos" ON public.arqueos;
CREATE POLICY "tenant_insert_arqueos"
ON public.arqueos
FOR INSERT
TO authenticated
WITH CHECK (negocio_id = public.usuario_negocio_id());
