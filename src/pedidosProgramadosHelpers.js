import { esPedidoWhatsapp } from './pedidosShared';
import { normalizarMeridianoHoraEs } from './jornadaHelpers';

export const MINUTOS_ANTICIPACION_COCINA_DEFAULT = 30;
export const INTERVALO_REASIGNACION_JORNADA_MS = 45000;

export function normalizarMinutosAnticipacionCocina(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < 0) {
    return MINUTOS_ANTICIPACION_COCINA_DEFAULT;
  }
  return Math.round(numero);
}

export function esPedidoProgramado(pedido) {
  return pedido?.programado_para != null && String(pedido.programado_para).trim() !== '';
}

export function calcularUmbralTiempoReal(programadoPara, minutosAnticipacion) {
  const fechaProgramada = new Date(programadoPara);
  if (Number.isNaN(fechaProgramada.getTime())) return null;

  const minutos = normalizarMinutosAnticipacionCocina(minutosAnticipacion);
  return new Date(fechaProgramada.getTime() - minutos * 60 * 1000);
}

export function cruzoUmbralTiempoReal(pedido, minutosAnticipacion, ahora = new Date()) {
  if (!esPedidoProgramado(pedido)) return true;

  const umbral = calcularUmbralTiempoReal(pedido.programado_para, minutosAnticipacion);
  if (!umbral) return false;

  return ahora >= umbral;
}

export function pedidoProgramadoActivadoEnJornada(
  pedido,
  jornadaAbiertaId,
  minutosAnticipacion,
  ahora = new Date()
) {
  if (!esPedidoProgramado(pedido)) return true;
  if (!cruzoUmbralTiempoReal(pedido, minutosAnticipacion, ahora)) return false;
  if (!jornadaAbiertaId) return false;
  return pedido.jornada_id === jornadaAbiertaId;
}

export function pedidoWhatsappEnTabProgramadosCocina(
  pedido,
  jornadaAbiertaId,
  minutosAnticipacion,
  ahora = new Date()
) {
  if (!esPedidoWhatsapp(pedido) || !esPedidoProgramado(pedido)) return false;

  return !pedidoProgramadoActivadoEnJornada(
    pedido,
    jornadaAbiertaId,
    minutosAnticipacion,
    ahora
  );
}

export function pedidoWhatsappEnTabTiempoRealCocina(
  pedido,
  jornadaAbiertaId,
  minutosAnticipacion,
  ahora = new Date()
) {
  if (!esPedidoWhatsapp(pedido)) return false;
  if (!esPedidoProgramado(pedido)) return true;

  return pedidoProgramadoActivadoEnJornada(
    pedido,
    jornadaAbiertaId,
    minutosAnticipacion,
    ahora
  );
}

export function necesitaReasignacionJornadaProgramado(
  pedido,
  jornadaAbiertaId,
  minutosAnticipacion,
  ahora = new Date()
) {
  if (!esPedidoProgramado(pedido) || !jornadaAbiertaId) return false;
  if (!cruzoUmbralTiempoReal(pedido, minutosAnticipacion, ahora)) return false;
  return pedido.jornada_id !== jornadaAbiertaId;
}

export function pedidosProgramadosPendientesReasignacion(
  pedidos,
  jornadaAbiertaId,
  minutosAnticipacion,
  ahora = new Date()
) {
  return (pedidos || []).filter((pedido) =>
    necesitaReasignacionJornadaProgramado(
      pedido,
      jornadaAbiertaId,
      minutosAnticipacion,
      ahora
    )
  );
}

export function datetimeLocalDesdeIso(iso) {
  if (!iso) return '';

  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';

  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, '0');
  const day = String(fecha.getDate()).padStart(2, '0');
  const hours = String(fecha.getHours()).padStart(2, '0');
  const minutes = String(fecha.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function isoDesdeDatetimeLocal(valorLocal) {
  const texto = String(valorLocal ?? '').trim();
  if (!texto) return null;

  const fecha = new Date(texto);
  if (Number.isNaN(fecha.getTime())) return null;

  return fecha.toISOString();
}

export function programadoParaDesdeForm(programarPedido, programadoParaLocal) {
  if (!programarPedido) return null;
  return isoDesdeDatetimeLocal(programadoParaLocal);
}

export function validarProgramadoParaFuturo(programadoParaLocal, ahora = new Date()) {
  const iso = isoDesdeDatetimeLocal(programadoParaLocal);
  if (!iso) {
    return { valido: false, mensaje: 'Selecciona una fecha y hora válidas.' };
  }

  const fecha = new Date(iso);
  if (fecha <= ahora) {
    return {
      valido: false,
      mensaje: 'La fecha y hora programadas deben ser futuras.',
    };
  }

  return { valido: true, iso };
}

export function formatearHoraProgramada(iso) {
  if (!iso) return '';

  return normalizarMeridianoHoraEs(
    new Date(iso).toLocaleTimeString('es-MX', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  );
}

export function formatearProgramadoParaBadge(programadoPara) {
  const hora = formatearHoraProgramada(programadoPara);
  return hora ? `Programado para las ${hora}` : 'Programado';
}

export function formatearProgramadoParaRepartidor(programadoPara) {
  if (!programadoPara) return '';

  const fecha = new Date(programadoPara);
  if (Number.isNaN(fecha.getTime())) return '';

  const fechaTexto = fecha.toLocaleDateString('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const hora = formatearHoraProgramada(programadoPara);

  return hora ? `Entrega prometida: ${fechaTexto}, ${hora}` : '';
}
