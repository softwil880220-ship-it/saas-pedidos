-- Inventario: validar en INSERT/UPDATE que las FKs hijas pertenezcan al negocio_id de la fila.

BEGIN;

-- insumo_recetas
DROP POLICY IF EXISTS tenant_insert_insumo_recetas ON public.insumo_recetas;
DROP POLICY IF EXISTS tenant_update_insumo_recetas ON public.insumo_recetas;

CREATE POLICY tenant_insert_insumo_recetas
ON public.insumo_recetas
FOR INSERT TO authenticated
WITH CHECK (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('inventario'), false)
  AND EXISTS (
    SELECT 1
    FROM public.productos p
    WHERE p.id = producto_id
      AND p.negocio_id = negocio_id
  )
  AND EXISTS (
    SELECT 1
    FROM public.insumos i
    WHERE i.id = insumo_id
      AND i.negocio_id = negocio_id
  )
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
  AND EXISTS (
    SELECT 1
    FROM public.productos p
    WHERE p.id = producto_id
      AND p.negocio_id = negocio_id
  )
  AND EXISTS (
    SELECT 1
    FROM public.insumos i
    WHERE i.id = insumo_id
      AND i.negocio_id = negocio_id
  )
);

-- inventario_cargas
DROP POLICY IF EXISTS tenant_insert_inventario_cargas ON public.inventario_cargas;
DROP POLICY IF EXISTS tenant_update_inventario_cargas ON public.inventario_cargas;

CREATE POLICY tenant_insert_inventario_cargas
ON public.inventario_cargas
FOR INSERT TO authenticated
WITH CHECK (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('inventario'), false)
  AND EXISTS (
    SELECT 1
    FROM public.jornadas j
    WHERE j.id = jornada_id
      AND j.negocio_id = negocio_id
  )
  AND EXISTS (
    SELECT 1
    FROM public.insumos i
    WHERE i.id = insumo_id
      AND i.negocio_id = negocio_id
  )
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
  AND EXISTS (
    SELECT 1
    FROM public.jornadas j
    WHERE j.id = jornada_id
      AND j.negocio_id = negocio_id
  )
  AND EXISTS (
    SELECT 1
    FROM public.insumos i
    WHERE i.id = insumo_id
      AND i.negocio_id = negocio_id
  )
);

-- inventario_consumo_interno
DROP POLICY IF EXISTS tenant_insert_inventario_consumo_interno ON public.inventario_consumo_interno;
DROP POLICY IF EXISTS tenant_update_inventario_consumo_interno ON public.inventario_consumo_interno;

CREATE POLICY tenant_insert_inventario_consumo_interno
ON public.inventario_consumo_interno
FOR INSERT TO authenticated
WITH CHECK (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('inventario'), false)
  AND EXISTS (
    SELECT 1
    FROM public.jornadas j
    WHERE j.id = jornada_id
      AND j.negocio_id = negocio_id
  )
  AND EXISTS (
    SELECT 1
    FROM public.productos p
    WHERE p.id = producto_id
      AND p.negocio_id = negocio_id
  )
  AND (
    empleado_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.empleados e
      WHERE e.id = empleado_id
        AND e.negocio_id = negocio_id
    )
  )
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
  AND EXISTS (
    SELECT 1
    FROM public.jornadas j
    WHERE j.id = jornada_id
      AND j.negocio_id = negocio_id
  )
  AND EXISTS (
    SELECT 1
    FROM public.productos p
    WHERE p.id = producto_id
      AND p.negocio_id = negocio_id
  )
  AND (
    empleado_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.empleados e
      WHERE e.id = empleado_id
        AND e.negocio_id = negocio_id
    )
  )
);

-- inventario_snapshots (solo INSERT en el módulo)
DROP POLICY IF EXISTS tenant_insert_inventario_snapshots ON public.inventario_snapshots;

CREATE POLICY tenant_insert_inventario_snapshots
ON public.inventario_snapshots
FOR INSERT TO authenticated
WITH CHECK (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('inventario'), false)
  AND EXISTS (
    SELECT 1
    FROM public.jornadas j
    WHERE j.id = jornada_id
      AND j.negocio_id = negocio_id
  )
);

COMMIT;
