import { supabase } from './supabase';
import { CLIENTE_MOSTRADOR } from './pedidoCarritoStorage';
import { payloadConNegocio } from './tenantHelpers';
import {
  TIPOS_ENTREGA,
  determinarStatusInicialMostrador,
  enriquecerLineasDetalleCocina,
} from './pedidosShared';

function formatearClienteMostrador(referencia) {
  const nombre = referencia?.trim();
  return nombre || CLIENTE_MOSTRADOR;
}

export function construirPayloadPedidoMostrador({
  detallePedido,
  resumen,
  form,
  productos,
  mostradorFlujoCocina,
  usuarioId,
}) {
  const pedidoConDetalle = {
    producto: resumen,
    lineas_detalle: Array.isArray(detallePedido?.lineas) ? detallePedido.lineas : [],
    total: detallePedido?.total ?? 0,
  };

  const pedidoEnriquecido = enriquecerLineasDetalleCocina(pedidoConDetalle, productos);
  const statusInicial = determinarStatusInicialMostrador(mostradorFlujoCocina, pedidoEnriquecido);

  return {
    cliente: formatearClienteMostrador(form.referencia),
    telefono: null,
    producto: resumen,
    lineas_detalle: pedidoEnriquecido.lineas_detalle,
    total: detallePedido.total,
    status: statusInicial.status,
    tipo: 'mostrador',
    tipo_entrega: TIPOS_ENTREGA.SUCURSAL,
    direccion: null,
    forma_pago: form.formaPago || 'efectivo',
    referencia: form.referencia?.trim() || null,
    created_by: usuarioId ?? null,
    status_cocina1: statusInicial.status_cocina1,
    status_cocina2: statusInicial.status_cocina2,
    mostrador_en_preparacion_at: statusInicial.mostrador_en_preparacion_at,
    mostrador_listo_at: statusInicial.mostrador_listo_at,
    mostrador_entregado_at: statusInicial.mostrador_entregado_at,
  };
}

export async function registrarPedidoMostrador({
  negocioId,
  detallePedido,
  resumen,
  form,
  productos,
  mostradorFlujoCocina,
  usuarioId,
}) {
  const payload = construirPayloadPedidoMostrador({
    detallePedido,
    resumen,
    form,
    productos,
    mostradorFlujoCocina,
    usuarioId,
  });

  const { data, error } = await supabase
    .from('pedidos')
    .insert(payloadConNegocio(payload, negocioId))
    .select()
    .single();

  return { data, error };
}
