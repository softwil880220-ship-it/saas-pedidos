-- DOCUMENTACIÓN RETROACTIVA — NO EJECUTAR EN DEV NI PROD
-- Este SQL ya fue aplicado en producción el 18 de agosto de 2026 (confirmado vía pg_policy).
-- El archivo existe solo para versionar la eliminación en el repo.
--
-- La política "Enable read access for all users" otorgaba SELECT sin restricción de rol
-- (polroles vacío = PUBLIC) y sin condición (USING true) sobre public.pedidos, exponiendo
-- pedidos de todos los negocios sin autenticación. No estaba versionada en ningún archivo
-- de supabase/migrations/ ni referenciada en el historial de chats de Cursor — se creó
-- manualmente fuera del flujo de migraciones, probablemente en una etapa muy temprana del
-- proyecto antes de multi-tenancy.

DROP POLICY IF EXISTS "Enable read access for all users" ON public.pedidos;
