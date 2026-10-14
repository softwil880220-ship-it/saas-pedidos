-- mesas_folios: columnas de cobro, folio, constraints, índice y triggers.
-- Ya aplicado manualmente en DEV y PROD; existe solo para versionar y reconstruir entornos nuevos.
-- Idempotente (no-op cuando el esquema ya coincide con DEV/PROD).

-- 1) Columnas
ALTER TABLE public.mesas_folios
  ADD COLUMN IF NOT EXISTS subtotal numeric,
  ADD COLUMN IF NOT EXISTS descuento_tipo text,
  ADD COLUMN IF NOT EXISTS descuento_valor numeric,
  ADD COLUMN IF NOT EXISTS descuento_monto_aplicado numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS descuento_razon text,
  ADD COLUMN IF NOT EXISTS descuento_autorizado_por uuid,
  ADD COLUMN IF NOT EXISTS propina_tipo text,
  ADD COLUMN IF NOT EXISTS propina_valor numeric,
  ADD COLUMN IF NOT EXISTS propina_monto_aplicado numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_cobrado numeric,
  ADD COLUMN IF NOT EXISTS forma_pago text,
  ADD COLUMN IF NOT EXISTS folio text;

-- 2) Constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'mesas_folios_descuento_tipo_check'
      AND conrelid = 'public.mesas_folios'::regclass
  ) THEN
    ALTER TABLE public.mesas_folios
      ADD CONSTRAINT mesas_folios_descuento_tipo_check
      CHECK (descuento_tipo IN ('porcentaje', 'monto'));
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'mesas_folios_propina_tipo_check'
      AND conrelid = 'public.mesas_folios'::regclass
  ) THEN
    ALTER TABLE public.mesas_folios
      ADD CONSTRAINT mesas_folios_propina_tipo_check
      CHECK (propina_tipo IN ('porcentaje', 'monto'));
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'mesas_folios_forma_pago_check'
      AND conrelid = 'public.mesas_folios'::regclass
  ) THEN
    ALTER TABLE public.mesas_folios
      ADD CONSTRAINT mesas_folios_forma_pago_check
      CHECK (forma_pago IN ('efectivo', 'tarjeta', 'transferencia'));
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'mesas_folios_descuento_autorizado_por_fkey'
      AND conrelid = 'public.mesas_folios'::regclass
  ) THEN
    ALTER TABLE public.mesas_folios
      ADD CONSTRAINT mesas_folios_descuento_autorizado_por_fkey
      FOREIGN KEY (descuento_autorizado_por) REFERENCES public.usuarios_negocio (id);
  END IF;
END;
$$;

-- 3) Índice
CREATE UNIQUE INDEX IF NOT EXISTS mesas_folios_negocio_folio_uidx
  ON public.mesas_folios (negocio_id, folio)
  WHERE folio IS NOT NULL;

-- 4) Funciones
CREATE OR REPLACE FUNCTION public.mesas_folios_asignar_folio()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.estado = 'cerrada'
     AND OLD.estado IS DISTINCT FROM 'cerrada'
     AND NEW.folio IS NULL
     AND NEW.negocio_id IS NOT NULL
  THEN
    NEW.folio := public.generar_folio(NEW.negocio_id);
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.restringir_descuento_a_admin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF NOT public.usuario_actual_es_admin_o_dueno() THEN
    IF NEW.descuento_valor IS DISTINCT FROM OLD.descuento_valor
       OR NEW.descuento_tipo IS DISTINCT FROM OLD.descuento_tipo
       OR NEW.descuento_monto_aplicado IS DISTINCT FROM OLD.descuento_monto_aplicado
       OR NEW.descuento_razon IS DISTINCT FROM OLD.descuento_razon THEN
      RAISE EXCEPTION 'Solo el dueño o administrador puede aplicar descuentos.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 5) Triggers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    WHERE t.tgname = 'mesas_folios_asignar_folio'
      AND t.tgrelid = 'public.mesas_folios'::regclass
      AND NOT t.tgisinternal
  ) THEN
    CREATE TRIGGER mesas_folios_asignar_folio
      BEFORE UPDATE ON public.mesas_folios
      FOR EACH ROW
      EXECUTE FUNCTION public.mesas_folios_asignar_folio();
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    WHERE t.tgname = 'trg_restringir_descuento_a_admin'
      AND t.tgrelid = 'public.mesas_folios'::regclass
      AND NOT t.tgisinternal
  ) THEN
    CREATE TRIGGER trg_restringir_descuento_a_admin
      BEFORE UPDATE ON public.mesas_folios
      FOR EACH ROW
      EXECUTE FUNCTION public.restringir_descuento_a_admin();
  END IF;
END;
$$;
