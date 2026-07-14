import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatearMoneda, normalizarTipoEntrega, TIPOS_ENTREGA } from './pedidosShared';

export const PERIODOS_REPORTE = {
  SEMANA: 'semana',
  MES: 'mes',
};

export const FILTROS_VENTA_REPORTE = [
  { value: 'todos', label: 'Todos' },
  { value: 'caja', label: 'Caja' },
  { value: 'mostrador', label: 'Mostrador' },
  { value: 'whatsapp_domicilio', label: 'A domicilio' },
  { value: 'whatsapp_sucursal', label: 'Para recoger en sucursal' },
  { value: 'whatsapp', label: 'A domicilio / para recoger en sucursal (ambos)' },
  { value: 'mesas', label: 'Mesas' },
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
  const esMostrador = pedido.tipo === 'mostrador';
  const esMesa = pedido.tipo === 'mesa';
  const esWhatsapp = !pedido.tipo || pedido.tipo === 'whatsapp';
  const tipoEntrega = normalizarTipoEntrega(pedido.tipo_entrega);

  switch (filtro) {
    case 'caja':
      return esCaja;
    case 'mostrador':
      return esMostrador;
    case 'mesas':
      return esMesa;
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

  if (pedido.tipo === 'mesa') {
    return 'En Mesa';
  }

  if (pedido.tipo === 'mostrador') {
    return 'Mostrador';
  }

  const tipoEntrega = normalizarTipoEntrega(pedido.tipo_entrega);
  return tipoEntrega === TIPOS_ENTREGA.SUCURSAL
    ? 'Para recoger en sucursal'
    : 'A domicilio';
}

const FORMAS_PAGO_REPORTE = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'link_pago', label: 'Link de pago' },
];

export function formatearFormaPagoReporte(pedido) {
  const valor = String(pedido.forma_pago ?? '').trim();
  if (!valor) return '—';

  return FORMAS_PAGO_REPORTE.find((forma) => forma.value === valor)?.label || '—';
}

export function formatearProductosReporte(pedido) {
  const lineas = Array.isArray(pedido.lineas_detalle) ? pedido.lineas_detalle : [];

  if (lineas.length > 0) {
    return lineas
      .map((linea) => {
        const descripcion = (linea.descripcion || linea.nombre || 'Producto').trim();
        const cantidad = Math.max(1, parseInt(linea.cantidad, 10) || 1);
        const precioUnitario = linea.precio_unitario;

        if (
          precioUnitario != null &&
          precioUnitario !== '' &&
          Number.isFinite(Number(precioUnitario))
        ) {
          return `${descripcion} x${cantidad} — ${formatearMoneda(precioUnitario)} c/u`;
        }

        return `${descripcion} x${cantidad}`;
      })
      .join(', ');
  }

  const resumen = pedido.producto?.trim();
  if (resumen) return resumen;

  return '—';
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

export function claveFechaDesdeDate(fecha) {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, '0');
  const day = String(fecha.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatearEncabezadoGrupoFecha(fecha) {
  const diaSemana = fecha.toLocaleDateString('es-MX', { weekday: 'long' });
  const diaCapitalizado = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
  const dia = fecha.getDate();
  const mes = MESES_CORTOS_ES[fecha.getMonth()];
  const anio = fecha.getFullYear();

  return `${diaCapitalizado}, ${dia} ${mes} ${anio}`;
}

export function formatearHoraPedidoLista(createdAt) {
  if (!createdAt) return '—';

  return new Date(createdAt).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function agruparPedidosPorDia(pedidos) {
  const grupos = new Map();

  pedidos.forEach((pedido) => {
    const fecha = pedido.created_at ? new Date(pedido.created_at) : new Date(0);
    const clave = claveFechaDesdeDate(fecha);

    if (!grupos.has(clave)) {
      grupos.set(clave, { clave, fecha, pedidos: [] });
    }

    grupos.get(clave).pedidos.push(pedido);
  });

  return Array.from(grupos.values())
    .sort((a, b) => b.fecha - a.fecha)
    .map((grupo) => ({
      ...grupo,
      etiqueta: formatearEncabezadoGrupoFecha(grupo.fecha),
      totalDelDia: grupo.pedidos.reduce(
        (suma, pedido) => suma + Number(pedido.total || 0),
        0
      ),
      pedidos: grupo.pedidos.sort(
        (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
      ),
    }));
}

export function periodoMultiplesDias(configPeriodo) {
  const { inicio, fin } = obtenerRangoReporte(configPeriodo);
  if (!inicio || !fin) return false;

  return inicio.toDateString() !== fin.toDateString();
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
  doc.text(`Monto acumulado: ${formatearMoneda(resumen.montoAcumulado)}`, 14, 46);

  const multiplesDias = periodoMultiplesDias(configPeriodo);
  let filas = [];

  if (multiplesDias) {
    agruparPedidosPorDia(pedidos).forEach((grupo) => {
      filas.push([
        {
          content: `${grupo.etiqueta} — Total del día: ${formatearMoneda(grupo.totalDelDia)}`,
          colSpan: 7,
          styles: {
            fillColor: [236, 253, 245],
            textColor: [20, 83, 45],
            fontStyle: 'bold',
          },
        },
      ]);

      grupo.pedidos.forEach((pedido) => {
        filas.push([
          formatearHoraPedidoLista(pedido.created_at),
          pedido.folio !== null ? String(pedido.folio) : '',
          formatearClienteReporte(pedido),
          formatearFormaPagoReporte(pedido),
          formatearProductosReporte(pedido),
          etiquetaTipoEntregaReporte(pedido),
          formatearMoneda(pedido.total),
        ]);
      });
    });
  } else {
    filas = pedidos.map((pedido) => [
      formatearFechaPedidoReporte(pedido.created_at),
      pedido.folio !== null ? String(pedido.folio) : '',
      formatearClienteReporte(pedido),
      formatearFormaPagoReporte(pedido),
      formatearProductosReporte(pedido),
      etiquetaTipoEntregaReporte(pedido),
      formatearMoneda(pedido.total),
    ]);
  }

  autoTable(doc, {
    startY: 54,
    head: [
      [
        multiplesDias ? 'Hora' : 'Fecha',
        'Folio',
        'Cliente',
        'Forma de pago',
        'Productos',
        'Tipo de entrega',
        'Total',
      ],
    ],
    body: filas.length > 0 ? filas : [['—', '—', '—', 'Sin pedidos en el período', '—', '—', '—']],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [20, 83, 45], textColor: 255 },
    alternateRowStyles: { fillColor: [236, 253, 245] },
    columnStyles: {
      4: { cellWidth: 60 },
      6: { halign: 'right' },
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

const FORMAS_PAGO_ARQUEO_PDF = [
  { label: 'Efectivo', sistema: 'efectivo_sistema', contado: 'efectivo_contado' },
  { label: 'Tarjeta', sistema: 'tarjeta_sistema', contado: 'tarjeta_contado' },
  {
    label: 'Transferencia',
    sistema: 'transferencia_sistema',
    contado: 'transferencia_contado',
  },
  { label: 'Link de pago', sistema: 'link_sistema', contado: 'link_contado' },
];

export function filtrarArqueosReporte(arqueos, configPeriodo) {
  if (rangoFechasInvalido(configPeriodo.fechaDesde, configPeriodo.fechaHasta)) {
    return [];
  }

  const { inicio, fin } = obtenerRangoReporte(configPeriodo);
  if (!inicio || !fin) return [];

  return (arqueos || [])
    .filter((arqueo) => {
      const fecha = new Date(arqueo.created_at || 0);
      return fecha >= inicio && fecha <= fin;
    })
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
}

function agruparRetirosPorDiaPdf(retiros) {
  const grupos = new Map();

  (retiros || []).forEach((retiro) => {
    const clave = claveFechaDesdeDate(
      retiro.created_at ? new Date(retiro.created_at) : new Date(0)
    );

    if (!grupos.has(clave)) {
      grupos.set(clave, []);
    }

    grupos.get(clave).push(retiro);
  });

  return grupos;
}

function formatearDesgloseArqueoPdf(arqueo) {
  return FORMAS_PAGO_ARQUEO_PDF.map(
    ({ label, sistema, contado }) =>
      `${label}: sistema ${formatearMoneda(arqueo[sistema])}, contado ${formatearMoneda(arqueo[contado])}`
  ).join('\n');
}

function formatearRetirosArqueoPdf(arqueo, retirosDelDia) {
  const ventasTotalesDelDia =
    (Number(arqueo.total_sistema) || 0) -
    (Number(arqueo.fondo_fijo_del_dia) || 0) +
    (Number(arqueo.retiros_del_dia) || 0);

  const lineas = [`Ventas totales del día: ${formatearMoneda(ventasTotalesDelDia)}`];

  if (Number(arqueo.fondo_fijo_del_dia) > 0) {
    lineas.push(`Fondo fijo del día: ${formatearMoneda(arqueo.fondo_fijo_del_dia)}`);
  }

  lineas.push(`Retiros del día: ${formatearMoneda(arqueo.retiros_del_dia)}`);

  if (!retirosDelDia.length) {
    lineas.push('Sin retiros registrados ese día.');
    return lineas.join('\n');
  }

  retirosDelDia.forEach((retiro) => {
    lineas.push(
      `${formatearHoraPedidoLista(retiro.created_at)} — ${retiro.motivo?.trim() || 'Sin motivo'} — ${formatearMoneda(retiro.monto)}`
    );
  });

  return lineas.join('\n');
}

function formatearDiferenciaArqueoPdf(valor) {
  const diferencia = Number(valor) || 0;
  const prefijo = diferencia > 0 ? '+' : '';
  return `${prefijo}${formatearMoneda(diferencia)}`;
}

export function exportarArqueosPdf({ configPeriodo, arqueos, retiros }) {
  const doc = new jsPDF();
  const arqueosFiltrados = filtrarArqueosReporte(arqueos, configPeriodo);
  const retirosPorDia = agruparRetirosPorDiaPdf(retiros);
  const tituloPeriodo = etiquetaPeriodoReporte(configPeriodo);

  doc.setFontSize(16);
  doc.setTextColor(20, 83, 45);
  doc.text('Reporte de arqueos', 14, 18);

  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text(`Período: ${tituloPeriodo}`, 14, 26);
  doc.text(`Total de arqueos: ${arqueosFiltrados.length}`, 14, 32);

  const filas = arqueosFiltrados.map((arqueo) => {
    const claveDia = claveFechaDesdeDate(
      arqueo.created_at ? new Date(arqueo.created_at) : new Date(0)
    );
    const retirosDelDia = retirosPorDia.get(claveDia) || [];

    return [
      formatearFechaPedidoReporte(arqueo.created_at),
      arqueo.usuario?.trim() || '—',
      formatearDesgloseArqueoPdf(arqueo),
      formatearRetirosArqueoPdf(arqueo, retirosDelDia),
      formatearDiferenciaArqueoPdf(arqueo.diferencia),
    ];
  });

  autoTable(doc, {
    startY: 40,
    head: [
      [
        'Fecha y hora',
        'Usuario',
        'Desglose (sistema / contado)',
        'Retiros del día',
        'Diferencia',
      ],
    ],
    body:
      filas.length > 0 ? filas : [['—', '—', 'Sin arqueos en el período', '—', '—']],
    styles: { fontSize: 7, cellPadding: 2, valign: 'top' },
    headStyles: { fillColor: [20, 83, 45], textColor: 255 },
    alternateRowStyles: { fillColor: [236, 253, 245] },
    columnStyles: {
      0: { cellWidth: 28 },
      2: { cellWidth: 52 },
      3: { cellWidth: 48 },
      4: { halign: 'right', cellWidth: 22 },
    },
  });

  const { tipo } = obtenerRangoReporte(configPeriodo);
  const sufijos = {
    [PERIODOS_REPORTE.MES]: 'mes',
    [PERIODOS_REPORTE.SEMANA]: 'semana',
    personalizado: 'personalizado',
  };
  doc.save(`reporte-arqueos-${sufijos[tipo] || 'reporte'}.pdf`);
}

function formatearFechaSoloRetiroPdf(createdAt) {
  if (!createdAt) return '—';

  return new Date(createdAt).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function exportarRetirosPdf({ configPeriodo, retiros }) {
  const doc = new jsPDF();
  const retirosFiltrados = filtrarArqueosReporte(retiros, configPeriodo);
  const tituloPeriodo = etiquetaPeriodoReporte(configPeriodo);

  doc.setFontSize(16);
  doc.setTextColor(20, 83, 45);
  doc.text('Reporte de retiros de efectivo', 14, 18);

  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text(`Período: ${tituloPeriodo}`, 14, 26);
  doc.text(`Total de retiros: ${retirosFiltrados.length}`, 14, 32);

  const filas = retirosFiltrados.map((retiro) => [
    formatearFechaSoloRetiroPdf(retiro.created_at),
    formatearHoraPedidoLista(retiro.created_at),
    retiro.usuario?.trim() || '—',
    retiro.motivo?.trim() || 'Sin motivo',
    formatearMoneda(retiro.monto),
  ]);

  autoTable(doc, {
    startY: 40,
    head: [['Fecha', 'Hora', 'Usuario', 'Motivo', 'Monto']],
    body:
      filas.length > 0 ? filas : [['—', '—', 'Sin retiros en el período', '—', '—']],
    styles: { fontSize: 8, cellPadding: 2, valign: 'top' },
    headStyles: { fillColor: [20, 83, 45], textColor: 255 },
    alternateRowStyles: { fillColor: [236, 253, 245] },
    columnStyles: {
      3: { cellWidth: 60 },
      4: { halign: 'right', cellWidth: 24 },
    },
  });

  const { tipo } = obtenerRangoReporte(configPeriodo);
  const sufijos = {
    [PERIODOS_REPORTE.MES]: 'mes',
    [PERIODOS_REPORTE.SEMANA]: 'semana',
    personalizado: 'personalizado',
  };
  doc.save(`reporte-retiros-${sufijos[tipo] || 'reporte'}.pdf`);
}

export function exportarFondosFijosPdf({ configPeriodo, arqueos }) {
  const doc = new jsPDF();
  const arqueosFiltrados = filtrarArqueosReporte(arqueos, configPeriodo);
  const tituloPeriodo = etiquetaPeriodoReporte(configPeriodo);

  doc.setFontSize(16);
  doc.setTextColor(20, 83, 45);
  doc.text('Reporte de fondos fijos', 14, 18);

  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text(`Período: ${tituloPeriodo}`, 14, 26);
  doc.text(`Total de registros: ${arqueosFiltrados.length}`, 14, 32);

  const filas = arqueosFiltrados.map((arqueo) => [
    formatearFechaSoloRetiroPdf(arqueo.created_at),
    formatearHoraPedidoLista(arqueo.created_at),
    arqueo.usuario?.trim() || '—',
    formatearMoneda(arqueo.fondo_fijo_del_dia),
  ]);

  autoTable(doc, {
    startY: 40,
    head: [['Fecha', 'Hora', 'Usuario', 'Fondo fijo']],
    body:
      filas.length > 0 ? filas : [['—', '—', 'Sin fondos fijos en el período', '—']],
    styles: { fontSize: 8, cellPadding: 2, valign: 'top' },
    headStyles: { fillColor: [20, 83, 45], textColor: 255 },
    alternateRowStyles: { fillColor: [236, 253, 245] },
    columnStyles: {
      3: { halign: 'right', cellWidth: 28 },
    },
  });

  const { tipo } = obtenerRangoReporte(configPeriodo);
  const sufijos = {
    [PERIODOS_REPORTE.MES]: 'mes',
    [PERIODOS_REPORTE.SEMANA]: 'semana',
    personalizado: 'personalizado',
  };
  doc.save(`reporte-fondos-fijos-${sufijos[tipo] || 'reporte'}.pdf`);
}
