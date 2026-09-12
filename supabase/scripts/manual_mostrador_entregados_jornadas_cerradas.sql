-- Limpieza histórica (una sola ejecución manual)
-- Marca como entregados los pedidos de mostrador pendientes en jornadas ya cerradas.
-- Ejecutar en Supabase SQL Editor: primero la verificación, revisar resultados, luego el UPDATE.

-- =============================================================================
-- PASO 1 — Verificación (solo lectura)
-- =============================================================================

SELECT
  COUNT(*) AS total_a_actualizar
FROM public.pedidos p
JOIN public.jornadas j ON j.id = p.jornada_id
WHERE p.tipo = 'mostrador'
  AND p.status != 'entregado'
  AND p.deleted_at IS NULL
  AND j.estado = 'cerrada';

SELECT
  p.id,
  p.folio,
  p.negocio_id,
  p.jornada_id,
  p.status AS status_actual,
  p.created_at,
  j.abierta_en,
  j.cerrada_en AS mostrador_entregado_at_a_aplicar
FROM public.pedidos p
JOIN public.jornadas j ON j.id = p.jornada_id
WHERE p.tipo = 'mostrador'
  AND p.status != 'entregado'
  AND p.deleted_at IS NULL
  AND j.estado = 'cerrada'
ORDER BY j.cerrada_en DESC NULLS LAST, p.created_at DESC
LIMIT 10;

-- =============================================================================
-- PASO 2 — UPDATE (ejecutar solo tras revisar el PASO 1)
-- =============================================================================

UPDATE public.pedidos p
SET
  status = 'entregado',
  mostrador_entregado_at = j.cerrada_en
FROM public.jornadas j
WHERE p.jornada_id = j.id
  AND p.tipo = 'mostrador'
  AND p.status != 'entregado'
  AND p.deleted_at IS NULL
  AND j.estado = 'cerrada';
