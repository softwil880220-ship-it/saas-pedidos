-- Sistema de roles: tabla usuarios_negocio

CREATE TABLE IF NOT EXISTS public.usuarios_negocio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid NOT NULL REFERENCES public.negocios (id) ON DELETE CASCADE,
  rol text NOT NULL CHECK (
    rol IN (
      'dueno',
      'administrador',
      'cajero',
      'cocina',
      'cocina2',
      'repartidor',
      'mesero'
    )
  ),
  nombre text NOT NULL,
  email text,
  supabase_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  username text,
  pin_hash text,
  pin_autorizacion_hash text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS usuarios_negocio_negocio_id_idx
  ON public.usuarios_negocio (negocio_id);

CREATE INDEX IF NOT EXISTS usuarios_negocio_supabase_user_id_idx
  ON public.usuarios_negocio (supabase_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS usuarios_negocio_username_negocio_id_unique_idx
  ON public.usuarios_negocio (negocio_id, username)
  WHERE username IS NOT NULL;

ALTER TABLE public.usuarios_negocio ENABLE ROW LEVEL SECURITY;

-- Dueño inicial por negocio existente (primer usuario de auth asociado en public.usuarios)
INSERT INTO public.usuarios_negocio (
  negocio_id,
  rol,
  nombre,
  email,
  supabase_user_id,
  activo
)
SELECT DISTINCT ON (n.id)
  n.id,
  'dueno',
  COALESCE(
    NULLIF(trim(au.raw_user_meta_data->>'full_name'), ''),
    NULLIF(trim(au.raw_user_meta_data->>'name'), ''),
    NULLIF(trim(split_part(au.email, '@', 1)), ''),
    'Dueño'
  ),
  au.email,
  u.id,
  true
FROM public.negocios n
JOIN public.usuarios u
  ON u.negocio_id = n.id
JOIN auth.users au
  ON au.id = u.id
WHERE NOT EXISTS (
  SELECT 1
  FROM public.usuarios_negocio un
  WHERE un.negocio_id = n.id
    AND un.rol = 'dueno'
)
ORDER BY n.id, u.id ASC;
