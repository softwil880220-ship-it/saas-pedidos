-- Recetas de insumos por extra/variante de catálogo (compartidas por item_variante_id).

BEGIN;

CREATE TABLE public.insumo_recetas_variantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  item_variante_id uuid NOT NULL REFERENCES public.items_variantes(id) ON DELETE CASCADE,
  insumo_id uuid NOT NULL REFERENCES public.insumos(id) ON DELETE CASCADE,
  cantidad_por_extra numeric NOT NULL CHECK (cantidad_por_extra > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX insumo_recetas_variantes_negocio_id_idx
  ON public.insumo_recetas_variantes (negocio_id);

CREATE UNIQUE INDEX insumo_recetas_variantes_item_insumo_idx
  ON public.insumo_recetas_variantes (item_variante_id, insumo_id);

ALTER TABLE public.insumo_recetas_variantes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_select_insumo_recetas_variantes ON public.insumo_recetas_variantes;
DROP POLICY IF EXISTS tenant_insert_insumo_recetas_variantes ON public.insumo_recetas_variantes;
DROP POLICY IF EXISTS tenant_update_insumo_recetas_variantes ON public.insumo_recetas_variantes;
DROP POLICY IF EXISTS tenant_delete_insumo_recetas_variantes ON public.insumo_recetas_variantes;

CREATE POLICY tenant_select_insumo_recetas_variantes
ON public.insumo_recetas_variantes
FOR SELECT TO authenticated
USING (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('inventario'), false)
);

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

CREATE POLICY tenant_delete_insumo_recetas_variantes
ON public.insumo_recetas_variantes
FOR DELETE TO authenticated
USING (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('inventario'), false)
);

COMMIT;
