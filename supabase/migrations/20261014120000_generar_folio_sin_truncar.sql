-- LPAD(..., 4, '0') trunca cuando v_numero tiene más de 4 dígitos (p. ej. 10000 → '1000').
-- Usar ancho mínimo 4 pero crecer con LENGTH para evitar folios duplicados.

CREATE OR REPLACE FUNCTION public.generar_folio(p_negocio_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_prefix TEXT;
  v_numero INTEGER;
BEGIN
  SELECT COALESCE(folio_prefix, 'ORD'), folio_ultimo_numero + 1
  INTO v_prefix, v_numero
  FROM public.negocios
  WHERE id = p_negocio_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Negocio no encontrado: %', p_negocio_id;
  END IF;

  UPDATE public.negocios
  SET folio_ultimo_numero = v_numero
  WHERE id = p_negocio_id;

  RETURN v_prefix || '-' || LPAD(v_numero::TEXT, GREATEST(4, LENGTH(v_numero::TEXT)), '0');
END;
$function$;
