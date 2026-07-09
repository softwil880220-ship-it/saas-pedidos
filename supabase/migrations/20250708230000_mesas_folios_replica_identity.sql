-- Realtime: DELETE con filtro negocio_id requiere old record completo
ALTER TABLE public.mesas_folios REPLICA IDENTITY FULL;
