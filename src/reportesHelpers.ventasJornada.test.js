jest.mock('jspdf', () => ({
  jsPDF: jest.fn(),
}));

jest.mock('jspdf-autotable', () => jest.fn());

/* eslint-disable import/first -- jest.mock debe ir antes del import de reportesHelpers (jspdf) */
import autoTable from 'jspdf-autotable';
import { jsPDF } from 'jspdf';
import {
  consultarPedidosReporteVentanaJornada,
  exportarReportePdf,
  filtrarPedidosReporteVentasJornada,
  TAMANO_PAGINA_PEDIDOS_REPORTE,
} from './reportesHelpers';

describe('filtrarPedidosReporteVentasJornada', () => {
  test('conserva pedido aunque created_at quede fuera del periodo local si ya vino en la lista jornada', () => {
    const pedidos = [
      {
        id: 'jornada-1',
        tipo: 'presencial',
        created_at: '2020-01-01T12:00:00.000Z',
        total: 100,
      },
      {
        id: 'otro-canal',
        tipo: 'mostrador',
        created_at: '2026-11-03T18:00:00.000Z',
        total: 50,
      },
    ];

    expect(filtrarPedidosReporteVentasJornada(pedidos, 'caja')).toEqual([pedidos[0]]);
  });
});

describe('consultarPedidosReporteVentanaJornada', () => {
  const negocioId = 'negocio-1';
  const fechaDesde = '2026-11-01';
  const fechaHasta = '2026-11-03';

  function crearSupabaseMock(secuenciaLotes) {
    let llamada = 0;
    const range = jest.fn(() => {
      const lote = secuenciaLotes[llamada] ?? { data: [], error: null };
      llamada += 1;
      return Promise.resolve(lote);
    });
    const rpc = jest.fn(() => ({ range }));
    return { rpc, range };
  }

  test('devuelve arreglo vacío sin negocio o fechas', async () => {
    const supabase = { rpc: jest.fn() };

    await expect(
      consultarPedidosReporteVentanaJornada({ supabase, negocioId: null, fechaDesde, fechaHasta })
    ).resolves.toEqual({ data: [], error: null });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  test('0 filas: una llamada y termina', async () => {
    const supabase = crearSupabaseMock([{ data: [], error: null }]);

    const resultado = await consultarPedidosReporteVentanaJornada({
      supabase,
      negocioId,
      fechaDesde,
      fechaHasta,
    });

    expect(resultado).toEqual({ data: [], error: null });
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith('listar_pedidos_reporte_ventas_jornada', {
      p_negocio_id: negocioId,
      p_fecha_desde: fechaDesde,
      p_fecha_hasta: fechaHasta,
    });
    expect(supabase.range).toHaveBeenCalledWith(0, TAMANO_PAGINA_PEDIDOS_REPORTE - 1);
  });

  test('1 página completa menor a 1000', async () => {
    const pedidos = [{ id: 'a' }, { id: 'b' }];
    const supabase = crearSupabaseMock([{ data: pedidos, error: null }]);

    const resultado = await consultarPedidosReporteVentanaJornada({
      supabase,
      negocioId,
      fechaDesde,
      fechaHasta,
    });

    expect(resultado.data).toEqual(pedidos);
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });

  test('2 páginas: 1000 filas y resto', async () => {
    const pagina1 = Array.from({ length: TAMANO_PAGINA_PEDIDOS_REPORTE }, (_, i) => ({ id: `p-${i}` }));
    const pagina2 = [{ id: 'ultimo' }];
    const supabase = crearSupabaseMock([
      { data: pagina1, error: null },
      { data: pagina2, error: null },
    ]);

    const resultado = await consultarPedidosReporteVentanaJornada({
      supabase,
      negocioId,
      fechaDesde,
      fechaHasta,
    });

    expect(resultado.data).toHaveLength(TAMANO_PAGINA_PEDIDOS_REPORTE + 1);
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
    expect(supabase.range).toHaveBeenNthCalledWith(1, 0, TAMANO_PAGINA_PEDIDOS_REPORTE - 1);
    expect(supabase.range).toHaveBeenNthCalledWith(
      2,
      TAMANO_PAGINA_PEDIDOS_REPORTE,
      TAMANO_PAGINA_PEDIDOS_REPORTE + TAMANO_PAGINA_PEDIDOS_REPORTE - 1
    );
  });

  test('propaga error en la segunda página', async () => {
    const pagina1 = Array.from({ length: TAMANO_PAGINA_PEDIDOS_REPORTE }, (_, i) => ({ id: `p-${i}` }));
    const errorSegunda = { message: 'fallo rpc' };
    const supabase = crearSupabaseMock([
      { data: pagina1, error: null },
      { data: null, error: errorSegunda },
    ]);

    const resultado = await consultarPedidosReporteVentanaJornada({
      supabase,
      negocioId,
      fechaDesde,
      fechaHasta,
    });

    expect(resultado).toEqual({ data: [], error: errorSegunda });
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
  });
});

describe('exportarReportePdf productos RPC', () => {
  let mockDoc;

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

  test('tabla de productos usa filas del RPC y no recalcula desde pedidos', () => {
    exportarReportePdf({
      configPeriodo: { periodo: 'semana', fechaDesde: '', fechaHasta: '' },
      filtroVenta: 'todos',
      resumen: { totalPedidos: 1, montoAcumulado: 100 },
      categorias: [],
      productos: [
        {
          nombre: 'Producto RPC',
          cantidadVendida: 4,
          totalFacturado: 200,
        },
      ],
      pedidos: [
        {
          id: 'x',
          created_at: '2026-11-03T18:00:00.000Z',
          lineas_detalle: [
            { nombre: 'Producto distinto en pedido', cantidad: 99, precio_unitario: 1 },
          ],
          total: 100,
        },
      ],
      jornadasPorId: {},
    });

    const tablaProductos = autoTable.mock.calls.find(
      ([, options]) => options.head?.[0]?.[0] === 'Producto'
    );
    expect(tablaProductos).toBeDefined();
    expect(tablaProductos[1].body).toEqual([['Producto RPC', '4', '$200.00']]);
  });
});
