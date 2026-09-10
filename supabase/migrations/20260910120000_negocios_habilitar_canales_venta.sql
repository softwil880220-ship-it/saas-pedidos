-- Formaliza en el repo las columnas de canales de venta en negocios.
-- Ya existen en DEV y PROD (creadas manualmente); ADD COLUMN IF NOT EXISTS es idempotente.
-- negocio_modulo_habilitado() las referencia desde 20260821120000_clientes_fase1_base.sql.

BEGIN;

ALTER TABLE public.negocios
  ADD COLUMN IF NOT EXISTS habilitar_caja boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS habilitar_mostrador boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS habilitar_recoger_domicilio boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS habilitar_mesas boolean NOT NULL DEFAULT false;

-- IF NOT EXISTS omite el ADD cuando la columna ya existe (p. ej. DEFAULT true manual).
-- SET DEFAULT corrige el default para futuros INSERTs sin alterar filas existentes.
ALTER TABLE public.negocios
  ALTER COLUMN habilitar_caja SET DEFAULT false,
  ALTER COLUMN habilitar_mostrador SET DEFAULT false,
  ALTER COLUMN habilitar_recoger_domicilio SET DEFAULT false,
  ALTER COLUMN habilitar_mesas SET DEFAULT false;

COMMENT ON COLUMN public.negocios.habilitar_caja IS
  'Canal Caja (ventas presenciales). false = deshabilitado por plan.';

COMMENT ON COLUMN public.negocios.habilitar_mostrador IS
  'Canal Mostrador. false = deshabilitado por plan.';

COMMENT ON COLUMN public.negocios.habilitar_recoger_domicilio IS
  'Canal Para recoger/domicilio. false = deshabilitado por plan.';

COMMENT ON COLUMN public.negocios.habilitar_mesas IS
  'Canal Mesas. false = deshabilitado por plan.';

COMMIT;
