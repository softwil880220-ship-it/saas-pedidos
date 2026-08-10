jest.mock('jspdf', () => ({
  jsPDF: jest.fn(),
}));

jest.mock('jspdf-autotable', () => jest.fn());

import { calcularReportePorCategoria } from './reportesHelpers';

const productos = [
  { id: 'esq-6', nombre: 'Esquite 6oz', categoria: 'Esquite' },
  { id: 'esq-8', nombre: 'Esquite 8oz', categoria: 'Esquite' },
  { id: 'marq', nombre: 'Marquesita', categoria: 'Marquesita' },
  { id: 'elote', nombre: 'Elote (por Kg)', categoria: 'Elote' },
];

describe('calcularReportePorCategoria', () => {
  test('agrupa variantes de la misma categoría en un solo renglón', () => {
    const pedidos = [
      {
        lineas_detalle: [
          {
            productoId: 'esq-6',
            nombre: 'Esquite 6oz',
            cantidad: 2,
            subtotal: 50,
          },
          {
            productoId: 'esq-8',
            nombre: 'Esquite 8oz',
            cantidad: 1,
            subtotal: 30,
          },
        ],
      },
    ];

    const reporte = calcularReportePorCategoria(pedidos, productos);

    expect(reporte).toEqual([
      {
        nombre: 'Esquite',
        cantidadVendida: 3,
        totalFacturado: 80,
      },
    ]);
  });

  test('suma gramos para productos por peso', () => {
    const pedidos = [
      {
        lineas_detalle: [
          {
            productoId: 'elote',
            nombre: 'Elote (por Kg)',
            cantidad: 100,
            unidad_venta: 'peso',
            subtotal: 25,
          },
          {
            productoId: 'elote',
            nombre: 'Elote (por Kg)',
            cantidad: 250,
            unidad_venta: 'peso',
            subtotal: 62.5,
          },
        ],
      },
    ];

    const reporte = calcularReportePorCategoria(pedidos, productos);

    expect(reporte).toEqual([
      {
        nombre: 'Elote',
        cantidadVendida: 350,
        totalFacturado: 87.5,
      },
    ]);
  });

  test('clasifica líneas sin producto resoluble como Sin categoría', () => {
    const pedidos = [
      {
        lineas_detalle: [
          {
            nombre: 'Producto desconocido',
            cantidad: 1,
            subtotal: 15,
          },
        ],
      },
    ];

    const reporte = calcularReportePorCategoria(pedidos, productos);

    expect(reporte).toEqual([
      {
        nombre: 'Sin categoría',
        cantidadVendida: 1,
        totalFacturado: 15,
      },
    ]);
  });

  test('omite pedidos legacy sin lineas_detalle', () => {
    const pedidos = [
      { producto: 'Esquite 6oz', total: 25 },
      {
        lineas_detalle: [
          {
            productoId: 'marq',
            nombre: 'Marquesita',
            cantidad: 2,
            subtotal: 40,
          },
        ],
      },
    ];

    const reporte = calcularReportePorCategoria(pedidos, productos);

    expect(reporte).toEqual([
      {
        nombre: 'Marquesita',
        cantidadVendida: 2,
        totalFacturado: 40,
      },
    ]);
  });

  test('ordena por total facturado descendente', () => {
    const pedidos = [
      {
        lineas_detalle: [
          {
            productoId: 'marq',
            nombre: 'Marquesita',
            cantidad: 1,
            subtotal: 20,
          },
          {
            productoId: 'esq-6',
            nombre: 'Esquite 6oz',
            cantidad: 1,
            subtotal: 50,
          },
        ],
      },
    ];

    const reporte = calcularReportePorCategoria(pedidos, productos);

    expect(reporte.map((fila) => fila.nombre)).toEqual(['Esquite', 'Marquesita']);
  });
});
