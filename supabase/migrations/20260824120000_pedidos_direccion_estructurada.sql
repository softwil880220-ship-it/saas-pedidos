-- Dirección estructurada en pedidos a domicilio.
-- Agrega columnas para capturar calle, número, entre calles, direccion_referencia,
-- colonia, municipio y zona_id en pedidos. Todas nullable.
-- pedidos.direccion sigue siendo el resumen de texto calculado al guardar.
-- pedidos.referencia no se modifica (sigue reservada para ventas de caja).

BEGIN;

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS calle text,
  ADD COLUMN IF NOT EXISTS numero text,
  ADD COLUMN IF NOT EXISTS entre_calles text,
  ADD COLUMN IF NOT EXISTS direccion_referencia text,
  ADD COLUMN IF NOT EXISTS colonia text,
  ADD COLUMN IF NOT EXISTS municipio text,
  ADD COLUMN IF NOT EXISTS zona_id uuid REFERENCES public.zonas (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.pedidos.calle IS 'Calle de entrega (domicilio)';
COMMENT ON COLUMN public.pedidos.numero IS 'Número exterior/interior de entrega (domicilio)';
COMMENT ON COLUMN public.pedidos.entre_calles IS 'Entre calles de entrega (domicilio)';
COMMENT ON COLUMN public.pedidos.direccion_referencia IS 'Referencia de entrega (domicilio)';
COMMENT ON COLUMN public.pedidos.colonia IS 'Colonia de entrega (domicilio)';
COMMENT ON COLUMN public.pedidos.municipio IS 'Municipio de entrega (domicilio)';
COMMENT ON COLUMN public.pedidos.zona_id IS 'Zona de reparto asignada al pedido (domicilio)';

COMMIT;
