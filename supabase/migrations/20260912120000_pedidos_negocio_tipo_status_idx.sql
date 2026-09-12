-- Índice compuesto para filtros de Mostrador/Dashboard por negocio + tipo + status.
-- Aplicar manualmente en Supabase SQL Editor si no se usa el pipeline de migraciones.

CREATE INDEX IF NOT EXISTS pedidos_negocio_tipo_status_idx
  ON public.pedidos (negocio_id, tipo, status)
  WHERE deleted_at IS NULL;
