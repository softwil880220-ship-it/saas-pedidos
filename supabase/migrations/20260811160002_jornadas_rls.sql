ALTER TABLE public.jornadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY jornadas_select_mismo_negocio
  ON public.jornadas
  FOR SELECT TO authenticated
  USING (negocio_id = public.usuario_negocio_id());

CREATE POLICY jornadas_insert_admin_o_dueno
  ON public.jornadas
  FOR INSERT TO authenticated
  WITH CHECK (
    negocio_id = public.usuario_negocio_id()
    AND abierta_por = public.usuario_negocio_perfil_id()
    AND public.usuario_actual_es_admin_o_dueno()
  );

CREATE POLICY jornadas_update_admin_o_dueno
  ON public.jornadas
  FOR UPDATE TO authenticated
  USING (
    negocio_id = public.usuario_negocio_id()
    AND public.usuario_actual_es_admin_o_dueno()
  )
  WITH CHECK (
    negocio_id = public.usuario_negocio_id()
  );
