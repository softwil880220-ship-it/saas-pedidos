import {
  aplicarConsolidacionCarrito,
  idEstableLineaCarrito,
  keyRenderLineaCarrito,
} from './pedidoCarritoCalculos';

const productos = [
  {
    id: 'p1',
    nombre: 'Pizza',
    precio: 100,
    unidad_venta: 'pieza',
    cocina: 'cocina1',
  },
];

const productosPeso = [
  {
    id: 'jam',
    nombre: 'Jamón',
    precio: 200,
    unidad_venta: 'peso',
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
const ctxPeso = { ...variantesCtx, productos: productosPeso };

describe('keyRenderLineaCarrito', () => {
  test('permanece estable al cambiar cantidad en producto por peso', () => {
    const lineaVacia = {
      id: 'peso:jam:cat1::',
      productoId: 'jam',
      cantidad: '',
      variantes: {},
    };
    const lineaConGramos = { ...lineaVacia, cantidad: '500' };

    const keyVacia = keyRenderLineaCarrito(lineaVacia, ctxPeso, 0);
    const keyConGramos = keyRenderLineaCarrito(lineaConGramos, ctxPeso, 0);

    expect(keyVacia).toBe(keyConGramos);
    expect(idEstableLineaCarrito(lineaVacia, ctxPeso)).not.toBe(
      idEstableLineaCarrito(lineaConGramos, ctxPeso)
    );
  });

  test('cambia cuando cambian las variantes en producto por peso', () => {
    const sinVariantes = {
      id: 'peso:jam:cat1::500',
      productoId: 'jam',
      cantidad: '500',
      variantes: {},
    };
    const conVariantes = {
      ...sinVariantes,
      variantes: { cat1: ['v1'] },
    };

    expect(keyRenderLineaCarrito(sinVariantes, ctxPeso, 0)).not.toBe(
      keyRenderLineaCarrito(conVariantes, ctxPeso, 0)
    );
  });

  test('devuelve linea.id para productos por pieza', () => {
    const linea = {
      id: 'pieza:p1|cat1:v1',
      productoId: 'p1',
      cantidad: '2',
      variantes: { cat1: ['v1'] },
    };

    expect(keyRenderLineaCarrito(linea, ctx, 0)).toBe(linea.id);
  });

  test('distingue dos líneas por peso con mismo producto y huella por índice', () => {
    const lineaA = {
      id: 'peso:jam:cat1::500',
      productoId: 'jam',
      cantidad: '500',
      variantes: {},
    };
    const lineaB = {
      id: 'peso:jam:cat1::300',
      productoId: 'jam',
      cantidad: '300',
      variantes: {},
    };

    expect(keyRenderLineaCarrito(lineaA, ctxPeso, 0)).not.toBe(
      keyRenderLineaCarrito(lineaB, ctxPeso, 1)
    );
  });
});

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
