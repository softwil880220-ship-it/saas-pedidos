import {
  aplicarLineaFleteManual,
  buscarLineaFlete,
  calcularDetalleLineaFlete,
  crearLineaFleteCarrito,
  esLineaFlete,
  formatearDescripcionLineaFlete,
  sincronizarLineaFleteAutomatica,
  tarifaFleteZonaActiva,
} from './pedidoFleteHelpers';
import { calcularDetalleLineasPedido } from './pedidoCarritoCalculos';
import { TIPOS_ENTREGA } from './pedidosShared';
import { filtrarLineasDetallePorCocina, COCINAS } from './pedidosShared';

describe('pedidoFleteHelpers', () => {
  const zonasActivas = [
    { id: 'z1', nombre: 'Caucel', tarifa_flete: 20, activa: true },
    { id: 'z2', nombre: 'Inactiva', tarifa_flete: 15, activa: false },
    { id: 'z3', nombre: 'Gratis', tarifa_flete: 0, activa: true },
  ];

  test('no agrega flete automático con tarifa cero', () => {
    const resultado = sincronizarLineaFleteAutomatica({
      lineas: [{ id: 1, productoId: 'p1', cantidad: '1' }],
      zonaId: 'z3',
      zonasActivas,
      tipoEntrega: TIPOS_ENTREGA.DOMICILIO,
      nextLineaId: 2,
    });

    expect(buscarLineaFlete(resultado.lineas)).toBeNull();
  });

  test('agrega flete automático con zona activa y tarifa positiva', () => {
    const resultado = sincronizarLineaFleteAutomatica({
      lineas: [{ id: 1, productoId: 'p1', cantidad: '1' }],
      zonaId: 'z1',
      zonasActivas,
      tipoEntrega: TIPOS_ENTREGA.DOMICILIO,
      nextLineaId: 2,
    });

    const flete = buscarLineaFlete(resultado.lineas);
    expect(flete).toMatchObject({
      es_flete: true,
      monto: 20,
      zona_id: 'z1',
      zona_nombre: 'Caucel',
      flete_manual: false,
    });
  });

  test('no agrega flete automático con zona inactiva aunque exista en cliente', () => {
    const resultado = sincronizarLineaFleteAutomatica({
      lineas: [],
      zonaId: 'z2',
      zonasActivas,
      tipoEntrega: TIPOS_ENTREGA.DOMICILIO,
      nextLineaId: 2,
    });

    expect(buscarLineaFlete(resultado.lineas)).toBeNull();
  });

  test('manual y automático se reemplazan mutuamente', () => {
    const manual = aplicarLineaFleteManual({
      lineas: [],
      monto: 35,
      nextLineaId: 2,
    });

    const auto = sincronizarLineaFleteAutomatica({
      lineas: manual.lineas,
      zonaId: 'z1',
      zonasActivas,
      tipoEntrega: TIPOS_ENTREGA.DOMICILIO,
      nextLineaId: manual.nextLineaId,
      reemplazarManual: true,
    });

    expect(buscarLineaFlete(auto.lineas)).toMatchObject({
      monto: 20,
      flete_manual: false,
    });
  });

  test('respeta flete manual si reemplazarManual es false', () => {
    const manual = aplicarLineaFleteManual({
      lineas: [],
      monto: 35,
      nextLineaId: 2,
    });

    const resultado = sincronizarLineaFleteAutomatica({
      lineas: manual.lineas,
      zonaId: 'z1',
      zonasActivas,
      tipoEntrega: TIPOS_ENTREGA.DOMICILIO,
      nextLineaId: manual.nextLineaId,
      reemplazarManual: false,
    });

    expect(buscarLineaFlete(resultado.lineas)).toMatchObject({
      monto: 35,
      flete_manual: true,
    });
  });

  test('calcularDetalleLineaFlete persiste snapshot histórico', () => {
    const detalle = calcularDetalleLineaFlete(
      crearLineaFleteCarrito({
        id: 2,
        monto: 20,
        zonaId: 'z1',
        zonaNombre: 'Caucel',
      })
    );

    expect(detalle).toMatchObject({
      es_flete: true,
      zona_id: 'z1',
      zona_nombre: 'Caucel',
      subtotal: 20,
      descripcion: 'Flete: Caucel — $20.00',
    });
  });

  test('calcularDetalleLineasPedido incluye flete en el total', () => {
    const { lineas, total } = calcularDetalleLineasPedido(
      [
        {
          id: 1,
          productoId: '1',
          cantidad: '1',
          variantes: {},
        },
        crearLineaFleteCarrito({
          id: 2,
          monto: 20,
          zonaId: 'z1',
          zonaNombre: 'Caucel',
        }),
      ],
      [{ id: '1', nombre: 'Pizza', precio: 100, unidad_venta: 'pieza', cocina: 'cocina1' }],
      { categorias: [] }
    );

    expect(lineas).toHaveLength(2);
    expect(lineas.some((linea) => linea.es_flete)).toBe(true);
    expect(total).toBeGreaterThan(100);
  });

  test('formatearDescripcionLineaFlete distingue manual', () => {
    expect(
      formatearDescripcionLineaFlete({ zonaNombre: 'Caucel', monto: 20, manual: false })
    ).toBe('Flete: Caucel — $20.00');
    expect(formatearDescripcionLineaFlete({ monto: 15, manual: true })).toBe('Flete — $15.00');
  });

  test('tarifaFleteZonaActiva devuelve null para tarifa cero', () => {
    expect(tarifaFleteZonaActiva({ tarifa_flete: 0, activa: true })).toBeNull();
  });
});

describe('filtrarLineasDetallePorCocina con flete', () => {
  test('excluye líneas es_flete de cocina', () => {
    const pedido = {
      lineas_detalle: [
        {
          es_flete: true,
          nombre: 'Flete',
          descripcion: 'Flete: Caucel — $20.00',
          subtotal: 20,
          cantidad: 1,
        },
        {
          productoId: '1',
          nombre: 'Pizza',
          cantidad: 1,
          subtotal: 100,
          cocina: 'cocina1',
        },
      ],
    };

    const filtradas = filtrarLineasDetallePorCocina(pedido, COCINAS.COCINA1);
    expect(filtradas).toHaveLength(1);
    expect(filtradas[0].nombre).toBe('Pizza');
  });
});
