import {
  canalModuloHabilitado,
  modoDashboardDesdeTipoPedido,
  pedidoCanalHabilitado,
  pedidoCoincideFiltroDashboard,
  pedidoCoincideFiltroMostrador,
} from './pedidosQueryHelpers';

describe('modoDashboardDesdeTipoPedido', () => {
  test('mapea tipos de pedido al modo del dashboard', () => {
    expect(modoDashboardDesdeTipoPedido('presencial')).toBe('presencial');
    expect(modoDashboardDesdeTipoPedido('mostrador')).toBe('mostrador');
    expect(modoDashboardDesdeTipoPedido('mesa')).toBe('mesas');
    expect(modoDashboardDesdeTipoPedido('whatsapp')).toBe('whatsapp');
    expect(modoDashboardDesdeTipoPedido(null)).toBe('whatsapp');
    expect(modoDashboardDesdeTipoPedido('')).toBe('whatsapp');
  });
});

describe('pedidoCanalHabilitado', () => {
  const modulosNegocio = {
    habilitar_caja: true,
    habilitar_mostrador: true,
    habilitar_recoger_domicilio: false,
    habilitar_mesas: false,
  };

  test('permite pedidos de canales habilitados', () => {
    expect(
      pedidoCanalHabilitado({ tipo: 'presencial' }, modulosNegocio)
    ).toBe(true);
    expect(
      pedidoCanalHabilitado({ tipo: 'mostrador' }, modulosNegocio)
    ).toBe(true);
  });

  test('bloquea pedidos de canales deshabilitados', () => {
    expect(
      pedidoCanalHabilitado({ tipo: 'whatsapp' }, modulosNegocio)
    ).toBe(false);
    expect(pedidoCanalHabilitado({ tipo: 'mesa' }, modulosNegocio)).toBe(false);
    expect(pedidoCanalHabilitado({ tipo: null }, modulosNegocio)).toBe(false);
  });

  test('canalModuloHabilitado refleja el mismo flag', () => {
    expect(canalModuloHabilitado('presencial', modulosNegocio)).toBe(true);
    expect(canalModuloHabilitado('mesas', modulosNegocio)).toBe(false);
  });
});

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
