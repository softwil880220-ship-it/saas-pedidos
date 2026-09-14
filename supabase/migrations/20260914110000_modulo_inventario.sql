-- Módulo Inventario: flag de activación, catálogos, movimientos y snapshots diarios.

BEGIN;

ALTER TABLE public.negocios
  ADD COLUMN IF NOT EXISTS habilitar_inventario boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.negocios.habilitar_inventario IS
  'Activa el módulo de inventario (insumos, cargas, consumo interno y snapshots diarios).';

CREATE OR REPLACE FUNCTION public.negocio_modulo_habilitado(p_modulo text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE p_modulo
    WHEN 'caja' THEN n.habilitar_caja
    WHEN 'mostrador' THEN n.habilitar_mostrador
    WHEN 'recoger_domicilio' THEN n.habilitar_recoger_domicilio
    WHEN 'mesas' THEN n.habilitar_mesas
    WHEN 'clientes' THEN n.habilitar_clientes
    WHEN 'inventario' THEN n.habilitar_inventario
    ELSE false
  END
  FROM public.negocios n
  WHERE n.id = public.usuario_negocio_id();
$$;

-- Catálogo de insumos por negocio
CREATE TABLE public.insumos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  unidad_medida text NOT NULL,
  estrategia_saldo text NOT NULL DEFAULT 'reset_diario',
  costo_unitario numeric NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX insumos_negocio_id_idx ON public.insumos (negocio_id);

-- Catálogo de empleados por negocio (no son usuarios del sistema)
CREATE TABLE public.empleados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX empleados_negocio_id_idx ON public.empleados (negocio_id);

-- Conversión insumo → producto (recetas)
CREATE TABLE public.insumo_recetas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  producto_id bigint NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  insumo_id uuid NOT NULL REFERENCES public.insumos(id) ON DELETE CASCADE,
  cantidad_por_producto numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX insumo_recetas_negocio_id_idx ON public.insumo_recetas (negocio_id);
CREATE INDEX insumo_recetas_producto_insumo_idx ON public.insumo_recetas (producto_id, insumo_id);

-- Carga inicial y compras a media jornada (una fila por evento)
CREATE TABLE public.inventario_cargas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  jornada_id uuid NOT NULL REFERENCES public.jornadas(id) ON DELETE RESTRICT,
  insumo_id uuid NOT NULL REFERENCES public.insumos(id) ON DELETE RESTRICT,
  cantidad numeric NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('carga_inicial', 'compra_adicional')),
  autorizado_por uuid NULL REFERENCES public.usuarios_negocio(id) ON DELETE SET NULL,
  creado_por uuid NOT NULL REFERENCES public.usuarios_negocio(id) ON DELETE RESTRICT,
  deleted_at timestamptz NULL,
  deleted_by uuid NULL REFERENCES public.usuarios_negocio(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX inventario_cargas_negocio_id_idx ON public.inventario_cargas (negocio_id);
CREATE INDEX inventario_cargas_jornada_id_idx ON public.inventario_cargas (jornada_id);

-- Consumo de personal (por producto vía receta)
CREATE TABLE public.inventario_consumo_interno (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  jornada_id uuid NOT NULL REFERENCES public.jornadas(id) ON DELETE RESTRICT,
  empleado_id uuid NULL REFERENCES public.empleados(id) ON DELETE SET NULL,
  producto_id bigint NOT NULL REFERENCES public.productos(id) ON DELETE RESTRICT,
  cantidad numeric NOT NULL,
  autorizado_por uuid NULL REFERENCES public.usuarios_negocio(id) ON DELETE SET NULL,
  creado_por uuid NOT NULL REFERENCES public.usuarios_negocio(id) ON DELETE RESTRICT,
  deleted_at timestamptz NULL,
  deleted_by uuid NULL REFERENCES public.usuarios_negocio(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX inventario_consumo_interno_negocio_id_idx ON public.inventario_consumo_interno (negocio_id);
CREATE INDEX inventario_consumo_interno_jornada_id_idx ON public.inventario_consumo_interno (jornada_id);

-- Snapshot diario congelado (mismo espíritu que arqueos: insert-only)
CREATE TABLE public.inventario_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  jornada_id uuid NOT NULL REFERENCES public.jornadas(id) ON DELETE RESTRICT,
  detalle jsonb NOT NULL,
  autorizado_por uuid NULL REFERENCES public.usuarios_negocio(id) ON DELETE SET NULL,
  creado_por uuid NOT NULL REFERENCES public.usuarios_negocio(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX inventario_snapshots_negocio_id_idx ON public.inventario_snapshots (negocio_id);
CREATE INDEX inventario_snapshots_jornada_id_idx ON public.inventario_snapshots (jornada_id);

COMMENT ON COLUMN public.inventario_snapshots.detalle IS
  'Snapshot congelado al cierre de jornada. Por insumo: carga_inicial, consumo_venta, consumo_empleados, merma_explicada, contado_fisico, diferencia. No se actualiza después del INSERT.';

-- RLS: insumos
ALTER TABLE public.insumos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_select_insumos ON public.insumos;
DROP POLICY IF EXISTS tenant_insert_insumos ON public.insumos;
DROP POLICY IF EXISTS tenant_update_insumos ON public.insumos;
DROP POLICY IF EXISTS tenant_delete_insumos ON public.insumos;

CREATE POLICY tenant_select_insumos
ON public.insumos
FOR SELECT TO authenticated
USING (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('inventario'), false)
);

CREATE POLICY tenant_insert_insumos
ON public.insumos
FOR INSERT TO authenticated
WITH CHECK (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('inventario'), false)
);

CREATE POLICY tenant_update_insumos
ON public.insumos
FOR UPDATE TO authenticated
USING (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('inventario'), false)
)
WITH CHECK (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('inventario'), false)
);

CREATE POLICY tenant_delete_insumos
ON public.insumos
FOR DELETE TO authenticated
USING (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('inventario'), false)
);

-- RLS: empleados
ALTER TABLE public.empleados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_select_empleados ON public.empleados;
DROP POLICY IF EXISTS tenant_insert_empleados ON public.empleados;
DROP POLICY IF EXISTS tenant_update_empleados ON public.empleados;
DROP POLICY IF EXISTS tenant_delete_empleados ON public.empleados;

CREATE POLICY tenant_select_empleados
ON public.empleados
FOR SELECT TO authenticated
USING (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('inventario'), false)
);

CREATE POLICY tenant_insert_empleados
ON public.empleados
FOR INSERT TO authenticated
WITH CHECK (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('inventario'), false)
);

CREATE POLICY tenant_update_empleados
ON public.empleados
FOR UPDATE TO authenticated
USING (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('inventario'), false)
)
WITH CHECK (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('inventario'), false)
);

CREATE POLICY tenant_delete_empleados
ON public.empleados
FOR DELETE TO authenticated
USING (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('inventario'), false)
);

-- RLS: insumo_recetas
ALTER TABLE public.insumo_recetas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_select_insumo_recetas ON public.insumo_recetas;
DROP POLICY IF EXISTS tenant_insert_insumo_recetas ON public.insumo_recetas;
DROP POLICY IF EXISTS tenant_update_insumo_recetas ON public.insumo_recetas;
DROP POLICY IF EXISTS tenant_delete_insumo_recetas ON public.insumo_recetas;

CREATE POLICY tenant_select_insumo_recetas
ON public.insumo_recetas
FOR SELECT TO authenticated
USING (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('inventario'), false)
);

CREATE POLICY tenant_insert_insumo_recetas
ON public.insumo_recetas
FOR INSERT TO authenticated
WITH CHECK (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('inventario'), false)
);

CREATE POLICY tenant_update_insumo_recetas
ON public.insumo_recetas
FOR UPDATE TO authenticated
USING (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('inventario'), false)
)
WITH CHECK (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('inventario'), false)
);

CREATE POLICY tenant_delete_insumo_recetas
ON public.insumo_recetas
FOR DELETE TO authenticated
USING (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('inventario'), false)
);

-- RLS: inventario_cargas
ALTER TABLE public.inventario_cargas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_select_inventario_cargas ON public.inventario_cargas;
DROP POLICY IF EXISTS tenant_insert_inventario_cargas ON public.inventario_cargas;
DROP POLICY IF EXISTS tenant_update_inventario_cargas ON public.inventario_cargas;
DROP POLICY IF EXISTS tenant_delete_inventario_cargas ON public.inventario_cargas;
DROP POLICY IF EXISTS tenant_soft_delete_inventario_cargas ON public.inventario_cargas;

CREATE POLICY tenant_select_inventario_cargas
ON public.inventario_cargas
FOR SELECT TO authenticated
USING (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('inventario'), false)
  AND deleted_at IS NULL
);

CREATE POLICY tenant_insert_inventario_cargas
ON public.inventario_cargas
FOR INSERT TO authenticated
WITH CHECK (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('inventario'), false)
);

CREATE POLICY tenant_update_inventario_cargas
ON public.inventario_cargas
FOR UPDATE TO authenticated
USING (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('inventario'), false)
  AND deleted_at IS NULL
)
WITH CHECK (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('inventario'), false)
  AND deleted_at IS NULL
);

CREATE POLICY tenant_soft_delete_inventario_cargas
ON public.inventario_cargas
FOR UPDATE TO authenticated
USING (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('inventario'), false)
  AND deleted_at IS NULL
)
WITH CHECK (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('inventario'), false)
  AND deleted_at IS NOT NULL
);

-- RLS: inventario_consumo_interno
ALTER TABLE public.inventario_consumo_interno ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_select_inventario_consumo_interno ON public.inventario_consumo_interno;
DROP POLICY IF EXISTS tenant_insert_inventario_consumo_interno ON public.inventario_consumo_interno;
DROP POLICY IF EXISTS tenant_update_inventario_consumo_interno ON public.inventario_consumo_interno;
DROP POLICY IF EXISTS tenant_delete_inventario_consumo_interno ON public.inventario_consumo_interno;
DROP POLICY IF EXISTS tenant_soft_delete_inventario_consumo_interno ON public.inventario_consumo_interno;

CREATE POLICY tenant_select_inventario_consumo_interno
ON public.inventario_consumo_interno
FOR SELECT TO authenticated
USING (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('inventario'), false)
  AND deleted_at IS NULL
);

CREATE POLICY tenant_insert_inventario_consumo_interno
ON public.inventario_consumo_interno
FOR INSERT TO authenticated
WITH CHECK (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('inventario'), false)
);

CREATE POLICY tenant_update_inventario_consumo_interno
ON public.inventario_consumo_interno
FOR UPDATE TO authenticated
USING (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('inventario'), false)
  AND deleted_at IS NULL
)
WITH CHECK (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('inventario'), false)
  AND deleted_at IS NULL
);

CREATE POLICY tenant_soft_delete_inventario_consumo_interno
ON public.inventario_consumo_interno
FOR UPDATE TO authenticated
USING (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('inventario'), false)
  AND deleted_at IS NULL
)
WITH CHECK (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('inventario'), false)
  AND deleted_at IS NOT NULL
);

-- RLS: inventario_snapshots (select + insert; insert-only como arqueos)
ALTER TABLE public.inventario_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_select_inventario_snapshots ON public.inventario_snapshots;
DROP POLICY IF EXISTS tenant_insert_inventario_snapshots ON public.inventario_snapshots;
DROP POLICY IF EXISTS tenant_update_inventario_snapshots ON public.inventario_snapshots;
DROP POLICY IF EXISTS tenant_delete_inventario_snapshots ON public.inventario_snapshots;

CREATE POLICY tenant_select_inventario_snapshots
ON public.inventario_snapshots
FOR SELECT TO authenticated
USING (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('inventario'), false)
);

CREATE POLICY tenant_insert_inventario_snapshots
ON public.inventario_snapshots
FOR INSERT TO authenticated
WITH CHECK (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('inventario'), false)
);

COMMIT;
