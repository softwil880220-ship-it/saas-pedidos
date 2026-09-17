jest.mock('jspdf', () => ({
  jsPDF: jest.fn(),
}));

jest.mock('jspdf-autotable', () => jest.fn());

import {
  agruparConsumoPersonalPorProducto,
  calcularResumenConsumoPersonal,
  deduplicarConsumosInternosPorId,
  enriquecerConsumosInternosReporte,
  fechasRangoDesdeJornadaAbierta,
  filtrarConsumoInternoPorEmpleado,
  formatearCantidadConsumoProducto,
  inventarioReportePeriodoActivo,
  listarConsumoPersonalDetallado,
} from './reportesInventarioHelpers';

describe('reportesInventarioHelpers — consumo de personal', () => {
  const productoPieza = { id: 1, nombre: 'Esquite', unidad_venta: 'pieza' };
  const productoPeso = { id: 2, nombre: 'Elote', unidad_venta: 'peso' };

  test('deduplica registros repetidos por id antes de agrupar', () => {
    const consumo = {
      id: 'c1',
      producto_id: 1,
      cantidad: 1,
      variantes: null,
      deleted_at: null,
      created_at: '2026-09-15T17:45:00.000Z',
    };

    const filas = listarConsumoPersonalDetallado(
      enriquecerConsumosInternosReporte(
        deduplicarConsumosInternosPorId([consumo, consumo, consumo]),
        { 1: productoPieza },
        {}
      ),
      {}
    );

    expect(filas).toHaveLength(1);
    expect(filas[0].cantidadEtiqueta).toBe('1 pieza');
  });

  test('agrupa por producto y variantes sin duplicar cantidades', () => {
    const consumos = enriquecerConsumosInternosReporte(
      [
        {
          id: 'c1',
          producto_id: 1,
          cantidad: 1,
          variantes: null,
          deleted_at: null,
          empleado_id: 'beto',
        },
        {
          id: 'c2',
          producto_id: 1,
          cantidad: 1,
          variantes: { 10: [55] },
          deleted_at: null,
          empleado_id: 'beto',
        },
        {
          id: 'c3',
          producto_id: 2,
          cantidad: 200,
          variantes: null,
          deleted_at: null,
          empleado_id: 'beto',
        },
      ],
      { 1: productoPieza, 2: productoPeso },
      { beto: { id: 'beto', nombre: 'Beto' } }
    );

    const filasProducto = agruparConsumoPersonalPorProducto(consumos, {});
    const filasDetalle = listarConsumoPersonalDetallado(consumos, {});

    expect(filasProducto.map((fila) => fila.cantidadEtiqueta).sort()).toEqual([
      '1 pieza',
      '1 pieza',
      '200 g',
    ]);
    expect(filasDetalle).toHaveLength(3);
    expect(filasDetalle.every((fila) => fila.cantidadEtiqueta !== '2 piezas')).toBe(true);
  });

  test('calcula rango De/Hasta desde apertura de jornada abierta', () => {
    const fechas = fechasRangoDesdeJornadaAbierta({
      abierta_en: '2026-09-15T17:44:00.000Z',
    });

    expect(fechas.fechaDesde).toBe('2026-09-15');
    expect(fechas.fechaHasta).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('considera activo el reporte cuando hay jornada foco', () => {
    expect(
      inventarioReportePeriodoActivo({
        jornadaFocoId: 'jornada-1',
        rangoInvalido: true,
      })
    ).toBe(true);
  });

  test('filtra por empleado y resume registros', () => {
    const consumos = [
      {
        id: 'c1',
        empleado_id: 'a',
        deleted_at: null,
        producto_id: 1,
        productos: productoPieza,
        cantidad: 1,
      },
      {
        id: 'c2',
        empleado_id: 'b',
        deleted_at: null,
        producto_id: 1,
        productos: productoPieza,
        cantidad: 3,
      },
    ];

    const filtrados = filtrarConsumoInternoPorEmpleado(consumos, 'a');
    const resumen = calcularResumenConsumoPersonal(
      filtrados,
      agruparConsumoPersonalPorProducto(filtrados, {})
    );

    expect(filtrados).toHaveLength(1);
    expect(resumen.totalRegistros).toBe(1);
    expect(formatearCantidadConsumoProducto(productoPieza, 1)).toBe('1 pieza');
  });
});
