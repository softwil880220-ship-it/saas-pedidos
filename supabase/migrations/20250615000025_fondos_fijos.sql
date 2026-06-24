-- Fondos fijos de caja por negocio

CREATE TABLE IF NOT EXISTS public.fondos_fijos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid NOT NULL REFERENCES public.negocios (id) ON DELETE RESTRICT,
  monto numeric NOT NULL,
  usuario text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fondos_fijos_negocio_id_idx ON public.fondos_fijos (negocio_id);
CREATE INDEX IF NOT EXISTS fondos_fijos_created_at_idx ON public.fondos_fijos (created_at DESC);

ALTER TABLE public.fondos_fijos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_select_fondos_fijos" ON public.fondos_fijos;
CREATE POLICY "tenant_select_fondos_fijos"
ON public.fondos_fijos
FOR SELECT
TO authenticated
USING (negocio_id = public.usuario_negocio_id());

DROP POLICY IF EXISTS "tenant_insert_fondos_fijos" ON public.fondos_fijos;
CREATE POLICY "tenant_insert_fondos_fijos"
ON public.fondos_fijos
FOR INSERT
TO authenticated
WITH CHECK (negocio_id = public.usuario_negocio_id());

DROP POLICY IF EXISTS "tenant_delete_fondos_fijos" ON public.fondos_fijos;
CREATE POLICY "tenant_delete_fondos_fijos"
ON public.fondos_fijos
FOR DELETE
TO authenticated
USING (negocio_id = public.usuario_negocio_id());
