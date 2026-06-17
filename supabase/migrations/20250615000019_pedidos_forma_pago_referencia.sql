-- Forma de pago y referencia opcional en pedidos
ALTER TABLE public.pedidos
ADD COLUMN IF NOT EXISTS forma_pago text;

ALTER TABLE public.pedidos
ADD COLUMN IF NOT EXISTS referencia text;

COMMENT ON COLUMN public.pedidos.forma_pago IS
'Forma de pago opcional: efectivo, tarjeta, transferencia, link_pago';

COMMENT ON COLUMN public.pedidos.referencia IS
'Referencia o nombre adicional en ventas de caja (modo presencial)';
