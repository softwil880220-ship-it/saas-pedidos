-- Permitir eliminar retiros del tenant activo

DROP POLICY IF EXISTS "tenant_delete_retiros" ON public.retiros;
CREATE POLICY "tenant_delete_retiros"
ON public.retiros
FOR DELETE
TO authenticated
USING (negocio_id = public.usuario_negocio_id());
