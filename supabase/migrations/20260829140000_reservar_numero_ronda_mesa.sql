-- NO EJECUTAR, ya aplicado manualmente
-- Reserva atómica del número de ronda en mesas_folios antes de insertar el pedido.
-- Evita rondas duplicadas cuando Realtime va retrasado o el cliente reintenta tras timeout.

BEGIN;

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
  'Incrementa numero_ronda_siguiente del folio abierto y devuelve el número de ronda reservado.';

GRANT EXECUTE ON FUNCTION public.reservar_numero_ronda_mesa(uuid) TO authenticated;

COMMIT;
