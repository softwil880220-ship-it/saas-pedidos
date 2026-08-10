jest.mock('jspdf', () => ({
  jsPDF: jest.fn(),
}));

jest.mock('jspdf-autotable', () => jest.fn());

import {
  cargarFiltrosReportes,
  FILTROS_REPORTE_DEFAULT,
  persistirFiltrosReportes,
} from './reportesFiltrosStorage';
import { PERIODOS_REPORTE } from './reportesHelpers';

const NEGOCIO_ID = 'negocio-abc';
const CLAVE = `pos_reportes_filtros:${NEGOCIO_ID}`;

describe('reportesFiltrosStorage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test('devuelve defaults cuando no hay datos guardados', () => {
    expect(cargarFiltrosReportes(NEGOCIO_ID)).toEqual(FILTROS_REPORTE_DEFAULT);
  });

  test('persiste y restaura filtros por negocioId', () => {
    persistirFiltrosReportes(NEGOCIO_ID, {
      periodo: PERIODOS_REPORTE.MES,
      fechaDesde: '2026-07-01',
      fechaHasta: '2026-07-15',
      filtroVenta: 'mostrador',
    });

    expect(cargarFiltrosReportes(NEGOCIO_ID)).toEqual({
      periodo: PERIODOS_REPORTE.MES,
      fechaDesde: '2026-07-01',
      fechaHasta: '2026-07-15',
      filtroVenta: 'mostrador',
    });
  });

  test('aisla filtros entre distintos negocios', () => {
    persistirFiltrosReportes('negocio-1', {
      ...FILTROS_REPORTE_DEFAULT,
      filtroVenta: 'caja',
    });
    persistirFiltrosReportes('negocio-2', {
      ...FILTROS_REPORTE_DEFAULT,
      filtroVenta: 'mesas',
    });

    expect(cargarFiltrosReportes('negocio-1').filtroVenta).toBe('caja');
    expect(cargarFiltrosReportes('negocio-2').filtroVenta).toBe('mesas');
  });

  test('ignora valores inválidos al cargar', () => {
    window.localStorage.setItem(
      CLAVE,
      JSON.stringify({
        periodo: 'invalido',
        fechaDesde: '2026/07/01',
        fechaHasta: 'mal',
        filtroVenta: 'otro',
      })
    );

    expect(cargarFiltrosReportes(NEGOCIO_ID)).toEqual(FILTROS_REPORTE_DEFAULT);
  });

  test('normaliza fechas al persistir', () => {
    persistirFiltrosReportes(NEGOCIO_ID, {
      periodo: PERIODOS_REPORTE.SEMANA,
      fechaDesde: ' 2026-08-01 ',
      fechaHasta: 'no-fecha',
      filtroVenta: 'todos',
    });

    expect(JSON.parse(window.localStorage.getItem(CLAVE))).toEqual({
      periodo: PERIODOS_REPORTE.SEMANA,
      fechaDesde: '2026-08-01',
      fechaHasta: '',
      filtroVenta: 'todos',
    });
  });
});
