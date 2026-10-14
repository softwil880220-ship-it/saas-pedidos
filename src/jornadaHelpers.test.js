import {
  pedidoPermiteModificacionJornadaActual,
  pedidoPerteneceJornada,
} from './jornadaHelpers';

describe('pedidoPermiteModificacionJornadaActual', () => {
  const jornada = {
    id: 'jornada-1',
    abierta_en: '2026-09-15T08:00:00.000Z',
  };

  test('acepta pedido con jornada_id coincidente', () => {
    const pedido = {
      jornada_id: 'jornada-1',
      created_at: '2026-09-15T10:00:00.000Z',
    };

    expect(pedidoPermiteModificacionJornadaActual(pedido, jornada)).toBe(true);
  });

  test('rechaza pedido de otra jornada', () => {
    const pedido = {
      jornada_id: 'jornada-vieja',
      created_at: '2026-09-14T10:00:00.000Z',
    };

    expect(pedidoPermiteModificacionJornadaActual(pedido, jornada)).toBe(false);
  });

  test('rechaza sin jornada abierta', () => {
    const pedido = {
      jornada_id: 'jornada-1',
      created_at: '2026-09-15T10:00:00.000Z',
    };

    expect(pedidoPermiteModificacionJornadaActual(pedido, null)).toBe(false);
  });

  test('delega en pedidoPerteneceJornada', () => {
    const pedido = { jornada_id: 'jornada-1', created_at: '2026-09-15T10:00:00.000Z' };

    expect(pedidoPermiteModificacionJornadaActual(pedido, jornada)).toBe(
      pedidoPerteneceJornada(pedido, jornada)
    );
  });
});
