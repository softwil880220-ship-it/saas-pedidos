import {
  pedidoCoincideFiltroDashboard,
  pedidoCoincideFiltroMostrador,
} from './pedidosQueryHelpers';

describe('pedidoCoincideFiltroMostrador', () => {
  const hoyClave = '2026-09-12';

  test('incluye pendientes de mostrador', () => {
    expect(
      pedidoCoincideFiltroMostrador(
        {
          tipo: 'mostrador',
          deleted_at: null,
          status: 'listo-para-recoger',
        },
        hoyClave
      )
    ).toBe(true);
  });

  test('incluye entregados hoy', () => {
    expect(
      pedidoCoincideFiltroMostrador(
        {
          tipo: 'mostrador',
          deleted_at: null,
          status: 'entregado',
          mostrador_entregado_at: '2026-09-12T18:30:00.000Z',
        },
        hoyClave
      )
    ).toBe(true);
  });

  test('excluye entregados de otro día', () => {
    expect(
      pedidoCoincideFiltroMostrador(
        {
          tipo: 'mostrador',
          deleted_at: null,
          status: 'entregado',
          mostrador_entregado_at: '2026-09-11T18:30:00.000Z',
        },
        hoyClave
      )
    ).toBe(false);
  });

  test('excluye pedidos de otros canales', () => {
    expect(
      pedidoCoincideFiltroMostrador(
        {
          tipo: 'presencial',
          deleted_at: null,
          status: 'entregado',
        },
        hoyClave
      )
    ).toBe(false);
  });
});

describe('pedidoCoincideFiltroDashboard', () => {
  const filtroFechaClave = '2026-09-12';

  test('incluye pedidos de la jornada activa', () => {
    expect(
      pedidoCoincideFiltroDashboard(
        {
          tipo: 'mostrador',
          deleted_at: null,
          jornada_id: 'jornada-1',
          created_at: '2026-09-12T10:00:00.000Z',
        },
        {
          jornadaId: 'jornada-1',
          jornadaAbiertaEn: '2026-09-12T08:00:00.000Z',
          filtroFechaClave,
        }
      )
    ).toBe(true);
  });

  test('incluye ventas de caja del día filtrado', () => {
    expect(
      pedidoCoincideFiltroDashboard(
        {
          tipo: 'presencial',
          deleted_at: null,
          created_at: '2026-09-12T15:00:00.000Z',
        },
        {
          jornadaId: 'jornada-1',
          jornadaAbiertaEn: '2026-09-12T08:00:00.000Z',
          filtroFechaClave,
        }
      )
    ).toBe(true);
  });

  test('excluye ventas de caja de otra fecha', () => {
    expect(
      pedidoCoincideFiltroDashboard(
        {
          tipo: 'presencial',
          deleted_at: null,
          created_at: '2026-09-11T15:00:00.000Z',
        },
        {
          jornadaId: 'jornada-1',
          jornadaAbiertaEn: '2026-09-12T08:00:00.000Z',
          filtroFechaClave,
        }
      )
    ).toBe(false);
  });
});
