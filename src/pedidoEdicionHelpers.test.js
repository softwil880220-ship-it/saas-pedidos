import { calcularSubtotal } from './pedidoCarritoCalculos';
import { lineasFormularioDesdePedido } from './pedidoEdicionHelpers';

const productos = [
  {
    id: '1',
    nombre: 'Elote',
    precio: 250,
    unidad_venta: 'peso',
    cocina: 'cocina1',
  },
  {
    id: '2',
    nombre: 'Pizza',
    precio: 100,
    unidad_venta: 'pieza',
    cocina: 'cocina1',
  },
];

const variantesCtx = {
  categorias: [{ id: '10', nombre: 'Extras', activa: true }],
  catalogos: {
    '10': [{ id: '100', nombre: 'Parmesano', precio: 5, activo: true }],
  },
  productoItems: {},
};

describe('lineasFormularioDesdePedido', () => {
  test('restaura variantes estructuradas en producto por peso aunque descripcion no parseable', () => {
    const pedido = {
      lineas_detalle: [
        {
          productoId: '1',
          nombre: 'Elote',
          cantidad: 200,
          unidad_venta: 'peso',
          descripcion: 'Elote (Parmesano)',
          variantes: { '10': ['100'] },
          extras: 5,
          subtotal: 55,
        },
      ],
    };

    const lineas = lineasFormularioDesdePedido(pedido, productos, variantesCtx);

    expect(lineas).toHaveLength(1);
    expect(lineas[0].variantes['10']).toEqual(['100']);
    expect(calcularSubtotal(lineas[0], productos, variantesCtx)).toBe(55);
  });

  test('usa parseo de descripcion como fallback legacy sin variantes json', () => {
    const pedido = {
      lineas_detalle: [
        {
          productoId: '2',
          nombre: 'Pizza',
          cantidad: 1,
          unidad_venta: 'pieza',
          descripcion: 'Pizza (extra: Parmesano)',
          extras: 5,
          subtotal: 105,
        },
      ],
    };

    const lineas = lineasFormularioDesdePedido(pedido, productos, variantesCtx);

    expect(lineas[0].variantes['10']).toEqual(['100']);
    expect(calcularSubtotal(lineas[0], productos, variantesCtx)).toBe(105);
  });

  test('mesa/mostrador: conserva gramos y variantes desde lineas_detalle', () => {
    const pedido = {
      lineas_detalle: [
        {
          productoId: '1',
          cantidad: 350,
          unidad_venta: 'peso',
          descripcion: 'Elote (+Parmesano)',
          variantes: { '10': ['100'] },
          extras: 5,
          subtotal: 92.5,
        },
      ],
    };

    const lineas = lineasFormularioDesdePedido(pedido, productos, variantesCtx);

    expect(lineas[0].cantidad).toBe('350');
    expect(lineas[0].variantes['10']).toEqual(['100']);
    expect(calcularSubtotal(lineas[0], productos, variantesCtx)).toBe(92.5);
  });
});
