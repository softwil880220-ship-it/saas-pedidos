-- Folios, soft delete y auditoría de ediciones en pedidos

-- a) negocios: prefijo y contador de folio
ALTER TABLE public.negocios
  ADD COLUMN IF NOT EXISTS folio_prefix TEXT DEFAULT 'ORD',
  ADD COLUMN IF NOT EXISTS folio_ultimo_numero INTEGER DEFAULT 0;

-- b) pedidos: folio y soft delete
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS folio TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS pedidos_deleted_at_idx ON public.pedidos (deleted_at);

-- c) pedidos_ediciones
CREATE TABLE IF NOT EXISTS public.pedidos_ediciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id BIGINT REFERENCES public.pedidos(id),
  negocio_id UUID REFERENCES public.negocios(id),
  editado_por UUID REFERENCES auth.users(id),
  campo_modificado TEXT,
  valor_anterior TEXT,
  valor_nuevo TEXT,
  editado_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.pedidos_ediciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_select_pedidos_ediciones" ON public.pedidos_ediciones;
DROP POLICY IF EXISTS "tenant_insert_pedidos_ediciones" ON public.pedidos_ediciones;

CREATE POLICY "tenant_select_pedidos_ediciones" ON public.pedidos_ediciones
FOR SELECT TO authenticated
USING (negocio_id = public.usuario_negocio_id());

CREATE POLICY "tenant_insert_pedidos_ediciones" ON public.pedidos_ediciones
FOR INSERT TO authenticated
WITH CHECK (negocio_id = public.usuario_negocio_id());

-- d) generar_folio
CREATE OR REPLACE FUNCTION public.generar_folio(p_negocio_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix TEXT;
  v_numero INTEGER;
BEGIN
  SELECT COALESCE(folio_prefix, 'ORD'), folio_ultimo_numero + 1
  INTO v_prefix, v_numero
  FROM public.negocios
  WHERE id = p_negocio_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Negocio no encontrado: %', p_negocio_id;
  END IF;

  UPDATE public.negocios
  SET folio_ultimo_numero = v_numero
  WHERE id = p_negocio_id;

  RETURN v_prefix || '-' || LPAD(v_numero::TEXT, 4, '0');
END;
$$;

-- e) trigger BEFORE INSERT
CREATE OR REPLACE FUNCTION public.pedidos_asignar_folio()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.folio IS NULL AND NEW.negocio_id IS NOT NULL THEN
    NEW.folio := public.generar_folio(NEW.negocio_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pedidos_asignar_folio ON public.pedidos;

CREATE TRIGGER pedidos_asignar_folio
BEFORE INSERT ON public.pedidos
FOR EACH ROW
EXECUTE FUNCTION public.pedidos_asignar_folio();

-- f) soft delete: quitar DELETE, política UPDATE para deleted_at/deleted_by
DROP POLICY IF EXISTS "tenant_delete_pedidos" ON public.pedidos;

DROP POLICY IF EXISTS "tenant_soft_delete_pedidos" ON public.pedidos;

CREATE POLICY "tenant_soft_delete_pedidos" ON public.pedidos
FOR UPDATE TO authenticated
USING (negocio_id = public.usuario_negocio_id())
WITH CHECK (negocio_id = public.usuario_negocio_id());
