import {
  aplicarFiltrosQueryDashboardOperativo,
  aplicarFiltrosQueryListaCaja,
  aplicarFiltrosQueryMesaFolio,
  canalModuloHabilitado,
  filtrarPedidosListaCaja,
  modoDashboardDesdeTipoPedido,
  pedidoCanalHabilitado,
  pedidoCoincideFiltroDashboard,
  pedidoCoincideFiltroDashboardOperativo,
  pedidoCoincideFiltroListaCaja,
  pedidoCoincideFiltroMesaFolio,
  pedidoCoincideFiltroMostrador,
} from './pedidosQueryHelpers';
import { obtenerFechaHoyClave } from './pedidosShared';

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

function crearQueryMockPedidos() {
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
    lte(campo, valor) {
      llamadas.push(['lte', campo, valor]);
      return query;
    },
    or(expresion) {
      llamadas.push(['or', expresion]);
      return query;
    },
    limit(cantidad) {
      llamadas.push(['limit', cantidad]);
      return query;
    },
  };
  return query;
}

describe('aplicarFiltrosQueryMesaFolio', () => {
  function crearQueryMock() {
    return crearQueryMockPedidos();
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
  const jornada = { id: 'jornada-1', abierta_en: '2026-09-12T08:00:00.000Z' };

  test('incluye pendientes de mostrador sin importar jornada', () => {
    expect(
      pedidoCoincideFiltroMostrador(
        {
          tipo: 'mostrador',
          deleted_at: null,
          status: 'listo-para-recoger',
          jornada_id: 'jornada-vieja',
        },
        { jornada }
      )
    ).toBe(true);

    expect(
      pedidoCoincideFiltroMostrador(
        {
          tipo: 'mostrador',
          deleted_at: null,
          status: 'en-cocina',
        },
        { jornada: null }
      )
    ).toBe(true);
  });

  test('incluye entregados de la jornada abierta', () => {
    expect(
      pedidoCoincideFiltroMostrador(
        {
          tipo: 'mostrador',
          deleted_at: null,
          status: 'entregado',
          jornada_id: 'jornada-1',
          created_at: '2026-09-12T10:00:00.000Z',
          mostrador_entregado_at: '2026-09-12T18:30:00.000Z',
        },
        { jornada }
      )
    ).toBe(true);
  });

  test('excluye entregados de jornada anterior aunque se marcaron hoy', () => {
    expect(
      pedidoCoincideFiltroMostrador(
        {
          tipo: 'mostrador',
          deleted_at: null,
          status: 'entregado',
          jornada_id: 'jornada-vieja',
          mostrador_entregado_at: '2026-09-12T07:07:00.000Z',
        },
        { jornada }
      )
    ).toBe(false);
  });

  test('sin jornada abierta no muestra entregados', () => {
    expect(
      pedidoCoincideFiltroMostrador(
        {
          tipo: 'mostrador',
          deleted_at: null,
          status: 'entregado',
          jornada_id: 'jornada-1',
        },
        { jornada: null }
      )
    ).toBe(false);
  });
});

describe('aplicarFiltrosQuery sin jornada abierta', () => {
  const hoyClave = '2026-09-12';

  function valoresEqId(query) {
    return query.llamadas
      .filter(([op, campo]) => op === 'eq' && campo === 'id')
      .map(([, , valor]) => valor);
  }

  test('dashboard operativo (hoy, sin jornada) usa limit(0) y no filtra id con UUID', () => {
    const query = crearQueryMockPedidos();
    aplicarFiltrosQueryDashboardOperativo(query, {
      jornadaId: null,
      filtroFechaClave: hoyClave,
      hoyClave,
    });

    expect(query.llamadas).toContainEqual(['limit', 0]);
    expect(valoresEqId(query)).toEqual([]);
  });

  test('lista caja (hoy, sin jornada) usa limit(0) y no filtra id con UUID', () => {
    const query = crearQueryMockPedidos();
    aplicarFiltrosQueryListaCaja(query, {
      jornadaId: null,
      filtroFechaClave: hoyClave,
      hoyClave,
    });

    expect(query.llamadas).toContainEqual(['limit', 0]);
    expect(valoresEqId(query)).toEqual([]);
  });
});

describe('pedidoCoincideFiltroListaCaja', () => {
  const hoyClave = '2026-09-12';
  const jornada = { id: 'jornada-nueva', abierta_en: '2026-09-12T08:00:00.000Z' };

  test('con jornada abierta incluye ventas de esa jornada', () => {
    expect(
      pedidoCoincideFiltroListaCaja(
        {
          tipo: 'presencial',
          deleted_at: null,
          jornada_id: 'jornada-nueva',
          created_at: '2026-09-12T10:00:00.000Z',
        },
        { filtroFechaClave: hoyClave, hoyClave, jornada }
      )
    ).toBe(true);
  });

  test('excluye venta de jornada anterior creada hoy', () => {
    expect(
      pedidoCoincideFiltroListaCaja(
        {
          tipo: 'presencial',
          deleted_at: null,
          jornada_id: 'jornada-vieja',
          created_at: '2026-09-12T06:30:00.000Z',
        },
        { filtroFechaClave: hoyClave, hoyClave, jornada }
      )
    ).toBe(false);
  });

  test('legacy sin jornada_id respeta abierta_en', () => {
    expect(
      pedidoCoincideFiltroListaCaja(
        {
          tipo: 'presencial',
          deleted_at: null,
          jornada_id: null,
          created_at: '2026-09-12T07:00:00.000Z',
        },
        { filtroFechaClave: hoyClave, hoyClave, jornada }
      )
    ).toBe(false);

    expect(
      pedidoCoincideFiltroListaCaja(
        {
          tipo: 'presencial',
          deleted_at: null,
          jornada_id: 'jornada-nueva',
          created_at: '2026-09-12T09:00:00.000Z',
        },
        { filtroFechaClave: hoyClave, hoyClave, jornada }
      )
    ).toBe(true);
  });

  test('sin jornada abierta deja la lista de hoy vacía', () => {
    expect(
      filtrarPedidosListaCaja(
        [
          {
            tipo: 'presencial',
            deleted_at: null,
            created_at: '2026-09-12T12:00:00.000Z',
          },
        ],
        { filtroFechaClave: hoyClave, hoyClave, jornada: null }
      )
    ).toEqual([]);
  });

  test('otra fecha usa calendario', () => {
    expect(
      pedidoCoincideFiltroListaCaja(
        {
          tipo: 'presencial',
          deleted_at: null,
          jornada_id: 'jornada-vieja',
          created_at: '2026-09-11T15:00:00.000Z',
        },
        { filtroFechaClave: '2026-09-11', hoyClave, jornada }
      )
    ).toBe(true);
  });
});

describe('paridad filtro dashboard legacy vs operativo (whatsapp)', () => {
  /**
   * Para tipo whatsapp (y null/''), legacy y operativo solo pasan por
   * pedidoPerteneceJornada: no aplica la rama calendario presencial del legacy
   * ni pedidoCoincideFiltroListaCaja del operativo. Se espera paridad total.
   *
   * Diferencia intencional (fuera de este describe): presencial con filtro=hoy
   * puede incluir legacy por calendario y excluir operativo por jornada.
   */
  const jornadaId = 'jornada-abierta';
  const hoyClave = obtenerFechaHoyClave();
  const [anio, mes, dia] = hoyClave.split('-').map(Number);
  const abiertaEn = new Date(anio, mes - 1, dia, 8, 0, 0, 0).toISOString();
  const creadoDespuesAbierta = new Date(anio, mes - 1, dia, 10, 0, 0, 0).toISOString();
  const creadoAntesAbierta = new Date(anio, mes - 1, dia, 6, 0, 0, 0).toISOString();

  function expectParidadWhatsapp(pedido, { jornadaId: jid = jornadaId, jornadaAbiertaEn = abiertaEn } = {}) {
    const opcionesLegacy = {
      jornadaId: jid,
      jornadaAbiertaEn,
      filtroFechaClave: hoyClave,
    };
    const opcionesOperativo = {
      ...opcionesLegacy,
      hoyClave,
    };

    const legacy = pedidoCoincideFiltroDashboard(pedido, opcionesLegacy);
    const operativo = pedidoCoincideFiltroDashboardOperativo(pedido, opcionesOperativo);

    expect(operativo).toBe(legacy);
    return legacy;
  }

  test('jornada_id igual a la jornada abierta: legacy y operativo incluyen', () => {
    expect(
      expectParidadWhatsapp({
        tipo: 'whatsapp',
        deleted_at: null,
        jornada_id: jornadaId,
        created_at: creadoDespuesAbierta,
      })
    ).toBe(true);
  });

  test('jornada_id de otra jornada: legacy y operativo excluyen', () => {
    expect(
      expectParidadWhatsapp({
        tipo: 'whatsapp',
        deleted_at: null,
        jornada_id: 'jornada-cerrada',
        created_at: creadoDespuesAbierta,
      })
    ).toBe(false);
  });

  test('jornada_id null legacy creado hoy después de abierta_en: ambos incluyen', () => {
    expect(
      expectParidadWhatsapp({
        tipo: null,
        deleted_at: null,
        jornada_id: null,
        created_at: creadoDespuesAbierta,
      })
    ).toBe(true);
  });

  test('jornada_id null legacy creado hoy antes de abierta_en: ambos excluyen', () => {
    expect(
      expectParidadWhatsapp({
        tipo: 'whatsapp',
        deleted_at: null,
        jornada_id: null,
        created_at: creadoAntesAbierta,
      })
    ).toBe(false);
  });

  test('sin jornada abierta (jornadaId null): ambos excluyen whatsapp', () => {
    expect(
      expectParidadWhatsapp(
        {
          tipo: 'whatsapp',
          deleted_at: null,
          jornada_id: jornadaId,
          created_at: creadoDespuesAbierta,
        },
        { jornadaId: null, jornadaAbiertaEn: null }
      )
    ).toBe(false);
  });

  test('diferencia intencional documentada: presencial hoy puede divergir', () => {
    const pedidoPresencialJornadaVieja = {
      tipo: 'presencial',
      deleted_at: null,
      jornada_id: 'jornada-cerrada',
      created_at: creadoDespuesAbierta,
    };
    const opcionesLegacy = {
      jornadaId,
      jornadaAbiertaEn: abiertaEn,
      filtroFechaClave: hoyClave,
    };
    const opcionesOperativo = { ...opcionesLegacy, hoyClave };

    expect(pedidoCoincideFiltroDashboard(pedidoPresencialJornadaVieja, opcionesLegacy)).toBe(
      true
    );
    expect(
      pedidoCoincideFiltroDashboardOperativo(pedidoPresencialJornadaVieja, opcionesOperativo)
    ).toBe(false);
  });
});

describe('pedidoCoincideFiltroDashboardOperativo', () => {
  const hoyClave = '2026-09-12';

  test('incluye whatsapp de la jornada activa', () => {
    expect(
      pedidoCoincideFiltroDashboardOperativo(
        {
          tipo: 'whatsapp',
          deleted_at: null,
          jornada_id: 'jornada-1',
          created_at: '2026-09-12T10:00:00.000Z',
        },
        {
          jornadaId: 'jornada-1',
          jornadaAbiertaEn: '2026-09-12T08:00:00.000Z',
          filtroFechaClave: hoyClave,
          hoyClave,
        }
      )
    ).toBe(true);
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
