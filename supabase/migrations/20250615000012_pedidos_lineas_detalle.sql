-- Detalle de precios por línea al momento de crear/editar el pedido
ALTER TABLE public.pedidos
ADD COLUMN IF NOT EXISTS lineas_detalle jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.pedidos.lineas_detalle IS
'Snapshot JSON de líneas con precios del catálogo al guardar: precioBase, extras, precioUnitario, subtotal, descripcion';
