jest.mock('jspdf', () => ({
  jsPDF: jest.fn(),
}));

jest.mock('jspdf-autotable', () => jest.fn());

/* eslint-disable import/first -- jest.mock debe ir antes del import de reportesHelpers (jspdf) */
import {
  obtenerRangoFechasNegocioMerida,
  PERIODOS_REPORTE,
} from './reportesHelpers';

describe('obtenerRangoFechasNegocioMerida', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test('mes usa día 1 a hoy en Mérida aunque UTC ya sea el día siguiente', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-03T02:00:00.000Z'));

    expect(
      obtenerRangoFechasNegocioMerida({ periodo: PERIODOS_REPORTE.MES })
    ).toEqual({
      fechaDesde: '2026-11-01',
      fechaHasta: '2026-11-02',
    });
  });

  test('hoy: madrugada UTC sigue siendo el mismo día calendario en Mérida (semana)', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-03T02:00:00.000Z'));

    expect(
      obtenerRangoFechasNegocioMerida({ periodo: PERIODOS_REPORTE.SEMANA })
    ).toEqual({
      fechaDesde: '2026-11-02',
      fechaHasta: '2026-11-02',
    });
  });

  test('hoy: personalizado de un solo día en Mérida', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-03T18:00:00.000Z'));

    expect(
      obtenerRangoFechasNegocioMerida({
        periodo: PERIODOS_REPORTE.SEMANA,
        fechaDesde: '2026-11-03',
        fechaHasta: '2026-11-03',
      })
    ).toEqual({
      fechaDesde: '2026-11-03',
      fechaHasta: '2026-11-03',
    });
  });

  test('semana: domingo en Mérida arranca el lunes anterior', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-01T20:00:00.000Z'));

    expect(
      obtenerRangoFechasNegocioMerida({ periodo: PERIODOS_REPORTE.SEMANA })
    ).toEqual({
      fechaDesde: '2026-10-26',
      fechaHasta: '2026-11-01',
    });
  });

  test('semana: lunes en Mérida deja un solo día', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-02T18:00:00.000Z'));

    expect(
      obtenerRangoFechasNegocioMerida({ periodo: PERIODOS_REPORTE.SEMANA })
    ).toEqual({
      fechaDesde: '2026-11-02',
      fechaHasta: '2026-11-02',
    });
  });

  test('personalizado válido respeta las fechas indicadas', () => {
    expect(
      obtenerRangoFechasNegocioMerida({
        periodo: PERIODOS_REPORTE.MES,
        fechaDesde: '2026-07-01',
        fechaHasta: '2026-07-15',
      })
    ).toEqual({
      fechaDesde: '2026-07-01',
      fechaHasta: '2026-07-15',
    });
  });

  test('personalizado invertido devuelve null', () => {
    expect(
      obtenerRangoFechasNegocioMerida({
        periodo: PERIODOS_REPORTE.SEMANA,
        fechaDesde: '2026-07-15',
        fechaHasta: '2026-07-01',
      })
    ).toBeNull();
  });

  test('personalizado vacío cae en semana con fechas en Mérida', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-03T18:00:00.000Z'));

    expect(
      obtenerRangoFechasNegocioMerida({
        periodo: PERIODOS_REPORTE.SEMANA,
        fechaDesde: '',
        fechaHasta: '',
      })
    ).toEqual({
      fechaDesde: '2026-11-02',
      fechaHasta: '2026-11-03',
    });
  });

  test('personalizado incompleto cae en semana con fechas en Mérida', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-03T18:00:00.000Z'));

    expect(
      obtenerRangoFechasNegocioMerida({
        periodo: PERIODOS_REPORTE.SEMANA,
        fechaDesde: '2026-07-01',
        fechaHasta: '',
      })
    ).toEqual({
      fechaDesde: '2026-11-02',
      fechaHasta: '2026-11-03',
    });
  });

  test('personalizado con fecha inválida devuelve null', () => {
    expect(
      obtenerRangoFechasNegocioMerida({
        periodo: PERIODOS_REPORTE.SEMANA,
        fechaDesde: '2026-13-40',
        fechaHasta: '2026-07-01',
      })
    ).toBeNull();
  });
});
