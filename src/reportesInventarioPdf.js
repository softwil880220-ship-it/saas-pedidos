import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { normalizarDetalleCorte } from './InventarioCorteHistorial';
import { formatearCantidadConUnidadMedida } from './inventarioFormatoHelpers';
import {
  PERIODOS_REPORTE,
  etiquetaPeriodoReporte,
  obtenerRangoReporte,
} from './reportesHelpers';

function formatearFechaHoraReporteInventario(valor) {
  if (!valor) return '—';

  return new Date(valor).toLocaleString('es-MX', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function filasPdfDetalleCorte(snapshot, insumosPorId) {
  return normalizarDetalleCorte(snapshot.detalle).map((fila) => {
    const insumo = insumosPorId[String(fila?.insumo_id)];
    const unidad = insumo?.unidad_medida || '';
    const consumido =
      (Number(fila?.consumo_venta) || 0) + (Number(fila?.consumo_empleados) || 0);
    return [
      insumo?.nombre || 'Insumo',
      formatearCantidadConUnidadMedida(fila?.carga_inicial, unidad),
      formatearCantidadConUnidadMedida(fila?.compra_adicional, unidad),
      formatearCantidadConUnidadMedida(consumido, unidad),
      formatearCantidadConUnidadMedida(fila?.contado_fisico, unidad),
      formatearCantidadConUnidadMedida(fila?.merma_explicada, unidad),
      formatearCantidadConUnidadMedida(fila?.diferencia, unidad),
    ];
  });
}

export function exportarConsumoPersonalPdf({
  configPeriodo,
  resumen,
  filasPorProducto,
  filasDetalladas = [],
  empleadoEtiqueta,
}) {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.setTextColor(20, 83, 45);
  doc.text('Reporte de consumo de personal', 14, 18);

  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text(`Período: ${etiquetaPeriodoReporte(configPeriodo)}`, 14, 26);

  if (empleadoEtiqueta) {
    doc.text(`Empleado: ${empleadoEtiqueta}`, 14, 32);
  }

  doc.text(`Registros: ${resumen.totalRegistros}`, 14, empleadoEtiqueta ? 38 : 32);
  doc.text(
    `Productos distintos: ${resumen.totalProductos}`,
    14,
    empleadoEtiqueta ? 44 : 38
  );

  autoTable(doc, {
    startY: empleadoEtiqueta ? 50 : 44,
    head: [['Producto', 'Cantidad total', 'Detalle']],
    body:
      filasPorProducto.length > 0
        ? filasPorProducto.map((fila) => [
            fila.nombreProducto,
            fila.cantidadEtiqueta,
            fila.resumenVariantes || '—',
          ])
        : [['—', 'Sin consumos en el período', '—']],
    styles: { fontSize: 8, cellPadding: 2, valign: 'top' },
    headStyles: { fillColor: [20, 83, 45], textColor: 255 },
    alternateRowStyles: { fillColor: [236, 253, 245] },
  });

  if (filasDetalladas.length > 0) {
    const startY = (doc.lastAutoTable?.finalY || 50) + 8;
    doc.setFontSize(11);
    doc.text(
      empleadoEtiqueta ? 'Registros de consumo' : 'Desglose por empleado',
      14,
      startY
    );

    const encabezado = empleadoEtiqueta
      ? ['Cantidad', 'Producto', 'Detalle', 'Fecha y hora']
      : ['Empleado', 'Cantidad', 'Producto', 'Detalle', 'Fecha y hora'];

    const filasEmpleado = filasDetalladas.map((fila) =>
      empleadoEtiqueta
        ? [
            fila.cantidadEtiqueta,
            fila.nombreProducto,
            fila.resumenVariantes || '—',
            fila.fechaHoraEtiqueta,
          ]
        : [
            fila.nombreEmpleado,
            fila.cantidadEtiqueta,
            fila.nombreProducto,
            fila.resumenVariantes || '—',
            fila.fechaHoraEtiqueta,
          ]
    );

    autoTable(doc, {
      startY: startY + 4,
      head: [encabezado],
      body: filasEmpleado,
      styles: { fontSize: 8, cellPadding: 2, valign: 'top' },
      headStyles: { fillColor: [20, 83, 45], textColor: 255 },
      alternateRowStyles: { fillColor: [236, 253, 245] },
    });
  }

  const { tipo } = obtenerRangoReporte(configPeriodo);
  const sufijos = {
    [PERIODOS_REPORTE.MES]: 'mes',
    [PERIODOS_REPORTE.SEMANA]: 'semana',
    personalizado: 'personalizado',
  };
  doc.save(`reporte-consumo-personal-${sufijos[tipo] || 'reporte'}.pdf`);
}

export function exportarCortesInventarioPdf({
  configPeriodo,
  resumen,
  snapshots,
  insumosPorId,
  resolverNombreUsuario,
}) {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.setTextColor(20, 83, 45);
  doc.text('Reporte de cortes de inventario', 14, 18);

  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text(`Período: ${etiquetaPeriodoReporte(configPeriodo)}`, 14, 26);
  doc.text(`Cortes registrados: ${resumen.totalCortes}`, 14, 32);

  let cursorY = 40;

  if (!snapshots.length) {
    doc.text('Sin cortes en el período seleccionado.', 14, cursorY);
  } else {
    snapshots.forEach((snapshot, indice) => {
      if (cursorY > 250) {
        doc.addPage();
        cursorY = 18;
      }

      const autorId = snapshot.autorizado_por || snapshot.creado_por;
      const etiquetaAutor =
        snapshot.autorizado_por != null
          ? `Autorizado por ${resolverNombreUsuario(autorId)}`
          : `Registrado por ${resolverNombreUsuario(autorId)}`;

      doc.setFontSize(10);
      doc.setTextColor(20, 83, 45);
      doc.text(
        `Corte ${indice + 1} — ${formatearFechaHoraReporteInventario(snapshot.created_at)}`,
        14,
        cursorY
      );
      doc.setTextColor(51, 65, 85);
      doc.text(etiquetaAutor, 14, cursorY + 5);

      const filas = filasPdfDetalleCorte(snapshot, insumosPorId);

      autoTable(doc, {
        startY: cursorY + 8,
        head: [[
          'Insumo',
          'Carga inicial',
          'Compra adicional',
          'Consumido',
          'Conteo físico',
          'Merma explicada',
          'Diferencia',
        ]],
        body:
          filas.length > 0
            ? filas
            : [['—', '—', '—', '—', '—', '—', 'Sin detalle']],
        styles: { fontSize: 7, cellPadding: 1.5, valign: 'top' },
        headStyles: { fillColor: [20, 83, 45], textColor: 255 },
        alternateRowStyles: { fillColor: [236, 253, 245] },
      });

      cursorY = (doc.lastAutoTable?.finalY || cursorY) + 10;
    });
  }

  const { tipo } = obtenerRangoReporte(configPeriodo);
  const sufijos = {
    [PERIODOS_REPORTE.MES]: 'mes',
    [PERIODOS_REPORTE.SEMANA]: 'semana',
    personalizado: 'personalizado',
  };
  doc.save(`reporte-cortes-inventario-${sufijos[tipo] || 'reporte'}.pdf`);
}
