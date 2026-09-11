-- RLS por canal de venta: caja, mostrador, recoger_domicilio, mesas.
-- Requiere negocio_modulo_habilitado() y columnas habilitar_* (20260910120000).
-- Aplicar manualmente en DEV/PROD vía SQL Editor.

BEGIN;

CREATE OR REPLACE FUNCTION public.pedido_tipo_canal_habilitado(p_tipo text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE coalesce(nullif(btrim(p_tipo), ''), 'whatsapp')
    WHEN 'presencial' THEN COALESCE(public.negocio_modulo_habilitado('caja'), false)
    WHEN 'mostrador' THEN COALESCE(public.negocio_modulo_habilitado('mostrador'), false)
    WHEN 'whatsapp' THEN COALESCE(public.negocio_modulo_habilitado('recoger_domicilio'), false)
    WHEN 'mesa' THEN COALESCE(public.negocio_modulo_habilitado('mesas'), false)
    ELSE false
  END;
$$;

COMMENT ON FUNCTION public.pedido_tipo_canal_habilitado(text) IS
  'Canal de venta habilitado según pedidos.tipo: presencial→caja, mostrador→mostrador, '
  'whatsapp→recoger_domicilio, mesa→mesas. Tipo vacío se trata como whatsapp.';

-- pedidos
DROP POLICY IF EXISTS "tenant_select_pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "tenant_insert_pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "tenant_update_pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "tenant_soft_delete_pedidos" ON public.pedidos;

CREATE POLICY "tenant_select_pedidos" ON public.pedidos
FOR SELECT TO authenticated
USING (
  negocio_id IS NOT NULL
  AND negocio_id = public.usuario_negocio_id()
  AND public.pedido_tipo_canal_habilitado(tipo)
);

CREATE POLICY "tenant_insert_pedidos" ON public.pedidos
FOR INSERT TO authenticated
WITH CHECK (
  negocio_id = public.usuario_negocio_id()
  AND public.pedido_tipo_canal_habilitado(tipo)
);

CREATE POLICY "tenant_update_pedidos" ON public.pedidos
FOR UPDATE TO authenticated
USING (
  negocio_id = public.usuario_negocio_id()
  AND public.pedido_tipo_canal_habilitado(tipo)
)
WITH CHECK (
  negocio_id = public.usuario_negocio_id()
  AND public.pedido_tipo_canal_habilitado(tipo)
);

CREATE POLICY "tenant_soft_delete_pedidos" ON public.pedidos
FOR UPDATE TO authenticated
USING (
  negocio_id = public.usuario_negocio_id()
  AND public.pedido_tipo_canal_habilitado(tipo)
)
WITH CHECK (
  negocio_id = public.usuario_negocio_id()
  AND public.pedido_tipo_canal_habilitado(tipo)
);

-- pedidos_ediciones
DROP POLICY IF EXISTS "tenant_select_pedidos_ediciones" ON public.pedidos_ediciones;
DROP POLICY IF EXISTS "tenant_insert_pedidos_ediciones" ON public.pedidos_ediciones;

CREATE POLICY "tenant_select_pedidos_ediciones" ON public.pedidos_ediciones
FOR SELECT TO authenticated
USING (
  negocio_id = public.usuario_negocio_id()
  AND EXISTS (
    SELECT 1
    FROM public.pedidos p
    WHERE p.id = pedidos_ediciones.pedido_id
      AND public.pedido_tipo_canal_habilitado(p.tipo)
  )
);

CREATE POLICY "tenant_insert_pedidos_ediciones" ON public.pedidos_ediciones
FOR INSERT TO authenticated
WITH CHECK (
  negocio_id = public.usuario_negocio_id()
  AND EXISTS (
    SELECT 1
    FROM public.pedidos p
    WHERE p.id = pedidos_ediciones.pedido_id
      AND public.pedido_tipo_canal_habilitado(p.tipo)
  )
);

-- jornadas (Caja)
DROP POLICY IF EXISTS jornadas_select_mismo_negocio ON public.jornadas;
DROP POLICY IF EXISTS jornadas_insert_admin_o_dueno ON public.jornadas;
DROP POLICY IF EXISTS jornadas_update_admin_o_dueno ON public.jornadas;

CREATE POLICY jornadas_select_mismo_negocio
ON public.jornadas
FOR SELECT TO authenticated
USING (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('caja'), false)
);

CREATE POLICY jornadas_insert_admin_o_dueno
ON public.jornadas
FOR INSERT TO authenticated
WITH CHECK (
  negocio_id = public.usuario_negocio_id()
  AND abierta_por = public.usuario_negocio_perfil_id()
  AND public.usuario_actual_es_admin_o_dueno()
  AND COALESCE(public.negocio_modulo_habilitado('caja'), false)
);

CREATE POLICY jornadas_update_admin_o_dueno
ON public.jornadas
FOR UPDATE TO authenticated
USING (
  negocio_id = public.usuario_negocio_id()
  AND public.usuario_actual_es_admin_o_dueno()
  AND COALESCE(public.negocio_modulo_habilitado('caja'), false)
)
WITH CHECK (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('caja'), false)
);

-- arqueos (Caja)
DROP POLICY IF EXISTS "tenant_select_arqueos" ON public.arqueos;
DROP POLICY IF EXISTS "tenant_insert_arqueos" ON public.arqueos;
DROP POLICY IF EXISTS "tenant_delete_arqueos" ON public.arqueos;

CREATE POLICY "tenant_select_arqueos"
ON public.arqueos
FOR SELECT TO authenticated
USING (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('caja'), false)
);

CREATE POLICY "tenant_insert_arqueos"
ON public.arqueos
FOR INSERT TO authenticated
WITH CHECK (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('caja'), false)
);

CREATE POLICY "tenant_delete_arqueos"
ON public.arqueos
FOR DELETE TO authenticated
USING (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('caja'), false)
);

-- retiros (Caja)
DROP POLICY IF EXISTS "tenant_select_retiros" ON public.retiros;
DROP POLICY IF EXISTS "tenant_insert_retiros" ON public.retiros;
DROP POLICY IF EXISTS "tenant_delete_retiros" ON public.retiros;

CREATE POLICY "tenant_select_retiros"
ON public.retiros
FOR SELECT TO authenticated
USING (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('caja'), false)
);

CREATE POLICY "tenant_insert_retiros"
ON public.retiros
FOR INSERT TO authenticated
WITH CHECK (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('caja'), false)
);

CREATE POLICY "tenant_delete_retiros"
ON public.retiros
FOR DELETE TO authenticated
USING (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('caja'), false)
);

-- fondos_fijos (Caja)
DROP POLICY IF EXISTS "tenant_select_fondos_fijos" ON public.fondos_fijos;
DROP POLICY IF EXISTS "tenant_insert_fondos_fijos" ON public.fondos_fijos;
DROP POLICY IF EXISTS "tenant_delete_fondos_fijos" ON public.fondos_fijos;

CREATE POLICY "tenant_select_fondos_fijos"
ON public.fondos_fijos
FOR SELECT TO authenticated
USING (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('caja'), false)
);

CREATE POLICY "tenant_insert_fondos_fijos"
ON public.fondos_fijos
FOR INSERT TO authenticated
WITH CHECK (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('caja'), false)
);

CREATE POLICY "tenant_delete_fondos_fijos"
ON public.fondos_fijos
FOR DELETE TO authenticated
USING (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('caja'), false)
);

-- mesas_folios (Mesas)
DROP POLICY IF EXISTS mesas_folios_select_mismo_negocio ON public.mesas_folios;
DROP POLICY IF EXISTS mesas_folios_insert_mesa_disponible ON public.mesas_folios;
DROP POLICY IF EXISTS mesas_folios_update_creador_o_admin ON public.mesas_folios;
DROP POLICY IF EXISTS mesas_folios_delete_creador_o_admin ON public.mesas_folios;

CREATE POLICY mesas_folios_select_mismo_negocio
ON public.mesas_folios
FOR SELECT TO authenticated
USING (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('mesas'), false)
);

CREATE POLICY mesas_folios_insert_mesa_disponible
ON public.mesas_folios
FOR INSERT TO authenticated
WITH CHECK (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('mesas'), false)
  AND creado_por = public.usuario_negocio_perfil_id()
  AND estado = 'abierta'
  AND NOT EXISTS (
    SELECT 1
    FROM public.mesas_folios mf
    WHERE mf.negocio_id = mesas_folios.negocio_id
      AND mf.numero_mesa = mesas_folios.numero_mesa
      AND mf.estado = 'abierta'
  )
);

CREATE POLICY mesas_folios_update_creador_o_admin
ON public.mesas_folios
FOR UPDATE TO authenticated
USING (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('mesas'), false)
  AND (
    creado_por = public.usuario_negocio_perfil_id()
    OR public.usuario_actual_es_admin_o_dueno()
  )
)
WITH CHECK (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('mesas'), false)
  AND (
    creado_por = public.usuario_negocio_perfil_id()
    OR public.usuario_actual_es_admin_o_dueno()
  )
  AND NOT (
    public.usuario_actual_es_mesero()
    AND estado = 'cerrada'
  )
);

CREATE POLICY mesas_folios_delete_creador_o_admin
ON public.mesas_folios
FOR DELETE TO authenticated
USING (
  negocio_id = public.usuario_negocio_id()
  AND COALESCE(public.negocio_modulo_habilitado('mesas'), false)
  AND (
    creado_por = public.usuario_negocio_perfil_id()
    OR public.usuario_actual_es_admin_o_dueno()
  )
);

-- RPC reservar_numero_ronda_mesa (Mesas)
CREATE OR REPLACE FUNCTION public.reservar_numero_ronda_mesa(p_folio_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_numero integer;
  v_negocio_id uuid;
BEGIN
  v_negocio_id := public.usuario_negocio_id();

  IF v_negocio_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sin negocio activo';
  END IF;

  IF NOT COALESCE(public.negocio_modulo_habilitado('mesas'), false) THEN
    RAISE EXCEPTION 'Módulo mesas no habilitado';
  END IF;

  UPDATE public.mesas_folios
  SET numero_ronda_siguiente = numero_ronda_siguiente + 1
  WHERE id = p_folio_id
    AND negocio_id = v_negocio_id
    AND estado = 'abierta'
  RETURNING (numero_ronda_siguiente - 1) INTO v_numero;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Folio no encontrado o no está abierto';
  END IF;

  RETURN v_numero;
END;
$function$;

COMMENT ON FUNCTION public.reservar_numero_ronda_mesa(uuid) IS
  'Incrementa numero_ronda_siguiente del folio abierto y devuelve el número de ronda reservado. '
  'Requiere módulo mesas habilitado.';

GRANT EXECUTE ON FUNCTION public.reservar_numero_ronda_mesa(uuid) TO authenticated;

COMMIT;
