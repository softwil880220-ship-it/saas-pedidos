-- DELETE en folios de mesa sin rondas enviadas (creador o admin/dueño del negocio)

DROP POLICY IF EXISTS mesas_folios_delete_creador_o_admin ON public.mesas_folios;
CREATE POLICY mesas_folios_delete_creador_o_admin
ON public.mesas_folios
FOR DELETE TO authenticated
USING (
  negocio_id = public.usuario_negocio_id()
  AND (
    creado_por = public.usuario_negocio_perfil_id()
    OR public.usuario_actual_es_admin_o_dueno()
  )
);
