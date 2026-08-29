import {
  calcularUmbralTiempoReal,
  cruzoUmbralTiempoReal,
  esPedidoProgramado,
  formatearProgramadoParaBadge,
  necesitaReasignacionJornadaProgramado,
  pedidoProgramadoActivadoEnJornada,
  pedidoWhatsappEnTabProgramadosCocina,
  pedidoWhatsappEnTabTiempoRealCocina,
  programadoParaDesdeForm,
  validarProgramadoParaFuturo,
} from './pedidosProgramadosHelpers';

const pedidoProgramado = {
  id: 'p1',
  tipo: 'whatsapp',
  jornada_id: 'jornada-creacion',
  programado_para: '2026-08-30T20:00:00.000Z',
};

describe('pedidosProgramadosHelpers', () => {
  test('esPedidoProgramado distingue null de programado', () => {
    expect(esPedidoProgramado({ programado_para: null })).toBe(false);
    expect(esPedidoProgramado({ programado_para: '2026-08-30T20:00:00.000Z' })).toBe(true);
  });

  test('calcularUmbralTiempoReal resta minutos de anticipación', () => {
    const umbral = calcularUmbralTiempoReal('2026-08-30T20:00:00.000Z', 30);
    expect(umbral?.toISOString()).toBe('2026-08-30T19:30:00.000Z');
  });

  test('cruzoUmbralTiempoReal respeta el umbral', () => {
    const antes = new Date('2026-08-30T19:29:59.000Z');
    const despues = new Date('2026-08-30T19:30:00.000Z');

    expect(cruzoUmbralTiempoReal(pedidoProgramado, 30, antes)).toBe(false);
    expect(cruzoUmbralTiempoReal(pedidoProgramado, 30, despues)).toBe(true);
    expect(cruzoUmbralTiempoReal({ ...pedidoProgramado, programado_para: null }, 30, despues)).toBe(
      true
    );
  });

  test('pedidoProgramadoActivadoEnJornada exige umbral cruzado y jornada reasignada', () => {
    const ahora = new Date('2026-08-30T19:45:00.000Z');

    expect(
      pedidoProgramadoActivadoEnJornada(pedidoProgramado, 'jornada-creacion', 30, ahora)
    ).toBe(true);
    expect(
      pedidoProgramadoActivadoEnJornada(pedidoProgramado, 'jornada-nueva', 30, ahora)
    ).toBe(false);
    expect(pedidoProgramadoActivadoEnJornada(pedidoProgramado, null, 30, ahora)).toBe(false);
  });

  test('tabs de cocina separan programados y tiempo real para whatsapp', () => {
    const ahora = new Date('2026-08-30T19:45:00.000Z');

    expect(
      pedidoWhatsappEnTabProgramadosCocina(pedidoProgramado, 'jornada-nueva', 30, ahora)
    ).toBe(true);
    expect(
      pedidoWhatsappEnTabTiempoRealCocina(pedidoProgramado, 'jornada-nueva', 30, ahora)
    ).toBe(false);
    expect(
      pedidoWhatsappEnTabTiempoRealCocina(pedidoProgramado, 'jornada-creacion', 30, ahora)
    ).toBe(true);
  });

  test('necesitaReasignacionJornadaProgramado solo tras umbral y con jornada distinta', () => {
    const ahora = new Date('2026-08-30T19:45:00.000Z');

    expect(
      necesitaReasignacionJornadaProgramado(pedidoProgramado, 'jornada-nueva', 30, ahora)
    ).toBe(true);
    expect(
      necesitaReasignacionJornadaProgramado(pedidoProgramado, 'jornada-creacion', 30, ahora)
    ).toBe(false);
    expect(necesitaReasignacionJornadaProgramado(pedidoProgramado, null, 30, ahora)).toBe(false);
  });

  test('validarProgramadoParaFuturo rechaza fechas pasadas o inválidas', () => {
    const ahora = new Date('2026-08-30T12:00:00.000Z');

    expect(validarProgramadoParaFuturo('', ahora).valido).toBe(false);
    expect(validarProgramadoParaFuturo('2026-08-29T10:00', ahora).valido).toBe(false);
    expect(validarProgramadoParaFuturo('2026-08-30T18:00', ahora).valido).toBe(true);
  });

  test('programadoParaDesdeForm devuelve null si no está programado', () => {
    expect(programadoParaDesdeForm(false, '2026-08-30T18:00')).toBe(null);
    expect(programadoParaDesdeForm(true, '2026-08-30T18:00')).toMatch(/T/);
  });

  test('formatearProgramadoParaBadge incluye hora legible', () => {
    expect(formatearProgramadoParaBadge('2026-08-30T20:00:00.000Z')).toMatch(
      /Programado para las/
    );
  });
});
