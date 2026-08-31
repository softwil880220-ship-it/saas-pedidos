import {
  concentradoCobrosPorFormaPago,
  filtrarPedidosRepartidorPorTab,
  pedidoPorEntregarRepartidor,
  pedidoVisibleRepartidorPorRol,
} from './repartidorHelpers';
import { TIPOS_ENTREGA } from './pedidosShared';

const jornada = {
  id: 'jornada-1',
  abierta_en: '2026-08-31T08:00:00.000Z',
};

const pedidoPropio = {
  id: 'p1',
  tipo: 'whatsapp',
  tipo_entrega: TIPOS_ENTREGA.DOMICILIO,
  repartidor_externo: false,
  repartidor_usuario_id: 'repartidor-a',
  jornada_id: 'jornada-1',
  total: 100,
  forma_pago: 'efectivo',
};

describe('repartidorHelpers', () => {
  test('excluye repartidor externo de la vista', () => {
    const externo = {
      ...pedidoPropio,
      repartidor_externo: true,
      repartidor_usuario_id: null,
      status: 'enviado',
    };

    expect(
      pedidoVisibleRepartidorPorRol(externo, {
        usuarioId: 'repartidor-a',
        rol: 'repartidor',
      })
    ).toBe(false);
  });

  test('repartidor ve solo sus pedidos asignados', () => {
    const propio = { ...pedidoPropio, status: 'enviado' };
    const ajeno = {
      ...pedidoPropio,
      id: 'p2',
      repartidor_usuario_id: 'repartidor-b',
      status: 'enviado',
    };

    const contexto = { usuarioId: 'repartidor-a', rol: 'repartidor' };

    expect(pedidoPorEntregarRepartidor(propio, contexto)).toBe(true);
    expect(pedidoPorEntregarRepartidor(ajeno, contexto)).toBe(false);
  });

  test('dueño ve todos los pedidos propios asignados', () => {
    const ajeno = {
      ...pedidoPropio,
      repartidor_usuario_id: 'repartidor-b',
      status: 'enviado',
    };

    expect(
      pedidoPorEntregarRepartidor(ajeno, {
        usuarioId: 'dueno-1',
        rol: 'dueno',
      })
    ).toBe(true);
  });

  test('legacy enviado sin repartidor_usuario_id aparece en por entregar', () => {
    const legacy = {
      ...pedidoPropio,
      repartidor_usuario_id: null,
      status: 'enviado',
    };

    expect(
      pedidoPorEntregarRepartidor(legacy, {
        usuarioId: 'repartidor-a',
        rol: 'repartidor',
      })
    ).toBe(true);
  });

  test('entregados filtra por entregado_en dentro de la jornada', () => {
    const pedidos = [
      {
        ...pedidoPropio,
        status: 'entregado',
        entregado_en: '2026-08-31T12:00:00.000Z',
        total: 150,
        forma_pago: 'tarjeta',
      },
      {
        ...pedidoPropio,
        id: 'p-old',
        status: 'entregado',
        entregado_en: '2026-08-30T12:00:00.000Z',
        jornada_id: 'jornada-0',
      },
    ];

    const contexto = { usuarioId: 'repartidor-a', rol: 'repartidor' };
    const entregados = filtrarPedidosRepartidorPorTab(
      pedidos,
      'entregados',
      jornada,
      contexto
    );

    expect(entregados).toHaveLength(1);
    expect(entregados[0].id).toBe('p1');
  });

  test('concentrado de cobros solo incluye formas de pago con total > 0', () => {
    const pedidos = [
      { ...pedidoPropio, status: 'entregado', total: 100, forma_pago: 'efectivo' },
      { ...pedidoPropio, id: 'p2', total: 50, forma_pago: 'tarjeta' },
      { ...pedidoPropio, id: 'p3', total: 0, forma_pago: 'link_pago' },
    ];

    const concentrado = concentradoCobrosPorFormaPago(pedidos);

    expect(concentrado).toEqual([
      expect.objectContaining({ forma: 'efectivo', total: 100, cantidad: 1 }),
      expect.objectContaining({ forma: 'tarjeta', total: 50, cantidad: 1 }),
    ]);
    expect(concentrado.some((item) => item.forma === 'link_pago')).toBe(false);
  });
});
