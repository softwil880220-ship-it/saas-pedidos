import { contarArticulosLineasDetalle, obtenerDesgloseLineasPedido } from './pedidoDesglose';

const productos = [
  {
    id: '1',
    nombre: 'Elote (por Kg)',
    precio: 250,
    unidad_venta: 'peso',
  },
  {
    id: '2',
    nombre: 'Elote',
    precio: 20,
    unidad_venta: 'pieza',
  },
];

const variantesCtx = {
  categorias: [{ id: '10', nombre: 'Quesos', activa: true }],
  catalogos: {
    '10': [{ id: '100', nombre: 'Parmesano', precio: 5, activo: true }],
  },
  productoItems: {},
};

describe('obtenerDesgloseLineasPedido', () => {
  test('desglosa peso con extra fijo en línea base y fila de ingrediente extra', () => {
    const pedido = {
      total: 30,
      lineas_detalle: [
        {
          productoId: '1',
          nombre: 'Elote (por Kg)',
          cantidad: 100,
          unidad_venta: 'peso',
          precioBase: 250,
          extras: 5,
          subtotal: 30,
          descripcion: 'Elote (por Kg) (queso: Parmesano)',
          variantes: { '10': ['100'] },
        },
      ],
    };

    const { lineas, total } = obtenerDesgloseLineasPedido(pedido, productos, variantesCtx);

    expect(lineas).toHaveLength(2);
    expect(lineas[0]).toEqual({
      cantidad: '100g',
      nombre: 'Elote (por Kg)',
      precioLinea: 25,
    });
    expect(lineas[1]).toEqual({
      cantidad: 1,
      nombre: 'Ingrediente extra (queso: Parmesano)',
      precioLinea: 5,
    });
    expect(total).toBe(30);
  });

  test('peso sin variantes conserva una sola línea con subtotal base', () => {
    const pedido = {
      total: 25,
      lineas_detalle: [
        {
          productoId: '1',
          nombre: 'Elote (por Kg)',
          cantidad: 100,
          unidad_venta: 'peso',
          precioBase: 250,
          extras: 0,
          subtotal: 25,
          descripcion: 'Elote (por Kg)',
        },
      ],
    };

    const { lineas, total } = obtenerDesgloseLineasPedido(pedido, productos, variantesCtx);

    expect(lineas).toHaveLength(1);
    expect(lineas[0]).toEqual({
      cantidad: '100g',
      nombre: 'Elote (por Kg)',
      precioLinea: 25,
    });
    expect(total).toBe(25);
  });
});

describe('contarArticulosLineasDetalle', () => {
  test('producto simple por pieza cuenta 1 artículo', () => {
    const lineas = [
      {
        productoId: '2',
        nombre: 'Elote',
        cantidad: '1',
      },
    ];

    expect(contarArticulosLineasDetalle(lineas, productos)).toBe(1);
  });

  test('producto por peso con extra cuenta 1 artículo, no el extra', () => {
    const lineas = [
      {
        productoId: '1',
        nombre: 'Elote (por Kg)',
        cantidad: 100,
        unidad_venta: 'peso',
        extras: 5,
        variantes: { '10': ['100'] },
      },
    ];

    expect(contarArticulosLineasDetalle(lineas, productos)).toBe(1);
  });

  test('combinación pieza + peso con extra cuenta 2 artículos', () => {
    const lineas = [
      {
        productoId: '2',
        nombre: 'Elote',
        cantidad: '1',
      },
      {
        productoId: '1',
        nombre: 'Elote (por Kg)',
        cantidad: 100,
        unidad_venta: 'peso',
        extras: 5,
        variantes: { '10': ['100'] },
      },
    ];

    expect(contarArticulosLineasDetalle(lineas, productos)).toBe(2);
  });

  test('producto por pieza con cantidad mayor a 1 suma la cantidad', () => {
    const lineas = [
      {
        productoId: '2',
        nombre: 'Elote',
        cantidad: '3',
      },
    ];

    expect(contarArticulosLineasDetalle(lineas, productos)).toBe(3);
  });
});
