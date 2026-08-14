CREATE TABLE public.jornadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid NOT NULL REFERENCES public.negocios(id) ON DELETE RESTRICT,
  estado text NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta','cerrada')),
  abierta_en timestamptz NOT NULL DEFAULT now(),
  abierta_por uuid REFERENCES public.usuarios_negocio(id) ON DELETE SET NULL,
  cerrada_en timestamptz,
  cerrada_por uuid REFERENCES public.usuarios_negocio(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX jornadas_negocio_abierta_unique_idx
  ON public.jornadas (negocio_id) WHERE estado = 'abierta';

CREATE INDEX jornadas_negocio_id_idx ON public.jornadas (negocio_id);
