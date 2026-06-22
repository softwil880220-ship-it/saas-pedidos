-- Multitenant: negocios, usuarios y negocio_id en tablas de datos

CREATE TABLE IF NOT EXISTS public.negocios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  plan text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.usuarios (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  negocio_id uuid NOT NULL REFERENCES public.negocios (id) ON DELETE RESTRICT,
  rol text NOT NULL
);

ALTER TABLE public.chiles ADD COLUMN IF NOT EXISTS negocio_id uuid REFERENCES public.negocios (id);
ALTER TABLE public.cremas ADD COLUMN IF NOT EXISTS negocio_id uuid REFERENCES public.negocios (id);
ALTER TABLE public.mayonesas ADD COLUMN IF NOT EXISTS negocio_id uuid REFERENCES public.negocios (id);
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS negocio_id uuid REFERENCES public.negocios (id);
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS negocio_id uuid REFERENCES public.negocios (id);
ALTER TABLE public.quesos ADD COLUMN IF NOT EXISTS negocio_id uuid REFERENCES public.negocios (id);
ALTER TABLE public.salsas ADD COLUMN IF NOT EXISTS negocio_id uuid REFERENCES public.negocios (id);
ALTER TABLE public.toppings ADD COLUMN IF NOT EXISTS negocio_id uuid REFERENCES public.negocios (id);
ALTER TABLE public.untables ADD COLUMN IF NOT EXISTS negocio_id uuid REFERENCES public.negocios (id);

CREATE INDEX IF NOT EXISTS chiles_negocio_id_idx ON public.chiles (negocio_id);
CREATE INDEX IF NOT EXISTS cremas_negocio_id_idx ON public.cremas (negocio_id);
CREATE INDEX IF NOT EXISTS mayonesas_negocio_id_idx ON public.mayonesas (negocio_id);
CREATE INDEX IF NOT EXISTS pedidos_negocio_id_idx ON public.pedidos (negocio_id);
CREATE INDEX IF NOT EXISTS productos_negocio_id_idx ON public.productos (negocio_id);
CREATE INDEX IF NOT EXISTS quesos_negocio_id_idx ON public.quesos (negocio_id);
CREATE INDEX IF NOT EXISTS salsas_negocio_id_idx ON public.salsas (negocio_id);
CREATE INDEX IF NOT EXISTS toppings_negocio_id_idx ON public.toppings (negocio_id);
CREATE INDEX IF NOT EXISTS untables_negocio_id_idx ON public.untables (negocio_id);
CREATE INDEX IF NOT EXISTS usuarios_negocio_id_idx ON public.usuarios (negocio_id);

CREATE OR REPLACE FUNCTION public.usuario_negocio_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT negocio_id FROM public.usuarios WHERE id = auth.uid();
$$;

ALTER TABLE public.negocios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cremas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mayonesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quesos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salsas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toppings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.untables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "negocios_read_own" ON public.negocios;
CREATE POLICY "negocios_read_own"
ON public.negocios
FOR SELECT
TO authenticated
USING (id = public.usuario_negocio_id());

DROP POLICY IF EXISTS "usuarios_read_own" ON public.usuarios;
CREATE POLICY "usuarios_read_own"
ON public.usuarios
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- pedidos
DROP POLICY IF EXISTS "Allow public read on pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Allow public insert on pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Allow public update on pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Allow public delete on pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "tenant_select_pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "tenant_insert_pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "tenant_update_pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "tenant_delete_pedidos" ON public.pedidos;

CREATE POLICY "tenant_select_pedidos" ON public.pedidos FOR SELECT TO authenticated
USING (negocio_id IS NOT NULL AND negocio_id = public.usuario_negocio_id());
CREATE POLICY "tenant_insert_pedidos" ON public.pedidos FOR INSERT TO authenticated
WITH CHECK (negocio_id = public.usuario_negocio_id());
CREATE POLICY "tenant_update_pedidos" ON public.pedidos FOR UPDATE TO authenticated
USING (negocio_id = public.usuario_negocio_id())
WITH CHECK (negocio_id = public.usuario_negocio_id());
CREATE POLICY "tenant_delete_pedidos" ON public.pedidos FOR DELETE TO authenticated
USING (negocio_id = public.usuario_negocio_id());

-- productos
DROP POLICY IF EXISTS "Allow public read on productos" ON public.productos;
DROP POLICY IF EXISTS "Allow public insert on productos" ON public.productos;
DROP POLICY IF EXISTS "Allow public update on productos" ON public.productos;
DROP POLICY IF EXISTS "Allow public delete on productos" ON public.productos;
DROP POLICY IF EXISTS "tenant_select_productos" ON public.productos;
DROP POLICY IF EXISTS "tenant_insert_productos" ON public.productos;
DROP POLICY IF EXISTS "tenant_update_productos" ON public.productos;
DROP POLICY IF EXISTS "tenant_delete_productos" ON public.productos;

CREATE POLICY "tenant_select_productos" ON public.productos FOR SELECT TO authenticated
USING (negocio_id IS NOT NULL AND negocio_id = public.usuario_negocio_id());
CREATE POLICY "tenant_insert_productos" ON public.productos FOR INSERT TO authenticated
WITH CHECK (negocio_id = public.usuario_negocio_id());
CREATE POLICY "tenant_update_productos" ON public.productos FOR UPDATE TO authenticated
USING (negocio_id = public.usuario_negocio_id())
WITH CHECK (negocio_id = public.usuario_negocio_id());
CREATE POLICY "tenant_delete_productos" ON public.productos FOR DELETE TO authenticated
USING (negocio_id = public.usuario_negocio_id());

-- Macro-like policies for variant tables
DO $$
DECLARE
  tabla text;
BEGIN
  FOREACH tabla IN ARRAY ARRAY[
    'chiles', 'cremas', 'mayonesas', 'quesos', 'salsas', 'toppings', 'untables'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Allow public read on %I" ON public.%I', tabla, tabla);
    EXECUTE format('DROP POLICY IF EXISTS "Allow public insert on %I" ON public.%I', tabla, tabla);
    EXECUTE format('DROP POLICY IF EXISTS "Allow public update on %I" ON public.%I', tabla, tabla);
    EXECUTE format('DROP POLICY IF EXISTS "Allow public delete on %I" ON public.%I', tabla, tabla);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_select_%I" ON public.%I', tabla, tabla);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_insert_%I" ON public.%I', tabla, tabla);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_update_%I" ON public.%I', tabla, tabla);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_delete_%I" ON public.%I', tabla, tabla);

    EXECUTE format(
      'CREATE POLICY "tenant_select_%I" ON public.%I FOR SELECT TO authenticated USING (negocio_id IS NOT NULL AND negocio_id = public.usuario_negocio_id())',
      tabla, tabla
    );
    EXECUTE format(
      'CREATE POLICY "tenant_insert_%I" ON public.%I FOR INSERT TO authenticated WITH CHECK (negocio_id = public.usuario_negocio_id())',
      tabla, tabla
    );
    EXECUTE format(
      'CREATE POLICY "tenant_update_%I" ON public.%I FOR UPDATE TO authenticated USING (negocio_id = public.usuario_negocio_id()) WITH CHECK (negocio_id = public.usuario_negocio_id())',
      tabla, tabla
    );
    EXECUTE format(
      'CREATE POLICY "tenant_delete_%I" ON public.%I FOR DELETE TO authenticated USING (negocio_id = public.usuario_negocio_id())',
      tabla, tabla
    );
  END LOOP;
END $$;
