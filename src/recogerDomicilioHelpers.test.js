import { pedidoPerteneceJornada } from './jornadaHelpers';
import {
  STATUS_PENDIENTE_REPARTIDOR,
  TIPOS_ENTREGA,
  obtenerStatusGlobalTrasCocinas,
} from './pedidosShared';
import {
  construirPayloadAsignacionRepartidor,
  pedidoCoincideBusquedaRecogerDomicilio,
  pedidoRecogerDomicilioEnCocina,
  pedidoRecogerDomicilioEntregadoJornada,
  pedidoRecogerDomicilioPendienteEntrega,
  tabRecogerDomicilioParaPedido,
} from './recogerDomicilioHelpers';

const jornada = {
  id: 'jornada-1',
  abierta_en: '2026-08-23T08:00:00.000Z',
};

const pedidoBase = {
  id: 'p1',
  tipo: 'whatsapp',
  tipo_entrega: TIPOS_ENTREGA.DOMICILIO,
  jornada_id: 'jornada-1',
  cliente: 'Ana López',
  telefono: '5512345678',
  created_at: '2026-08-23T10:00:00.000Z',
  deleted_at: null,
};

describe('recogerDomicilioHelpers', () => {
  test('obtenerStatusGlobalTrasCocinas devuelve pendiente-repartidor para domicilio', () => {
    expect(obtenerStatusGlobalTrasCocinas(TIPOS_ENTREGA.DOMICILIO, 'whatsapp')).toBe(
      STATUS_PENDIENTE_REPARTIDOR
    );
  });

  test('tabRecogerDomicilioParaPedido mapea status a tabs operativos', () => {
    expect(
      tabRecogerDomicilioParaPedido({ ...pedidoBase, status: 'por-aceptar' })
    ).toBe('cocina');
    expect(
      tabRecogerDomicilioParaPedido({
        ...pedidoBase,
        status: STATUS_PENDIENTE_REPARTIDOR,
      })
    ).toBe('pendientes');
    expect(
      tabRecogerDomicilioParaPedido({ ...pedidoBase, status: 'enviado' })
    ).toBe('pendientes');
    expect(
      tabRecogerDomicilioParaPedido({ ...pedidoBase, status: 'entregado' })
    ).toBe('entregados');
  });

  test('pedidoCoincideBusquedaRecogerDomicilio busca por nombre o teléfono con mínimo 3 caracteres', () => {
    expect(pedidoCoincideBusquedaRecogerDomicilio(pedidoBase, 'an')).toBe(false);
    expect(pedidoCoincideBusquedaRecogerDomicilio(pedidoBase, 'ana')).toBe(true);
    expect(pedidoCoincideBusquedaRecogerDomicilio(pedidoBase, '1234')).toBe(true);
  });

  test('pendientes incluye enviado domicilio y listo-para-recoger sucursal', () => {
    expect(
      pedidoRecogerDomicilioPendienteEntrega({
        ...pedidoBase,
        status: STATUS_PENDIENTE_REPARTIDOR,
      })
    ).toBe(true);
    expect(
      pedidoRecogerDomicilioPendienteEntrega({ ...pedidoBase, status: 'enviado' })
    ).toBe(true);
    expect(
      pedidoRecogerDomicilioPendienteEntrega({
        ...pedidoBase,
        tipo_entrega: TIPOS_ENTREGA.SUCURSAL,
        status: 'listo-para-recoger',
      })
    ).toBe(true);
    expect(
      pedidoRecogerDomicilioPendienteEntrega({ ...pedidoBase, status: 'en-cocina' })
    ).toBe(false);
  });

  test('construirPayloadAsignacionRepartidor avanza a enviado con repartidor externo', () => {
    const pedido = { ...pedidoBase, status: STATUS_PENDIENTE_REPARTIDOR };
    const payload = construirPayloadAsignacionRepartidor(pedido, {
      repartidorExterno: true,
    });

    expect(payload).toEqual(
      expect.objectContaining({
        status: 'enviado',
        repartidor_externo: true,
        repartidor_usuario_id: null,
      })
    );
  });

  test('filtros por tab respetan jornada abierta', () => {
    const pedidos = [
      { ...pedidoBase, id: 'c1', status: 'en-cocina' },
      {
        ...pedidoBase,
        id: 'c2',
        status: STATUS_PENDIENTE_REPARTIDOR,
      },
      { ...pedidoBase, id: 'e1', status: 'entregado' },
      {
        ...pedidoBase,
        id: 'otra-jornada',
        jornada_id: 'jornada-2',
        status: 'en-cocina',
      },
    ];

    expect(
      pedidoRecogerDomicilioEnCocina(pedidos[0]) &&
        pedidoPerteneceJornada(pedidos[0], jornada)
    ).toBe(true);
    expect(pedidoRecogerDomicilioEntregadoJornada(pedidos[2], jornada)).toBe(true);
    expect(pedidoPerteneceJornada(pedidos[3], jornada)).toBe(false);
  });
});
