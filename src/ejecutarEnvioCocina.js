import { supabase } from './supabase';
import { reservarNumeroRondaMesa } from './mesasFoliosStorage';
import { payloadConNegocio } from './tenantHelpers';
import {
  TIPOS_ENTREGA,
  enriquecerLineasDetalleCocina,
  prepararStatusCocinasAlEntrar,
} from './pedidosShared';

export async function ejecutarEnvioCocina({
  negocioId,
  usuarioId,
  folioId,
  detallePedido,
  resumen,
  numeroMesa,
  productos,
  jornadaId = null,
}) {
  const {
    numeroRonda,
    numeroRondaSiguiente,
    error: errorReserva,
  } = await reservarNumeroRondaMesa(folioId);

  if (errorReserva || numeroRonda == null) {
    return {
      data: null,
      error: errorReserva ?? new Error('No se pudo reservar el número de ronda'),
      numeroRonda: null,
      numeroRondaSiguiente: null,
    };
  }

  const pedidoConDetalle = {
    producto: resumen,
    lineas_detalle: Array.isArray(detallePedido?.lineas) ? detallePedido.lineas : [],
    total: detallePedido?.total ?? 0,
  };

  const pedidoEnriquecido = enriquecerLineasDetalleCocina(pedidoConDetalle, productos);
  const cocinas = prepararStatusCocinasAlEntrar(pedidoEnriquecido);

  const payload = {
    cliente: `Mesa ${numeroMesa}`,
    telefono: null,
    producto: resumen,
    lineas_detalle: pedidoEnriquecido.lineas_detalle,
    total: detallePedido.total,
    status: 'en-cocina',
    tipo: 'mesa',
    tipo_entrega: TIPOS_ENTREGA.DOMICILIO,
    direccion: null,
    forma_pago: null,
    referencia: `Ronda ${numeroRonda}`,
    created_by: usuarioId ?? null,
    jornada_id: jornadaId ?? null,
    status_cocina1: cocinas.status_cocina1,
    status_cocina2: cocinas.status_cocina2,
  };

  const { data, error } = await supabase
    .from('pedidos')
    .insert(payloadConNegocio(payload, negocioId))
    .select()
    .single();

  return {
    data,
    error,
    numeroRonda,
    numeroRondaSiguiente,
  };
}
