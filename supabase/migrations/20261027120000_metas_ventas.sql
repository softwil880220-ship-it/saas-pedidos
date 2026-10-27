-- Metas de venta mensuales por negocio.
-- Aplicar a mano en Supabase. No modifica tablas, funciones ni policies existentes.
--
-- public.set_updated_at() no está versionada en este repositorio.
-- El trigger se crea solo si esa función ya existe en la base (sin argumentos).
-- Esta migración no crea una función de updated_at.

BEGIN;

CREATE TABLE IF NOT EXISTS public.metas_ventas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid NOT NULL REFERENCES public.negocios (id) ON DELETE CASCADE,
  mes date NOT NULL,
  monto numeric(12, 2) NOT NULL,
  actualizado_por uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT metas_ventas_mes_primer_dia CHECK (
    mes = date_trunc('month', mes::timestamp)::date
  ),
  CONSTRAINT metas_ventas_monto_positivo CHECK (monto > 0),
  CONSTRAINT metas_ventas_negocio_mes_unica UNIQUE (negocio_id, mes)
);

COMMENT ON TABLE public.metas_ventas IS
  'Meta de venta de un mes civil por negocio. mes es el primer día de ese mes.';

COMMENT ON COLUMN public.metas_ventas.mes IS
  'Primer día del mes de la meta.';

COMMENT ON COLUMN public.metas_ventas.monto IS
  'Monto de la meta. Debe ser mayor que cero.';

COMMENT ON COLUMN public.metas_ventas.actualizado_por IS
  'auth.uid() de quien escribió la fila. Es el id de auth.users, no el id de usuarios_negocio. Sin FK.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'metas_ventas_mes_primer_dia'
      AND conrelid = 'public.metas_ventas'::regclass
  ) THEN
    ALTER TABLE public.metas_ventas
      ADD CONSTRAINT metas_ventas_mes_primer_dia
      CHECK (mes = date_trunc('month', mes::timestamp)::date);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'metas_ventas_monto_positivo'
      AND conrelid = 'public.metas_ventas'::regclass
  ) THEN
    ALTER TABLE public.metas_ventas
      ADD CONSTRAINT metas_ventas_monto_positivo
      CHECK (monto > 0);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'metas_ventas_negocio_mes_unica'
      AND conrelid = 'public.metas_ventas'::regclass
  ) THEN
    ALTER TABLE public.metas_ventas
      ADD CONSTRAINT metas_ventas_negocio_mes_unica
      UNIQUE (negocio_id, mes);
  END IF;
END;
$$;

DO $$
DECLARE
  v_existe boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'set_updated_at'
      AND pg_get_function_identity_arguments(p.oid) = ''
  )
  INTO v_existe;

  IF NOT v_existe THEN
    RAISE NOTICE
      'public.set_updated_at() no existe en esta base. No se crea trigger ni una función nueva. updated_at solo toma now() al insertar.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    WHERE t.tgname = 'metas_ventas_set_updated_at'
      AND t.tgrelid = 'public.metas_ventas'::regclass
      AND NOT t.tgisinternal
  ) THEN
    CREATE TRIGGER metas_ventas_set_updated_at
      BEFORE UPDATE ON public.metas_ventas
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

ALTER TABLE public.metas_ventas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS metas_ventas_select ON public.metas_ventas;
  CREATE POLICY metas_ventas_select
    ON public.metas_ventas
    FOR SELECT
    TO authenticated
    USING (
      negocio_id = public.usuario_negocio_id()
      AND public.usuario_actual_es_admin_o_dueno()
    );
END;
$$;

DO $$
BEGIN
  DROP POLICY IF EXISTS metas_ventas_insert ON public.metas_ventas;
  CREATE POLICY metas_ventas_insert
    ON public.metas_ventas
    FOR INSERT
    TO authenticated
    WITH CHECK (
      negocio_id = public.usuario_negocio_id()
      AND public.usuario_actual_es_admin_o_dueno()
    );
END;
$$;

DO $$
BEGIN
  DROP POLICY IF EXISTS metas_ventas_update ON public.metas_ventas;
  CREATE POLICY metas_ventas_update
    ON public.metas_ventas
    FOR UPDATE
    TO authenticated
    USING (
      negocio_id = public.usuario_negocio_id()
      AND public.usuario_actual_es_admin_o_dueno()
    )
    WITH CHECK (
      negocio_id = public.usuario_negocio_id()
      AND public.usuario_actual_es_admin_o_dueno()
    );
END;
$$;

DO $$
BEGIN
  DROP POLICY IF EXISTS metas_ventas_delete ON public.metas_ventas;
  CREATE POLICY metas_ventas_delete
    ON public.metas_ventas
    FOR DELETE
    TO authenticated
    USING (
      negocio_id = public.usuario_negocio_id()
      AND public.usuario_actual_es_admin_o_dueno()
    );
END;
$$;

REVOKE ALL ON TABLE public.metas_ventas FROM PUBLIC;
REVOKE ALL ON TABLE public.metas_ventas FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.metas_ventas TO authenticated;
-- Supabase concede por defecto todos los privilegios a authenticated en tablas nuevas de public, y TRUNCATE no respeta RLS.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE public.metas_ventas FROM authenticated;

COMMIT;

-- Reversa (aplicar a mano, en este orden):
-- DROP TRIGGER IF EXISTS metas_ventas_set_updated_at ON public.metas_ventas;
-- DROP POLICY IF EXISTS metas_ventas_select ON public.metas_ventas;
-- DROP POLICY IF EXISTS metas_ventas_insert ON public.metas_ventas;
-- DROP POLICY IF EXISTS metas_ventas_update ON public.metas_ventas;
-- DROP POLICY IF EXISTS metas_ventas_delete ON public.metas_ventas;
-- DROP TABLE IF EXISTS public.metas_ventas;
