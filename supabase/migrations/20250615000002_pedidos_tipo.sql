-- Tipo de pedido: presencial (caja) o whatsapp
ALTER TABLE public.pedidos
ADD COLUMN IF NOT EXISTS tipo text;

UPDATE public.pedidos
SET tipo = 'whatsapp'
WHERE tipo IS NULL;
