-- Corrige FK de pedidos.deleted_by: debe apuntar a usuarios_negocio(id), no auth.users(id).
-- Alineado con created_by y el resto del sistema multitenant.

ALTER TABLE public.pedidos
  DROP CONSTRAINT IF EXISTS pedidos_deleted_by_fkey;

-- Valores históricos guardados como auth.users.id -> usuarios_negocio.id del mismo negocio
UPDATE public.pedidos p
SET deleted_by = un.id
FROM public.usuarios_negocio un
WHERE p.deleted_by IS NOT NULL
  AND un.supabase_user_id = p.deleted_by
  AND un.negocio_id = p.negocio_id;

-- Cualquier valor que no resuelva a usuarios_negocio se anula para poder crear la FK
UPDATE public.pedidos
SET deleted_by = NULL
WHERE deleted_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.usuarios_negocio un
    WHERE un.id = pedidos.deleted_by
  );

ALTER TABLE public.pedidos
  ADD CONSTRAINT pedidos_deleted_by_fkey
  FOREIGN KEY (deleted_by)
  REFERENCES public.usuarios_negocio (id)
  ON DELETE SET NULL;

COMMENT ON COLUMN public.pedidos.deleted_by IS
  'Usuario de negocio (usuarios_negocio.id) que realizó el soft delete del pedido.';
