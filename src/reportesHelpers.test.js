jest.mock('jspdf', () => ({
  jsPDF: jest.fn(),
}));

jest.mock('jspdf-autotable', () => jest.fn());

import autoTable from 'jspdf-autotable';
import { jsPDF } from 'jspdf';

jest.mock('./jornadaHelpers', () => ({
  ...jest.requireActual('./jornadaHelpers'),
  cargarJornadaAbierta: jest.fn(),
}));

jest.mock('./tenantHelpers', () => ({
  queryConNegocio: jest.fn((query) => query),
}));

import { cargarJornadaAbierta, JORNADA_ESTADO_CERRADA } from './jornadaHelpers';
import { queryConNegocio } from './tenantHelpers';
import { TIPOS_ENTREGA } from './pedidosShared';
import {
  agruparEntregasPorRepartidor,
  CLAVE_REPARTIDOR_EXTERNO,
  CLAVE_REPARTIDOR_SIN_ASIGNAR,
  deriveModoFiltroEntregas,
  entregasReportePeriodoActivo,
  enriquecerEntregasPorJornada,
  enriquecerEntregasPorJornadaConCobros,
  construirFilasEntregasPorJornadaPdf,
  sufijoRepartidorInlineEntregasJornada,
  sufijoFormaPagoInlineEntregasJornada,
  etiquetaPedidosEntregasJornadaPdf,
  exportarEntregasPdf,
  ESTADOS_VISTA_ENTREGAS_REPORTE,
  filtrarPedidosEntregadosPorRepartidor,
  filtrarPedidosEntregadosReporte,
  formatearEncabezadoGrupoJornada,
  formatearEtiquetaJornadaFocoReporte,
  jornadaEstaCerrada,
  ORIGEN_JORNADA_FOCO_ABIERTA,
  ORIGEN_JORNADA_FOCO_ULTIMA_CERRADA,
  pedidoEntregadoEnVentanaReporte,
  resolverEstadoVistaEntregasReporte,
  resolverJornadaActualParaReporte,
} from './reportesHelpers';

const pedidoDomicilioEntregado = {
  id: 'p1',
  tipo: 'whatsapp',
  tipo_entrega: TIPOS_ENTREGA.DOMICILIO,
  status: 'entregado',
  entregado_en: '2026-09-01T18:00:00.000Z',
  repartidor_usuario_id: 'rep-1',
  repartidor_externo: false,
  total: 150,
  jornada_id: 'jornada-1',
};

describe('filtrarPedidosEntregadosReporte', () => {
  const configDia = {
    periodo: 'semana',
    fechaDesde: '2026-09-01',
    fechaHasta: '2026-09-01',
  };

  test('filtra por entregado_en en rango y excluye no-domicilio y no-entregados', () => {
    const pedidos = [
      pedidoDomicilioEntregado,
      {
        ...pedidoDomicilioEntregado,
        id: 'p2',
        tipo_entrega: TIPOS_ENTREGA.SUCURSAL,
        entregado_en: '2026-09-01T19:00:00.000Z',
      },
      {
        ...pedidoDomicilioEntregado,
        id: 'p3',
        status: 'enviado',
        entregado_en: '2026-09-01T20:00:00.000Z',
      },
      {
        ...pedidoDomicilioEntregado,
        id: 'p4',
        entregado_en: '2026-08-30T18:00:00.000Z',
      },
    ];

    const filtrados = filtrarPedidosEntregadosReporte(pedidos, configDia);

    expect(filtrados.map((pedido) => pedido.id)).toEqual(['p1']);
  });

  test('filtra por jornada usando la semántica de entregado_en en ventana de jornada', () => {
    const jornadasPorId = {
      'jornada-1': {
        id: 'jornada-1',
        abierta_en: '2026-09-01T08:00:00.000Z',
        cerrada_en: '2026-09-01T23:59:59.000Z',
      },
    };

    const pedidos = [
      pedidoDomicilioEntregado,
      {
        ...pedidoDomicilioEntregado,
        id: 'p5',
        entregado_en: '2026-09-02T10:00:00.000Z',
      },
    ];

    const filtrados = filtrarPedidosEntregadosReporte(
      pedidos,
      configDia,
      'jornada-1',
      jornadasPorId
    );

    expect(filtrados.map((pedido) => pedido.id)).toEqual(['p1']);
  });
});

describe('deriveModoFiltroEntregas', () => {
  test('prioriza jornada sobre rango personalizado', () => {
    expect(
      deriveModoFiltroEntregas({
        jornadaFocoId: 'jornada-1',
        usaRangoPersonalizado: true,
      })
    ).toBe('jornada');
  });

  test('devuelve rango, jornada o null según el filtro activo', () => {
    expect(
      deriveModoFiltroEntregas({
        jornadaFocoId: null,
        usaRangoPersonalizado: true,
      })
    ).toBe('rango');

    expect(
      deriveModoFiltroEntregas({
        jornadaFocoId: 'jornada-1',
        usaRangoPersonalizado: false,
      })
    ).toBe('jornada');

    expect(
      deriveModoFiltroEntregas({
        jornadaFocoId: null,
        usaRangoPersonalizado: false,
      })
    ).toBeNull();
  });
});

describe('entregasReportePeriodoActivo', () => {
  test('solo considera activo jornada enfocada o rango personalizado completo', () => {
    expect(
      entregasReportePeriodoActivo({
        jornadaFocoId: 'jornada-1',
        usaRangoPersonalizado: false,
      })
    ).toBe(true);

    expect(
      entregasReportePeriodoActivo({
        jornadaFocoId: null,
        usaRangoPersonalizado: true,
      })
    ).toBe(true);

    expect(
      entregasReportePeriodoActivo({
        jornadaFocoId: null,
        usaRangoPersonalizado: false,
      })
    ).toBe(false);
  });
});

describe('resolverEstadoVistaEntregasReporte', () => {
  test('devuelve un único estado prioritario según el contexto', () => {
    expect(
      resolverEstadoVistaEntregasReporte({
        entregasPeriodoActivo: false,
        rangoInvalido: true,
        cargandoEntregas: true,
        errorEntregas: 'fallo',
        cantidadPedidosVisibles: 5,
      })
    ).toBe(ESTADOS_VISTA_ENTREGAS_REPORTE.PENDIENTE_MODO);

    expect(
      resolverEstadoVistaEntregasReporte({
        entregasPeriodoActivo: true,
        rangoInvalido: true,
        cargandoEntregas: true,
      })
    ).toBe(ESTADOS_VISTA_ENTREGAS_REPORTE.RANGO_INVALIDO);

    expect(
      resolverEstadoVistaEntregasReporte({
        entregasPeriodoActivo: true,
        cargandoEntregas: true,
      })
    ).toBe(ESTADOS_VISTA_ENTREGAS_REPORTE.CARGANDO);

    expect(
      resolverEstadoVistaEntregasReporte({
        entregasPeriodoActivo: true,
        errorEntregas: 'No se pudieron cargar las entregas.',
      })
    ).toBe(ESTADOS_VISTA_ENTREGAS_REPORTE.ERROR);

    expect(
      resolverEstadoVistaEntregasReporte({
        entregasPeriodoActivo: true,
        cantidadPedidosVisibles: 0,
      })
    ).toBe(ESTADOS_VISTA_ENTREGAS_REPORTE.SIN_RESULTADOS);

    expect(
      resolverEstadoVistaEntregasReporte({
        entregasPeriodoActivo: true,
        cantidadPedidosVisibles: 2,
      })
    ).toBe(ESTADOS_VISTA_ENTREGAS_REPORTE.DATOS);
  });
});

describe('pedidoEntregadoEnVentanaReporte', () => {
  test('usa updated_at cuando entregado_en es null (repartidor externo vía Recoger/Domicilio)', () => {
    const inicio = new Date('2026-09-01T08:00:00.000Z');
    const fin = new Date('2026-09-01T23:59:59.000Z');
    const pedido = {
      ...pedidoDomicilioEntregado,
      id: 'p-ext',
      repartidor_externo: true,
      repartidor_usuario_id: null,
      entregado_en: null,
      updated_at: '2026-09-01T18:30:00.000Z',
    };

    expect(pedidoEntregadoEnVentanaReporte(pedido, inicio, fin)).toBe(true);
  });
});

describe('filtrarPedidosEntregadosReporte con repartidor externo sin entregado_en', () => {
  test('incluye pedido externo entregado cuando updated_at cae en el rango personalizado', () => {
    const pedidos = [
      {
        ...pedidoDomicilioEntregado,
        id: 'p-ext',
        repartidor_externo: true,
        repartidor_usuario_id: null,
        entregado_en: null,
        updated_at: '2026-09-01T18:30:00.000Z',
      },
    ];

    const filtrados = filtrarPedidosEntregadosReporte(pedidos, {
      periodo: 'semana',
      fechaDesde: '2026-09-01',
      fechaHasta: '2026-09-01',
    });

    expect(filtrados.map((pedido) => pedido.id)).toEqual(['p-ext']);
  });
});

describe('filtrarPedidosEntregadosPorRepartidor', () => {
  test('devuelve todos los pedidos cuando no hay filtro de repartidor', () => {
    const pedidos = [
      pedidoDomicilioEntregado,
      {
        ...pedidoDomicilioEntregado,
        id: 'p2',
        repartidor_usuario_id: 'rep-2',
      },
    ];

    expect(filtrarPedidosEntregadosPorRepartidor(pedidos, '')).toHaveLength(2);
    expect(filtrarPedidosEntregadosPorRepartidor(pedidos)).toHaveLength(2);
  });

  test('filtra por repartidor específico', () => {
    const pedidos = [
      pedidoDomicilioEntregado,
      {
        ...pedidoDomicilioEntregado,
        id: 'p2',
        repartidor_usuario_id: 'rep-2',
      },
    ];

    const filtrados = filtrarPedidosEntregadosPorRepartidor(pedidos, 'rep-1');

    expect(filtrados.map((pedido) => pedido.id)).toEqual(['p1']);
  });

  test('filtra por repartidor externo usando CLAVE_REPARTIDOR_EXTERNO', () => {
    const pedidos = [
      pedidoDomicilioEntregado,
      {
        ...pedidoDomicilioEntregado,
        id: 'p-ext',
        repartidor_usuario_id: null,
        repartidor_externo: true,
      },
    ];

    const filtrados = filtrarPedidosEntregadosPorRepartidor(pedidos, CLAVE_REPARTIDOR_EXTERNO);

    expect(filtrados.map((pedido) => pedido.id)).toEqual(['p-ext']);
  });

  test('filtra por pedidos sin asignar usando CLAVE_REPARTIDOR_SIN_ASIGNAR', () => {
    const pedidos = [
      pedidoDomicilioEntregado,
      {
        ...pedidoDomicilioEntregado,
        id: 'p-sin',
        repartidor_usuario_id: null,
        repartidor_externo: false,
      },
    ];

    const filtrados = filtrarPedidosEntregadosPorRepartidor(
      pedidos,
      CLAVE_REPARTIDOR_SIN_ASIGNAR
    );

    expect(filtrados.map((pedido) => pedido.id)).toEqual(['p-sin']);
  });
});

describe('agruparEntregasPorRepartidor', () => {
  test('agrupa por repartidor y maneja Sin asignar', () => {
    const pedidos = [
      pedidoDomicilioEntregado,
      {
        ...pedidoDomicilioEntregado,
        id: 'p2',
        repartidor_usuario_id: 'rep-2',
        total: 200,
      },
      {
        ...pedidoDomicilioEntregado,
        id: 'p3',
        repartidor_usuario_id: null,
        total: 50,
      },
    ];

    const repartidoresPorId = {
      'rep-1': { id: 'rep-1', nombre: 'Ana' },
      'rep-2': { id: 'rep-2', nombre: 'Luis' },
    };

    const grupos = agruparEntregasPorRepartidor(pedidos, repartidoresPorId);

    expect(grupos).toHaveLength(3);
    expect(grupos.find((grupo) => grupo.claveRepartidor === 'rep-1')).toMatchObject({
      etiqueta: 'Ana',
      resumen: { totalPedidos: 1, montoAcumulado: 150 },
    });
    expect(grupos.find((grupo) => grupo.claveRepartidor === 'rep-2')).toMatchObject({
      etiqueta: 'Luis',
      resumen: { totalPedidos: 1, montoAcumulado: 200 },
    });
    expect(
      grupos.find((grupo) => grupo.claveRepartidor === CLAVE_REPARTIDOR_SIN_ASIGNAR)
    ).toMatchObject({
      etiqueta: 'Sin asignar',
      resumen: { totalPedidos: 1, montoAcumulado: 50 },
    });
  });
});

describe('etiquetas de jornada para reporte de entregas', () => {
  const jornadaAbierta = {
    id: 'j-abierta',
    estado: 'abierta',
    abierta_en: '2026-09-01T08:00:00.000Z',
  };

  const jornadaCerrada = {
    id: 'j-cerrada',
    estado: JORNADA_ESTADO_CERRADA,
    abierta_en: '2026-08-31T08:00:00.000Z',
    cerrada_en: '2026-08-31T23:00:00.000Z',
  };

  const jornadaCerradaSinTimestamp = {
    id: 'j-cerrada-sin-ts',
    estado: JORNADA_ESTADO_CERRADA,
    abierta_en: '2026-08-30T08:00:00.000Z',
  };

  test('formatearEtiquetaJornadaFocoReporte distingue jornada abierta vs fallback cerrada', () => {
    expect(formatearEtiquetaJornadaFocoReporte(jornadaAbierta, ORIGEN_JORNADA_FOCO_ABIERTA)).toMatch(
      /^Jornada en curso: .+ — Abierta$/
    );
    expect(
      formatearEtiquetaJornadaFocoReporte(jornadaCerrada, ORIGEN_JORNADA_FOCO_ULTIMA_CERRADA)
    ).toMatch(/^Última jornada cerrada: .+ — .+$/);
  });

  test('jornadaEstaCerrada usa estado aunque cerrada_en falte', () => {
    expect(jornadaEstaCerrada(jornadaCerradaSinTimestamp)).toBe(true);
    expect(formatearEncabezadoGrupoJornada(jornadaCerradaSinTimestamp)).toMatch(/ — Cerrada$/);
    expect(formatearEtiquetaJornadaFocoReporte(jornadaCerradaSinTimestamp, null)).toMatch(
      /^Última jornada cerrada: .+ — Cerrada$/
    );
  });
});

describe('resolverJornadaActualParaReporte', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve jornada abierta si existe', async () => {
    const jornadaAbierta = {
      id: 'j-abierta',
      estado: 'abierta',
      abierta_en: '2026-09-01T08:00:00.000Z',
    };

    cargarJornadaAbierta.mockResolvedValueOnce({
      data: jornadaAbierta,
      error: null,
    });

    const supabase = {};
    const resultado = await resolverJornadaActualParaReporte(supabase, 'negocio-1');

    expect(resultado).toEqual({
      jornada: jornadaAbierta,
      origen: ORIGEN_JORNADA_FOCO_ABIERTA,
      error: null,
    });
    expect(queryConNegocio).not.toHaveBeenCalled();
  });

  test('devuelve la última jornada cerrada si no hay jornada abierta', async () => {
    cargarJornadaAbierta.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const jornadaCerrada = {
      id: 'j-cerrada',
      estado: 'cerrada',
      abierta_en: '2026-08-31T08:00:00.000Z',
      cerrada_en: '2026-08-31T23:00:00.000Z',
    };

    const maybeSingle = jest.fn().mockResolvedValue({ data: jornadaCerrada, error: null });
    const limit = jest.fn(() => ({ maybeSingle }));
    const order = jest.fn(() => ({ limit }));
    const select = jest.fn(() => ({ order }));
    const from = jest.fn(() => ({ select }));

    queryConNegocio.mockImplementationOnce((query) => query);

    const supabase = { from };

    const resultado = await resolverJornadaActualParaReporte(supabase, 'negocio-1');

    expect(from).toHaveBeenCalledWith('jornadas');
    expect(resultado).toEqual({
      jornada: jornadaCerrada,
      origen: ORIGEN_JORNADA_FOCO_ULTIMA_CERRADA,
      error: null,
    });
  });
});

describe('enriquecerEntregasPorJornada', () => {
  const repartidoresPorId = {
    'rep-1': { id: 'rep-1', nombre: 'Repartidor1' },
    'rep-2': { id: 'rep-2', nombre: 'Repartidor2' },
  };

  test('agrega cobrosPorFormaPago con una sola forma de pago en jornada', () => {
    const grupos = [
      {
        clave: 'jornada:j1',
        esGrupoJornada: true,
        pedidos: [{ forma_pago: 'efectivo', total: 125 }],
        totalDelDia: 125,
      },
    ];

    const enriquecidos = enriquecerEntregasPorJornada(grupos, repartidoresPorId);

    expect(enriquecidos[0].cobrosPorFormaPago).toEqual([
      { forma: 'efectivo', etiqueta: 'Efectivo', total: 125, cantidad: 1 },
    ]);
    expect(enriquecidos[0].entregasPorRepartidor).toEqual([
      expect.objectContaining({
        claveRepartidor: CLAVE_REPARTIDOR_SIN_ASIGNAR,
        etiqueta: 'Sin asignar',
        resumen: { totalPedidos: 1, montoAcumulado: 125 },
      }),
    ]);
  });

  test('agrega entregasPorRepartidor con un solo repartidor en jornada', () => {
    const grupos = [
      {
        clave: 'jornada:j1',
        esGrupoJornada: true,
        pedidos: [
          {
            ...pedidoDomicilioEntregado,
            repartidor_usuario_id: 'rep-1',
            total: 130,
          },
        ],
        totalDelDia: 130,
      },
    ];

    const enriquecidos = enriquecerEntregasPorJornada(grupos, repartidoresPorId);

    expect(enriquecidos[0].entregasPorRepartidor).toEqual([
      expect.objectContaining({
        claveRepartidor: 'rep-1',
        etiqueta: 'Repartidor1',
        resumen: { totalPedidos: 1, montoAcumulado: 130 },
      }),
    ]);
  });

  test('agrega entregasPorRepartidor con múltiples repartidores incluyendo externo y sin asignar', () => {
    const grupos = [
      {
        clave: 'jornada:j1',
        esGrupoJornada: true,
        pedidos: [
          {
            ...pedidoDomicilioEntregado,
            id: 'p1',
            repartidor_usuario_id: 'rep-1',
            total: 100,
          },
          {
            ...pedidoDomicilioEntregado,
            id: 'p2',
            repartidor_usuario_id: 'rep-2',
            total: 80,
          },
          {
            ...pedidoDomicilioEntregado,
            id: 'p3',
            repartidor_externo: true,
            repartidor_usuario_id: null,
            total: 50,
          },
          {
            ...pedidoDomicilioEntregado,
            id: 'p4',
            repartidor_usuario_id: null,
            repartidor_externo: false,
            total: 20,
          },
        ],
        totalDelDia: 250,
      },
    ];

    const enriquecidos = enriquecerEntregasPorJornada(grupos, repartidoresPorId);

    expect(enriquecidos[0].entregasPorRepartidor).toHaveLength(4);
    expect(enriquecidos[0].entregasPorRepartidor).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ claveRepartidor: 'rep-1', etiqueta: 'Repartidor1' }),
        expect.objectContaining({ claveRepartidor: 'rep-2', etiqueta: 'Repartidor2' }),
        expect.objectContaining({
          claveRepartidor: CLAVE_REPARTIDOR_EXTERNO,
          etiqueta: 'Repartidor externo',
        }),
        expect.objectContaining({
          claveRepartidor: CLAVE_REPARTIDOR_SIN_ASIGNAR,
          etiqueta: 'Sin asignar',
        }),
      ])
    );
  });

  test('omite entregasPorRepartidor cuando incluirRepartidor es false', () => {
    const grupos = [
      {
        clave: 'jornada:j1',
        pedidos: [
          {
            ...pedidoDomicilioEntregado,
            repartidor_usuario_id: 'rep-1',
            total: 100,
          },
        ],
        totalDelDia: 100,
      },
    ];

    const enriquecidos = enriquecerEntregasPorJornada(grupos, repartidoresPorId, {
      incluirRepartidor: false,
    });

    expect(enriquecidos[0].entregasPorRepartidor).toEqual([]);
    expect(enriquecidos[0].cobrosPorFormaPago).toHaveLength(1);
  });

  test('agrega cobrosPorFormaPago con Efectivo y Tarjeta en la misma jornada', () => {
    const grupos = [
      {
        clave: 'jornada:j1',
        esGrupoJornada: true,
        pedidos: [
          { forma_pago: 'efectivo', total: 200 },
          { forma_pago: 'tarjeta', total: 125 },
        ],
        totalDelDia: 325,
      },
    ];

    const enriquecidos = enriquecerEntregasPorJornada(grupos, repartidoresPorId);

    expect(enriquecidos[0].cobrosPorFormaPago).toHaveLength(2);
    expect(enriquecidos[0].cobrosPorFormaPago).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ forma: 'efectivo', etiqueta: 'Efectivo', total: 200, cantidad: 1 }),
        expect.objectContaining({ forma: 'tarjeta', etiqueta: 'Tarjeta', total: 125, cantidad: 1 }),
      ])
    );
  });

  test('aplica el mismo enriquecimiento a grupos por día sin jornada', () => {
    const grupos = [
      {
        clave: 'dia:2026-09-01',
        esGrupoJornada: false,
        pedidos: [
          { forma_pago: 'efectivo', total: 80 },
          { forma_pago: 'transferencia', total: 45 },
        ],
        totalDelDia: 125,
      },
    ];

    const enriquecidos = enriquecerEntregasPorJornada(grupos, repartidoresPorId);

    expect(enriquecidos[0].cobrosPorFormaPago).toHaveLength(2);
  });
});

describe('enriquecerEntregasPorJornadaConCobros', () => {
  test('mantiene compatibilidad sin incluir repartidor', () => {
    const grupos = [
      {
        clave: 'jornada:j1',
        pedidos: [
          {
            ...pedidoDomicilioEntregado,
            repartidor_usuario_id: 'rep-1',
            forma_pago: 'efectivo',
            total: 100,
          },
        ],
        totalDelDia: 100,
      },
    ];

    const enriquecidos = enriquecerEntregasPorJornadaConCobros(grupos);

    expect(enriquecidos[0].cobrosPorFormaPago).toHaveLength(1);
    expect(enriquecidos[0].entregasPorRepartidor).toEqual([]);
  });
});

describe('sufijoRepartidorInlineEntregasJornada', () => {
  test('devuelve sufijo inline con un solo repartidor', () => {
    expect(
      sufijoRepartidorInlineEntregasJornada([
        {
          claveRepartidor: 'rep-1',
          etiqueta: 'Repartidor1',
          resumen: { totalPedidos: 4, montoAcumulado: 130 },
        },
      ])
    ).toBe(' · Repartidor1');
  });

  test('devuelve vacío con cero o más de un repartidor', () => {
    expect(sufijoRepartidorInlineEntregasJornada([])).toBe('');
    expect(
      sufijoRepartidorInlineEntregasJornada([
        { claveRepartidor: 'rep-1', etiqueta: 'Repartidor1', resumen: { totalPedidos: 2 } },
        { claveRepartidor: 'rep-2', etiqueta: 'Repartidor2', resumen: { totalPedidos: 1 } },
      ])
    ).toBe('');
  });
});

describe('sufijoFormaPagoInlineEntregasJornada', () => {
  test('devuelve sufijo inline con una sola forma de pago', () => {
    expect(
      sufijoFormaPagoInlineEntregasJornada([
        { forma: 'tarjeta', etiqueta: 'Tarjeta', cantidad: 1, total: 125 },
      ])
    ).toBe(' · Tarjeta');
  });

  test('devuelve vacío con cero o más de una forma de pago', () => {
    expect(sufijoFormaPagoInlineEntregasJornada([])).toBe('');
    expect(
      sufijoFormaPagoInlineEntregasJornada([
        { forma: 'efectivo', etiqueta: 'Efectivo', cantidad: 1, total: 100 },
        { forma: 'tarjeta', etiqueta: 'Tarjeta', cantidad: 1, total: 50 },
      ])
    ).toBe('');
  });
});

describe('construirFilasEntregasPorJornadaPdf', () => {
  test('incluye forma de pago inline en la fila principal con una sola forma de pago', () => {
    const filas = construirFilasEntregasPorJornadaPdf([
      {
        etiqueta: 'Jornada: 31 Ago 08:00 — 23:00',
        pedidos: [{ id: 'p1' }],
        totalDelDia: 125,
        cobrosPorFormaPago: [
          { forma: 'tarjeta', etiqueta: 'Tarjeta', cantidad: 1, total: 125 },
        ],
      },
    ]);

    expect(filas).toEqual([['Jornada: 31 Ago 08:00 — 23:00', '1 · Tarjeta', '$125.00']]);
  });

  test('incluye forma de pago inline también en grupos por día sin jornada', () => {
    expect(
      etiquetaPedidosEntregasJornadaPdf({
        pedidos: [{ id: 'p1' }],
        cobrosPorFormaPago: [{ forma: 'efectivo', etiqueta: 'Efectivo', cantidad: 1, total: 80 }],
      })
    ).toBe('1 · Efectivo');
  });

  test('incluye repartidor y forma de pago inline en el orden correcto', () => {
    expect(
      etiquetaPedidosEntregasJornadaPdf({
        pedidos: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }, { id: 'p4' }],
        entregasPorRepartidor: [
          {
            claveRepartidor: 'rep-1',
            etiqueta: 'Repartidor1',
            resumen: { totalPedidos: 4, montoAcumulado: 130 },
          },
        ],
        cobrosPorFormaPago: [{ forma: 'efectivo', etiqueta: 'Efectivo', cantidad: 4, total: 130 }],
      })
    ).toBe('4 · Repartidor1 · Efectivo');
  });

  test('agrega sub-filas de repartidor antes que las de cobros', () => {
    const filas = construirFilasEntregasPorJornadaPdf([
      {
        etiqueta: 'Jornada: 31 Ago 08:00 — 23:00',
        pedidos: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
        totalDelDia: 325,
        entregasPorRepartidor: [
          {
            claveRepartidor: 'rep-1',
            etiqueta: 'Repartidor1',
            resumen: { totalPedidos: 2, montoAcumulado: 200 },
          },
          {
            claveRepartidor: 'rep-2',
            etiqueta: 'Repartidor2',
            resumen: { totalPedidos: 1, montoAcumulado: 125 },
          },
        ],
        cobrosPorFormaPago: [
          { forma: 'efectivo', etiqueta: 'Efectivo', cantidad: 2, total: 200 },
          { forma: 'tarjeta', etiqueta: 'Tarjeta', cantidad: 1, total: 125 },
        ],
      },
    ]);

    expect(filas).toEqual([
      ['Jornada: 31 Ago 08:00 — 23:00', '3', '$325.00'],
      ['  Repartidor1', '2', '$200.00'],
      ['  Repartidor2', '1', '$125.00'],
      ['  Efectivo', '2', '$200.00'],
      ['  Tarjeta', '1', '$125.00'],
    ]);
  });

  test('agrega sub-filas indentadas cuando hay más de una forma de pago', () => {
    const filas = construirFilasEntregasPorJornadaPdf([
      {
        etiqueta: 'Jornada: 31 Ago 08:00 — 23:00',
        pedidos: [{ id: 'p1' }, { id: 'p2' }],
        totalDelDia: 325,
        cobrosPorFormaPago: [
          { forma: 'efectivo', etiqueta: 'Efectivo', cantidad: 1, total: 200 },
          { forma: 'tarjeta', etiqueta: 'Tarjeta', cantidad: 1, total: 125 },
        ],
      },
    ]);

    expect(filas).toEqual([
      ['Jornada: 31 Ago 08:00 — 23:00', '2', '$325.00'],
      ['  Efectivo', '1', '$200.00'],
      ['  Tarjeta', '1', '$125.00'],
    ]);
  });
});

describe('exportarEntregasPdf', () => {
  let mockDoc;

  const resumenEntregas = { totalPedidos: 3, montoAcumulado: 450 };
  const porFormaPago = [
    { forma: 'efectivo', etiqueta: 'Efectivo', cantidad: 2, total: 300 },
    { forma: 'tarjeta', etiqueta: 'Tarjeta', cantidad: 1, total: 150 },
  ];
  const porRepartidor = [
    {
      claveRepartidor: 'rep-1',
      etiqueta: 'Repartidor1',
      resumen: { totalPedidos: 2, montoAcumulado: 300 },
    },
  ];

  beforeEach(() => {
    mockDoc = {
      setFontSize: jest.fn(),
      setTextColor: jest.fn(),
      text: jest.fn(),
      save: jest.fn(),
      lastAutoTable: undefined,
    };
    jsPDF.mockReturnValue(mockDoc);
    autoTable.mockImplementation((doc, options) => {
      doc.lastAutoTable = { finalY: (options.startY || 0) + 20 };
    });
  });

  test('incluye tabla Cobros por forma de pago con todos los repartidores', () => {
    exportarEntregasPdf({
      configPeriodo: { fechaDesde: '2026-09-01', fechaHasta: '2026-09-01' },
      resumen: resumenEntregas,
      porRepartidor,
      porFormaPago,
    });

    const titulos = mockDoc.text.mock.calls.map((call) => call[0]);
    expect(titulos).toContain('Entregas por repartidor');
    expect(titulos).toContain('Cobros por forma de pago');

    const tablaCobros = autoTable.mock.calls.find(
      ([, options]) => options.head?.[0]?.[0] === 'Forma de pago'
    );
    expect(tablaCobros).toBeDefined();
    expect(tablaCobros[1].body).toEqual([
      ['Efectivo', '2', '$300.00'],
      ['Tarjeta', '1', '$150.00'],
    ]);
  });

  test('incluye tabla Cobros por forma de pago con repartidor filtrado', () => {
    exportarEntregasPdf({
      configPeriodo: { fechaDesde: '2026-09-01', fechaHasta: '2026-09-01' },
      resumen: resumenEntregas,
      porRepartidor: [],
      porFormaPago,
      repartidorEtiqueta: 'Repartidor1',
    });

    const titulos = mockDoc.text.mock.calls.map((call) => call[0]);
    expect(titulos).not.toContain('Entregas por repartidor');
    expect(titulos).toContain('Cobros por forma de pago');
    expect(titulos.some((titulo) => titulo.startsWith('Repartidor: Repartidor1'))).toBe(true);

    const tablaRepartidor = autoTable.mock.calls.find(
      ([, options]) => options.head?.[0]?.[0] === 'Repartidor'
    );
    expect(tablaRepartidor).toBeUndefined();

    const tablaCobros = autoTable.mock.calls.find(
      ([, options]) => options.head?.[0]?.[0] === 'Forma de pago'
    );
    expect(tablaCobros).toBeDefined();
    expect(tablaCobros[1].body).toEqual([
      ['Efectivo', '2', '$300.00'],
      ['Tarjeta', '1', '$150.00'],
    ]);
  });

  test('incluye sub-filas en Entregas por jornada cuando hay múltiples formas de pago', () => {
    exportarEntregasPdf({
      configPeriodo: { fechaDesde: '2026-09-01', fechaHasta: '2026-09-03' },
      resumen: resumenEntregas,
      porFormaPago,
      porJornada: [
        {
          etiqueta: 'Jornada: 31 Ago 08:00 — 23:00',
          pedidos: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
          totalDelDia: 325,
          entregasPorRepartidor: [
            {
              claveRepartidor: 'rep-1',
              etiqueta: 'Repartidor1',
              resumen: { totalPedidos: 2, montoAcumulado: 200 },
            },
            {
              claveRepartidor: 'rep-2',
              etiqueta: 'Repartidor2',
              resumen: { totalPedidos: 1, montoAcumulado: 125 },
            },
          ],
          cobrosPorFormaPago: [
            { forma: 'efectivo', etiqueta: 'Efectivo', cantidad: 1, total: 200 },
            { forma: 'tarjeta', etiqueta: 'Tarjeta', cantidad: 1, total: 125 },
          ],
        },
        {
          etiqueta: 'Jornada: 1 Sep 08:00 — 23:00',
          pedidos: [{ id: 'p4' }],
          totalDelDia: 125,
          entregasPorRepartidor: [
            {
              claveRepartidor: 'rep-1',
              etiqueta: 'Repartidor1',
              resumen: { totalPedidos: 1, montoAcumulado: 125 },
            },
          ],
          cobrosPorFormaPago: [
            { forma: 'tarjeta', etiqueta: 'Tarjeta', cantidad: 1, total: 125 },
          ],
        },
      ],
    });

    const tablaJornadas = autoTable.mock.calls.find(
      ([, options]) => options.head?.[0]?.[0] === 'Jornada'
    );
    expect(tablaJornadas).toBeDefined();
    expect(tablaJornadas[1].body).toEqual([
      ['Jornada: 31 Ago 08:00 — 23:00', '3', '$325.00'],
      ['  Repartidor1', '2', '$200.00'],
      ['  Repartidor2', '1', '$125.00'],
      ['  Efectivo', '1', '$200.00'],
      ['  Tarjeta', '1', '$125.00'],
      ['Jornada: 1 Sep 08:00 — 23:00', '1 · Repartidor1 · Tarjeta', '$125.00'],
    ]);

    const tablaCobros = autoTable.mock.calls.find(
      ([, options]) => options.head?.[0]?.[0] === 'Forma de pago'
    );
    expect(tablaCobros).toBeDefined();
    expect(tablaCobros[1].body).toEqual([
      ['Efectivo', '2', '$300.00'],
      ['Tarjeta', '1', '$150.00'],
    ]);
  });
});
