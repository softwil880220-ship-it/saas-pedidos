-- ============================================================================
-- 20250613000000_pedidos_public_read.sql
-- ============================================================================

-- Dependencia base: pedidos no se crea en migraciones individuales
CREATE TABLE IF NOT EXISTS public.pedidos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cliente text,
  telefono text,
  producto text,
  total numeric,
  status text NOT NULL DEFAULT 'por-aceptar',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);


-- Lectura pública de pedidos (sin autenticación, rol anon)
DROP POLICY IF EXISTS "Allow public read on pedidos" ON public.pedidos;

CREATE POLICY "Allow public read on pedidos"
ON public.pedidos
FOR SELECT
TO anon, authenticated
USING (true);


-- ============================================================================
-- 20250615000000_productos.sql
-- ============================================================================
DROP TABLE IF EXISTS public.productos CASCADE;

-- Tabla de catálogo de productos
CREATE TABLE IF NOT EXISTS public.productos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre text NOT NULL,
  precio numeric NOT NULL,
  categoria text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;

-- Lectura pública
DROP POLICY IF EXISTS "Allow public read on productos" ON public.productos;

CREATE POLICY "Allow public read on productos"
ON public.productos
FOR SELECT
TO anon, authenticated
USING (true);

-- Inserción pública
DROP POLICY IF EXISTS "Allow public insert on productos" ON public.productos;

CREATE POLICY "Allow public insert on productos"
ON public.productos
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Eliminación pública
DROP POLICY IF EXISTS "Allow public delete on productos" ON public.productos;

CREATE POLICY "Allow public delete on productos"
ON public.productos
FOR DELETE
TO anon, authenticated
USING (true);


-- ============================================================================
-- 20250615000001_productos_update.sql
-- ============================================================================

-- Actualización pública de productos (necesaria para editar en el catálogo)
DROP POLICY IF EXISTS "Allow public update on productos" ON public.productos;

CREATE POLICY "Allow public update on productos"
ON public.productos
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);


-- ============================================================================
-- 20250615000002_pedidos_tipo.sql
-- ============================================================================

-- Tipo de pedido: presencial (caja) o whatsapp
ALTER TABLE public.pedidos
ADD COLUMN IF NOT EXISTS tipo text;

UPDATE public.pedidos
SET tipo = 'whatsapp'
WHERE tipo IS NULL;


-- ============================================================================
-- 20250615000003_pedidos_delete.sql
-- ============================================================================

-- Eliminación pública de pedidos
DROP POLICY IF EXISTS "Allow public delete on pedidos" ON public.pedidos;

CREATE POLICY "Allow public delete on pedidos"
ON public.pedidos
FOR DELETE
TO anon, authenticated
USING (true);


-- ============================================================================
-- 20250615000004_pedidos_update.sql
-- ============================================================================

-- Actualización pública de pedidos (necesaria para editar pedidos)
DROP POLICY IF EXISTS "Allow public update on pedidos" ON public.pedidos;

CREATE POLICY "Allow public update on pedidos"
ON public.pedidos
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);


-- ============================================================================
-- 20250615000005_productos_variantes.sql
-- ============================================================================

-- Variantes de producto (toppings y salsas) en JSON
ALTER TABLE public.productos
ADD COLUMN IF NOT EXISTS variantes jsonb NOT NULL DEFAULT '{"toppings":[],"salsas":[]}'::jsonb;

UPDATE public.productos
SET variantes = '{"toppings":[],"salsas":[]}'::jsonb
WHERE variantes IS NULL;


-- ============================================================================
-- 20250615000006_toppings_salsas.sql
-- ============================================================================
DROP TABLE IF EXISTS public.toppings CASCADE;
DROP TABLE IF EXISTS public.salsas CASCADE;

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


-- ============================================================================
-- 20250615000007_mayonesas_quesos_cremas_chiles.sql
-- ============================================================================
DROP TABLE IF EXISTS public.mayonesas CASCADE;
DROP TABLE IF EXISTS public.quesos CASCADE;
DROP TABLE IF EXISTS public.cremas CASCADE;
DROP TABLE IF EXISTS public.chiles CASCADE;

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


-- ============================================================================
-- 20250615000008_untables.sql
-- ============================================================================
DROP TABLE IF EXISTS public.untables CASCADE;

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


-- ============================================================================
-- 20250615000009_productos_variantes_activas.sql
-- ============================================================================

-- Categorías de variantes habilitadas por producto (array JSON de keys)
ALTER TABLE public.productos
ADD COLUMN IF NOT EXISTS variantes_activas jsonb NOT NULL DEFAULT '["quesos","cremas","chiles","mayonesas","untables","toppings","salsas"]'::jsonb;

UPDATE public.productos
SET variantes_activas = '["quesos","cremas","chiles","mayonesas","untables","toppings","salsas"]'::jsonb
WHERE variantes_activas IS NULL;


-- ============================================================================
-- 20250615000010_productos_variantes_activas_objeto.sql
-- ============================================================================

-- variantes_activas: objeto JSON { "quesos": ["1","2"], "toppings": ["5"] }
-- Cada key es una categoría; el valor es un array de IDs de items de esa categoría.
-- La app convierte el formato anterior (array de categorías) al leer productos existentes.

ALTER TABLE public.productos
ALTER COLUMN variantes_activas SET DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.productos.variantes_activas IS
'Mapa de variantes por producto: categoría -> array de IDs de items del catálogo';


-- ============================================================================
-- 20250615000011_pedidos_telefono.sql
-- ============================================================================

-- Teléfono WhatsApp del cliente en pedidos
ALTER TABLE public.pedidos
ADD COLUMN IF NOT EXISTS telefono text;

COMMENT ON COLUMN public.pedidos.telefono IS 'Teléfono WhatsApp del cliente';

-- Inserción pública (incluye telefono)
DROP POLICY IF EXISTS "Allow public insert on pedidos" ON public.pedidos;
CREATE POLICY "Allow public insert on pedidos"
ON public.pedidos
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Actualización pública (incluye telefono)
DROP POLICY IF EXISTS "Allow public update on pedidos" ON public.pedidos;
CREATE POLICY "Allow public update on pedidos"
ON public.pedidos
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Lectura pública (incluye telefono)
DROP POLICY IF EXISTS "Allow public read on pedidos" ON public.pedidos;
CREATE POLICY "Allow public read on pedidos"
ON public.pedidos
FOR SELECT
TO anon, authenticated
USING (true);


-- ============================================================================
-- 20250615000012_pedidos_lineas_detalle.sql
-- ============================================================================

-- Detalle de precios por línea al momento de crear/editar el pedido
ALTER TABLE public.pedidos
ADD COLUMN IF NOT EXISTS lineas_detalle jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.pedidos.lineas_detalle IS
'Snapshot JSON de líneas con precios del catálogo al guardar: precioBase, extras, precioUnitario, subtotal, descripcion';


-- ============================================================================
-- 20250615000013_pedidos_tipo_entrega.sql
-- ============================================================================

-- Tipo de entrega en pedidos WhatsApp (domicilio | sucursal)
ALTER TABLE public.pedidos
ADD COLUMN IF NOT EXISTS tipo_entrega text NOT NULL DEFAULT 'domicilio';

COMMENT ON COLUMN public.pedidos.tipo_entrega IS 'Tipo de entrega: domicilio o sucursal';

UPDATE public.pedidos
SET tipo_entrega = 'domicilio'
WHERE tipo_entrega IS NULL;

-- Inserción pública (incluye tipo_entrega)
DROP POLICY IF EXISTS "Allow public insert on pedidos" ON public.pedidos;
CREATE POLICY "Allow public insert on pedidos"
ON public.pedidos
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Actualización pública (incluye tipo_entrega)
DROP POLICY IF EXISTS "Allow public update on pedidos" ON public.pedidos;
CREATE POLICY "Allow public update on pedidos"
ON public.pedidos
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Lectura pública (incluye tipo_entrega)
DROP POLICY IF EXISTS "Allow public read on pedidos" ON public.pedidos;
CREATE POLICY "Allow public read on pedidos"
ON public.pedidos
FOR SELECT
TO anon, authenticated
USING (true);


-- ============================================================================
-- 20250615000014_pedidos_direccion.sql
-- ============================================================================

-- Dirección de entrega en pedidos WhatsApp a domicilio
ALTER TABLE public.pedidos
ADD COLUMN IF NOT EXISTS direccion text;

COMMENT ON COLUMN public.pedidos.direccion IS 'Dirección de entrega para pedidos a domicilio';

-- Inserción pública (incluye direccion)
DROP POLICY IF EXISTS "Allow public insert on pedidos" ON public.pedidos;
CREATE POLICY "Allow public insert on pedidos"
ON public.pedidos
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Actualización pública (incluye direccion)
DROP POLICY IF EXISTS "Allow public update on pedidos" ON public.pedidos;
CREATE POLICY "Allow public update on pedidos"
ON public.pedidos
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Lectura pública (incluye direccion)
DROP POLICY IF EXISTS "Allow public read on pedidos" ON public.pedidos;
CREATE POLICY "Allow public read on pedidos"
ON public.pedidos
FOR SELECT
TO anon, authenticated
USING (true);


-- ============================================================================
-- 20250615000015_pedidos_realtime.sql
-- ============================================================================

-- Habilitar Supabase Realtime en pedidos
ALTER TABLE public.pedidos REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'pedidos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos;
  END IF;
END $$;


-- ============================================================================
-- 20250615000016_productos_cocina.sql
-- ============================================================================

-- Cocina asignada por producto (cocina1 | cocina2 | ninguna)
ALTER TABLE public.productos
ADD COLUMN IF NOT EXISTS cocina text NOT NULL DEFAULT 'cocina1';

COMMENT ON COLUMN public.productos.cocina IS 'Cocina de preparación: cocina1, cocina2 o ninguna';

UPDATE public.productos
SET cocina = 'cocina1'
WHERE cocina IS NULL;


-- ============================================================================
-- 20250615000017_pedidos_status_cocina.sql
-- ============================================================================

-- Progreso independiente por cocina en pedidos WhatsApp
ALTER TABLE public.pedidos
ADD COLUMN IF NOT EXISTS status_cocina1 text,
ADD COLUMN IF NOT EXISTS status_cocina2 text;

COMMENT ON COLUMN public.pedidos.status_cocina1 IS 'Progreso Cocina 1: en-cocina | listo';
COMMENT ON COLUMN public.pedidos.status_cocina2 IS 'Progreso Cocina 2: en-cocina | listo';

-- Pedidos ya en cocina: Cocina 1 en preparación (legacy sin desglose por cocina)
UPDATE public.pedidos
SET status_cocina1 = 'en-cocina'
WHERE status = 'en-cocina'
  AND status_cocina1 IS NULL;


-- ============================================================================
-- 20250615000018_productos_realtime.sql
-- ============================================================================

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


-- ============================================================================
-- 20250615000019_pedidos_forma_pago_referencia.sql
-- ============================================================================

-- Forma de pago y referencia opcional en pedidos
ALTER TABLE public.pedidos
ADD COLUMN IF NOT EXISTS forma_pago text;

ALTER TABLE public.pedidos
ADD COLUMN IF NOT EXISTS referencia text;

COMMENT ON COLUMN public.pedidos.forma_pago IS
'Forma de pago opcional: efectivo, tarjeta, transferencia, link_pago';

COMMENT ON COLUMN public.pedidos.referencia IS
'Referencia o nombre adicional en ventas de caja (modo presencial)';


-- ============================================================================
-- 20250615000020_multitenant_negocios_usuarios.sql
-- ============================================================================
DROP FUNCTION IF EXISTS public.usuario_negocio_id() CASCADE;
DROP TABLE IF EXISTS public.usuarios CASCADE;
DROP TABLE IF EXISTS public.negocios CASCADE;

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

DROP FUNCTION IF EXISTS public.usuario_negocio_id() CASCADE;

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
DROP POLICY IF EXISTS "tenant_soft_delete_pedidos" ON public.pedidos;

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


-- ============================================================================
-- 20250615000021_retiros.sql
-- ============================================================================
DROP TABLE IF EXISTS public.retiros CASCADE;

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


-- ============================================================================
-- 20250615000022_arqueos.sql
-- ============================================================================
DROP TABLE IF EXISTS public.arqueos CASCADE;

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


-- ============================================================================
-- 20250615000023_arqueos_delete_policy.sql
-- ============================================================================

-- Permitir eliminar arqueos del tenant activo

DROP POLICY IF EXISTS "tenant_delete_arqueos" ON public.arqueos;
CREATE POLICY "tenant_delete_arqueos"
ON public.arqueos
FOR DELETE
TO authenticated
USING (negocio_id = public.usuario_negocio_id());


-- ============================================================================
-- 20250615000024_retiros_delete_policy.sql
-- ============================================================================

-- Permitir eliminar retiros del tenant activo

DROP POLICY IF EXISTS "tenant_delete_retiros" ON public.retiros;
CREATE POLICY "tenant_delete_retiros"
ON public.retiros
FOR DELETE
TO authenticated
USING (negocio_id = public.usuario_negocio_id());


-- ============================================================================
-- 20250615000025_fondos_fijos.sql
-- ============================================================================
DROP TABLE IF EXISTS public.fondos_fijos CASCADE;

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


-- ============================================================================
-- 20250615000026_arqueos_fondo_fijo.sql
-- ============================================================================

-- Guardar fondo fijo del día en cada arqueo

ALTER TABLE public.arqueos
ADD COLUMN IF NOT EXISTS fondo_fijo_del_dia numeric NOT NULL DEFAULT 0;


-- ============================================================================
-- 20250615000027_pedidos_folios_soft_delete.sql
-- ============================================================================
DROP TRIGGER IF EXISTS pedidos_asignar_folio ON public.pedidos;
DROP FUNCTION IF EXISTS public.pedidos_asignar_folio() CASCADE;
DROP FUNCTION IF EXISTS public.generar_folio(uuid) CASCADE;
DROP TABLE IF EXISTS public.pedidos_ediciones CASCADE;

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
DROP FUNCTION IF EXISTS public.generar_folio(uuid) CASCADE;

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
DROP FUNCTION IF EXISTS public.pedidos_asignar_folio() CASCADE;

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


