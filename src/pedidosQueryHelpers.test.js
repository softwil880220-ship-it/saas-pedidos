import {
  aplicarFiltrosQueryMesaFolio,
  canalModuloHabilitado,
  modoDashboardDesdeTipoPedido,
  pedidoCanalHabilitado,
  pedidoCoincideFiltroDashboard,
  pedidoCoincideFiltroMesaFolio,
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

describe('pedidoCoincideFiltroMesaFolio', () => {
  const abiertaEn = '2026-09-12T10:00:00.000Z';

  test('incluye rondas de la mesa abiertas después de abiertaEn', () => {
    expect(
      pedidoCoincideFiltroMesaFolio(
        {
          tipo: 'mesa',
          deleted_at: null,
          cliente: 'Mesa 3',
          created_at: '2026-09-12T11:00:00.000Z',
        },
        { numeroMesa: 3, abiertaEn }
      )
    ).toBe(true);
  });

  test('excluye rondas de otra mesa o anteriores al folio', () => {
    expect(
      pedidoCoincideFiltroMesaFolio(
        {
          tipo: 'mesa',
          deleted_at: null,
          cliente: 'Mesa 4',
          created_at: '2026-09-12T11:00:00.000Z',
        },
        { numeroMesa: 3, abiertaEn }
      )
    ).toBe(false);

    expect(
      pedidoCoincideFiltroMesaFolio(
        {
          tipo: 'mesa',
          deleted_at: null,
          cliente: 'Mesa 3',
          created_at: '2026-09-12T09:00:00.000Z',
        },
        { numeroMesa: 3, abiertaEn }
      )
    ).toBe(false);
  });
});

describe('aplicarFiltrosQueryMesaFolio', () => {
  function crearQueryMock() {
    const llamadas = [];
    const query = {
      llamadas,
      eq(campo, valor) {
        llamadas.push(['eq', campo, valor]);
        return query;
      },
      is(campo, valor) {
        llamadas.push(['is', campo, valor]);
        return query;
      },
      gte(campo, valor) {
        llamadas.push(['gte', campo, valor]);
        return query;
      },
      or(expresion) {
        llamadas.push(['or', expresion]);
        return query;
      },
    };
    return query;
  }

  test('aplica tipo, cliente, deleted_at y created_at', () => {
    const query = crearQueryMock();
    aplicarFiltrosQueryMesaFolio(query, {
      numeroMesa: 5,
      abiertaEn: '2026-09-12T10:00:00.000Z',
    });

    expect(query.llamadas).toEqual([
      ['eq', 'tipo', 'mesa'],
      ['eq', 'cliente', 'Mesa 5'],
      ['is', 'deleted_at', null],
      ['gte', 'created_at', '2026-09-12T10:00:00.000Z'],
    ]);
  });

  test('incluye filtro de jornada cuando hay jornadaId', () => {
    const query = crearQueryMock();
    aplicarFiltrosQueryMesaFolio(query, {
      numeroMesa: 2,
      abiertaEn: '2026-09-12T10:00:00.000Z',
      jornadaId: 'jornada-abc',
    });

    expect(query.llamadas).toContainEqual([
      'or',
      'jornada_id.eq.jornada-abc,jornada_id.is.null',
    ]);
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
