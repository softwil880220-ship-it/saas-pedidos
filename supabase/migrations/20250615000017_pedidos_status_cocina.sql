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
