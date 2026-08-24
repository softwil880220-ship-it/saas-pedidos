-- Asignación de repartidor en pedidos a domicilio (Para recoger/domicilio).
-- El estado operativo pendiente-repartidor se maneja en la aplicación.

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS repartidor_usuario_id uuid
    REFERENCES public.usuarios_negocio(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.pedidos.repartidor_usuario_id IS
  'Usuario del negocio (rol repartidor) asignado al pedido a domicilio al marcarlo como enviado. NULL si repartidor_externo es true o aún no se asignó.';

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS repartidor_externo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.pedidos.repartidor_externo IS
  'true cuando la entrega la realiza un repartidor externo (no registrado en usuarios_negocio). En ese caso repartidor_usuario_id debe quedar NULL.';
