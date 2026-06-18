import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { normalizarTipoEntrega, TIPOS_ENTREGA } from './pedidosShared';

export const PERIODOS_REPORTE = {
  SEMANA: 'semana',
  MES: 'mes',
};

export const FILTROS_VENTA_REPORTE = [
  { value: 'todos', label: 'Todos' },
  { value: 'caja', label: 'Solo Caja' },
  { value: 'whatsapp', label: 'Solo WhatsApp (todos)' },
  { value: 'whatsapp_domicilio', label: 'Solo WhatsApp / A domicilio' },
  { value: 'whatsapp_sucursal', label: 'Solo WhatsApp / A recoger en sucursal' },
];

const CLIENTE_PUBLICO = 'Público general';

function inicioDelDia(fecha) {
  const copia = new Date(fecha);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

function finDelDia(fecha) {
  const copia = new Date(fecha);
  copia.setHours(23, 59, 59, 999);
  return copia;
}

function parsearFechaLocal(valor) {
  if (!valor) return null;

  const [anio, mes, dia] = valor.split('-').map(Number);
  if (!anio || !mes || !dia) return null;

  return new Date(anio, mes - 1, dia);
}

function obtenerLunesSemanaActual(fecha = new Date()) {
  const copia = inicioDelDia(fecha);
  const diaSemana = copia.getDay();
  const diasDesdeLunes = (diaSemana + 6) % 7;
  copia.setDate(copia.getDate() - diasDesdeLunes);
  return copia;
}

export function rangoPersonalizadoActivo(fechaDesde, fechaHasta) {
  return Boolean(fechaDesde?.trim() && fechaHasta?.trim());
}

export function rangoFechasInvalido(fechaDesde, fechaHasta) {
  if (!rangoPersonalizadoActivo(fechaDesde, fechaHasta)) {
    return false;
  }

  const desde = parsearFechaLocal(fechaDesde);
  const hasta = parsearFechaLocal(fechaHasta);

  return Boolean(desde && hasta && desde > hasta);
}

export function obtenerRangoReporte({ periodo, fechaDesde = '', fechaHasta = '' }) {
  if (rangoPersonalizadoActivo(fechaDesde, fechaHasta)) {
    const desde = parsearFechaLocal(fechaDesde);
    const hasta = parsearFechaLocal(fechaHasta);

    if (desde && hasta) {
      if (desde > hasta) {
        return { inicio: null, fin: null, tipo: 'personalizado', invalido: true };
      }

      const inicio = inicioDelDia(desde);
      const fin = finDelDia(hasta);
      return { inicio, fin, tipo: 'personalizado' };
    }
  }

  const hoy = new Date();
  const fin = finDelDia(hoy);

  if (periodo === PERIODOS_REPORTE.MES) {
    const inicio = inicioDelDia(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
    return { inicio, fin, tipo: PERIODOS_REPORTE.MES };
  }

  const inicio = obtenerLunesSemanaActual(hoy);
  return { inicio, fin, tipo: PERIODOS_REPORTE.SEMANA };
}

export function obtenerRangoPeriodoReporte(periodo) {
  return obtenerRangoReporte({ periodo });
}

const MESES_CORTOS_ES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

export function formatoFechaTarjetaPeriodo(fecha) {
  const dia = String(fecha.getDate()).padStart(2, '0');
  const mes = MESES_CORTOS_ES[fecha.getMonth()];
  const anio = fecha.getFullYear();
  return `${dia} ${mes} ${anio}`;
}

function obtenerFechasRangoPeriodo({ periodo, fechaDesde = '', fechaHasta = '' }) {
  if (rangoFechasInvalido(fechaDesde, fechaHasta)) {
    const desde = parsearFechaLocal(fechaDesde);
    const hasta = parsearFechaLocal(fechaHasta);
    return { inicio: desde, fin: hasta };
  }

  const { inicio, fin } = obtenerRangoReporte({ periodo, fechaDesde, fechaHasta });
  return { inicio, fin };
}

export function descripcionPeriodoTarjeta({ periodo, fechaDesde = '', fechaHasta = '' }) {
  if (rangoPersonalizadoActivo(fechaDesde, fechaHasta)) {
    return 'Rango personalizado';
  }

  if (periodo === PERIODOS_REPORTE.MES) {
    const hoy = new Date();
    const inicio = inicioDelDia(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
    const mesNombre = inicio.toLocaleDateString('es-MX', { month: 'long' });
    return `Mes actual (${mesNombre} ${inicio.getFullYear()})`;
  }

  return 'Semana actual (lunes - hoy)';
}

export function fechasPeriodoTarjeta(configPeriodo) {
  const { inicio, fin } = obtenerFechasRangoPeriodo(configPeriodo);

  if (!inicio || !fin) {
    return '—';
  }

  if (inicio.toDateString() === fin.toDateString()) {
    return formatoFechaTarjetaPeriodo(inicio);
  }

  return `${formatoFechaTarjetaPeriodo(inicio)} - ${formatoFechaTarjetaPeriodo(fin)}`;
}

export function etiquetaPeriodoReporte(configPeriodo) {
  return `${descripcionPeriodoTarjeta(configPeriodo)} ${fechasPeriodoTarjeta(configPeriodo)}`;
}

export function etiquetaFiltroVentaReporte(filtro) {
  return FILTROS_VENTA_REPORTE.find((item) => item.value === filtro)?.label || 'Todos';
}

export function pedidoDentroDePeriodo(pedido, configPeriodo) {
  if (!pedido?.created_at) return false;
  if (rangoFechasInvalido(configPeriodo.fechaDesde, configPeriodo.fechaHasta)) {
    return false;
  }

  const fecha = new Date(pedido.created_at);
  const { inicio, fin } = obtenerRangoReporte(configPeriodo);
  if (!inicio || !fin) return false;

  return fecha >= inicio && fecha <= fin;
}

export function pedidoCoincideFiltroVenta(pedido, filtro) {
  const esCaja = pedido.tipo === 'presencial';
  const esWhatsapp = !pedido.tipo || pedido.tipo === 'whatsapp';
  const tipoEntrega = normalizarTipoEntrega(pedido.tipo_entrega);

  switch (filtro) {
    case 'caja':
      return esCaja;
    case 'whatsapp':
      return esWhatsapp;
    case 'whatsapp_domicilio':
      return esWhatsapp && tipoEntrega === TIPOS_ENTREGA.DOMICILIO;
    case 'whatsapp_sucursal':
      return esWhatsapp && tipoEntrega === TIPOS_ENTREGA.SUCURSAL;
    case 'todos':
    default:
      return true;
  }
}

export function filtrarPedidosReporte(pedidos, configPeriodo, filtroVenta) {
  return pedidos.filter(
    (pedido) =>
      pedidoDentroDePeriodo(pedido, configPeriodo) &&
      pedidoCoincideFiltroVenta(pedido, filtroVenta)
  );
}

export function calcularResumenReporte(pedidos) {
  const totalPedidos = pedidos.length;
  const montoAcumulado = pedidos.reduce(
    (suma, pedido) => suma + Number(pedido.total || 0),
    0
  );

  return { totalPedidos, montoAcumulado };
}

export function formatearClienteReporte(pedido) {
  const cliente = pedido.cliente?.trim() || CLIENTE_PUBLICO;
  const referencia = pedido.referencia?.trim();

  if (referencia) {
    return `${cliente} — ${referencia}`;
  }

  return cliente;
}

export function etiquetaTipoEntregaReporte(pedido) {
  if (pedido.tipo === 'presencial') {
    return 'Caja';
  }

  const tipoEntrega = normalizarTipoEntrega(pedido.tipo_entrega);
  return tipoEntrega === TIPOS_ENTREGA.SUCURSAL
    ? 'Para recoger en sucursal'
    : 'A domicilio';
}

export function formatearProductosReporte(pedido) {
  const resumen = pedido.producto?.trim();
  if (resumen) return resumen;

  const lineas = Array.isArray(pedido.lineas_detalle) ? pedido.lineas_detalle : [];
  if (!lineas.length) return '—';

  return lineas
    .map((linea) => {
      const cantidad = Number(linea.cantidad) || 1;
      const descripcion = linea.descripcion?.trim() || 'Producto';
      return `${cantidad}x ${descripcion}`;
    })
    .join(', ');
}

export function formatearFechaPedidoReporte(createdAt) {
  if (!createdAt) return '—';

  return new Date(createdAt).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function exportarReportePdf({
  configPeriodo,
  filtroVenta,
  resumen,
  pedidos,
}) {
  const doc = new jsPDF();
  const tituloPeriodo = etiquetaPeriodoReporte(configPeriodo);
  const tituloFiltro = etiquetaFiltroVentaReporte(filtroVenta);

  doc.setFontSize(16);
  doc.setTextColor(20, 83, 45);
  doc.text('Reporte de ventas', 14, 18);

  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text(`Período: ${tituloPeriodo}`, 14, 26);
  doc.text(`Tipo de venta: ${tituloFiltro}`, 14, 32);
  doc.text(`Total de pedidos: ${resumen.totalPedidos}`, 14, 40);
  doc.text(`Monto acumulado: $${resumen.montoAcumulado.toFixed(2)}`, 14, 46);

  const filas = pedidos.map((pedido) => [
    formatearFechaPedidoReporte(pedido.created_at),
    formatearClienteReporte(pedido),
    formatearProductosReporte(pedido),
    etiquetaTipoEntregaReporte(pedido),
    `$${Number(pedido.total || 0).toFixed(2)}`,
  ]);

  autoTable(doc, {
    startY: 54,
    head: [['Fecha', 'Cliente', 'Productos', 'Tipo de entrega', 'Total']],
    body: filas.length > 0 ? filas : [['—', '—', 'Sin pedidos en el período', '—', '—']],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [20, 83, 45], textColor: 255 },
    alternateRowStyles: { fillColor: [236, 253, 245] },
    columnStyles: {
      2: { cellWidth: 60 },
      4: { halign: 'right' },
    },
  });

  const { tipo } = obtenerRangoReporte(configPeriodo);
  const sufijos = {
    [PERIODOS_REPORTE.MES]: 'mes',
    [PERIODOS_REPORTE.SEMANA]: 'semana',
    personalizado: 'personalizado',
  };
  doc.save(`reporte-ventas-${sufijos[tipo] || 'reporte'}.pdf`);
}
