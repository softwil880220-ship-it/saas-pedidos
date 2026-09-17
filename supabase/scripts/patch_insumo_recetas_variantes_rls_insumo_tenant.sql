-- Parche manual (DEV): validación de tenant para insumo_id en insumo_recetas_variantes.
-- La tabla ya existe; no recrear migración 20260914120000.
-- Ejecutar en Supabase SQL Editor en DEV antes de desplegar PROD con el archivo fuente actualizado.

BEGIN;

DROP POLICY IF EXISTS tenant_insert_insumo_recetas_variantes ON public.insumo_recetas_variantes;
DROP POLICY IF EXISTS tenant_update_insumo_recetas_variantes ON public.insumo_recetas_variantes;

CREATE POLICY tenant_insert_insumo_recetas_variantes
ON public.insumo_recetas_variantes
FOR INSERT TO authenticated
WITH CHECK (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('inventario'), false)
  AND EXISTS (
    SELECT 1
    FROM public.items_variantes iv
    INNER JOIN public.categorias_variantes cv ON cv.id = iv.categoria_id
    WHERE iv.id = item_variante_id
      AND cv.negocio_id = negocio_id
  )
  AND EXISTS (
    SELECT 1
    FROM public.insumos i
    WHERE i.id = insumo_id
      AND i.negocio_id = negocio_id
  )
);

CREATE POLICY tenant_update_insumo_recetas_variantes
ON public.insumo_recetas_variantes
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
    FROM public.items_variantes iv
    INNER JOIN public.categorias_variantes cv ON cv.id = iv.categoria_id
    WHERE iv.id = item_variante_id
      AND cv.negocio_id = negocio_id
  )
  AND EXISTS (
    SELECT 1
    FROM public.insumos i
    WHERE i.id = insumo_id
      AND i.negocio_id = negocio_id
  )
);

COMMIT;
