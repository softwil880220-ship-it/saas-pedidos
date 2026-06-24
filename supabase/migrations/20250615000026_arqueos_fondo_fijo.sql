-- Guardar fondo fijo del día en cada arqueo

ALTER TABLE public.arqueos
ADD COLUMN IF NOT EXISTS fondo_fijo_del_dia numeric NOT NULL DEFAULT 0;
