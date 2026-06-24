-- Permitir eliminar arqueos del tenant activo

DROP POLICY IF EXISTS "tenant_delete_arqueos" ON public.arqueos;
CREATE POLICY "tenant_delete_arqueos"
ON public.arqueos
FOR DELETE
TO authenticated
USING (negocio_id = public.usuario_negocio_id());
