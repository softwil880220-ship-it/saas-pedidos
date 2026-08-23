import { aplicarConsolidacionCarrito } from './pedidoCarritoCalculos';

const productos = [
  {
    id: 'p1',
    nombre: 'Pizza',
    precio: 100,
    unidad_venta: 'pieza',
    cocina: 'cocina1',
  },
];

const variantesCtx = {
  categorias: [{ id: 'cat1', nombre: 'Extras', activa: true }],
  catalogos: {
    cat1: [
      { id: 'v1', nombre: 'Queso', precio: 5, activo: true },
      { id: 'v2', nombre: 'Peperoni', precio: 5, activo: true },
    ],
  },
  productoItems: {},
};

const ctx = { ...variantesCtx, productos };

describe('aplicarConsolidacionCarrito', () => {
  test('asigna ids únicos cuando dos líneas del mismo producto tienen ids duplicados y distinta huella', () => {
    const lineas = [
      { id: 1, productoId: 'p1', cantidad: '1', variantes: { cat1: ['v1'] } },
      { id: 1, productoId: 'p1', cantidad: '1', variantes: {} },
    ];

    const resultado = aplicarConsolidacionCarrito(lineas, ctx);

    expect(resultado).toHaveLength(2);
    expect(new Set(resultado.map((linea) => linea.id)).size).toBe(2);
    expect(resultado.map((linea) => linea.cantidad).sort()).toEqual(['1', '1']);
  });

  test('consolida a una línea con cantidad 2 cuando ids duplicados comparten la misma huella', () => {
    const lineas = [
      { id: 1, productoId: 'p1', cantidad: '1', variantes: { cat1: ['v1'] } },
      { id: 1, productoId: 'p1', cantidad: '1', variantes: { cat1: ['v1'] } },
    ];

    const resultado = aplicarConsolidacionCarrito(lineas, ctx);

    expect(resultado).toHaveLength(1);
    expect(resultado[0].cantidad).toBe('2');
    expect(new Set(resultado.map((linea) => linea.id)).size).toBe(1);
  });
});
