ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS programado_para timestamptz;

ALTER TABLE public.negocios
  ADD COLUMN IF NOT EXISTS minutos_anticipacion_cocina integer NOT NULL DEFAULT 30;

COMMENT ON COLUMN public.pedidos.programado_para IS
  'Fecha/hora prometida de entrega para pedidos programados Recoger/Domicilio. NULL = pedido normal.';

COMMENT ON COLUMN public.negocios.minutos_anticipacion_cocina IS
  'Minutos antes de programado_para en que el pedido pasa a Tiempo real en Vista Cocina.';
