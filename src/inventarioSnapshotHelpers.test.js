import {
  calcularCargaInicialPorInsumos,
  calcularConsumoVenta,
  calcularConsumoEmpleados,
  calcularDiferencia,
  calcularTeorico,
} from './inventarioSnapshotHelpers';

const INSUMO_ESQUITE_ID = '11111111-1111-4111-8111-111111111111';
const JORNADA_ID = '22222222-2222-4222-8222-222222222222';
const PRODUCTO_ESQUITE_ID = 101;
const PRODUCTO_ELOTE_ID = 102;

const jornada = {
  id: JORNADA_ID,
  abierta_en: '2026-09-15T08:00:00.000Z',
};

const insumoRecetas = [
  {
    producto_id: PRODUCTO_ESQUITE_ID,
    insumo_id: INSUMO_ESQUITE_ID,
    cantidad_por_producto: 60,
  },
  {
    producto_id: PRODUCTO_ELOTE_ID,
    insumo_id: INSUMO_ESQUITE_ID,
    cantidad_por_producto: 1000,
  },
];

const insumoRecetasVariantes = [];

const cargas = [
  {
    insumo_id: INSUMO_ESQUITE_ID,
    cantidad: 5000,
    tipo: 'carga_inicial',
    jornada_id: JORNADA_ID,
  },
  {
    insumo_id: INSUMO_ESQUITE_ID,
    cantidad: 2000,
    tipo: 'compra_adicional',
    jornada_id: JORNADA_ID,
  },
];

const pedidos = [
  {
    id: 'pedido-esquite-1',
    tipo: 'presencial',
    jornada_id: JORNADA_ID,
    created_at: '2026-09-15T10:00:00.000Z',
    deleted_at: null,
    lineas_detalle: [
      {
        productoId: String(PRODUCTO_ESQUITE_ID),
        nombre: 'Esquite',
        cantidad: 1,
        unidad_venta: 'pieza',
        variantes: {},
      },
    ],
  },
  {
    id: 'pedido-esquite-2',
    tipo: 'mostrador',
    jornada_id: JORNADA_ID,
    created_at: '2026-09-15T11:00:00.000Z',
    deleted_at: null,
    lineas_detalle: [
      {
        productoId: String(PRODUCTO_ESQUITE_ID),
        nombre: 'Esquite',
        cantidad: 1,
        unidad_venta: 'pieza',
        variantes: {},
      },
    ],
  },
  {
    id: 'pedido-elote-350g',
    tipo: 'mesa',
    jornada_id: JORNADA_ID,
    created_at: '2026-09-15T12:00:00.000Z',
    deleted_at: null,
    lineas_detalle: [
      {
        productoId: String(PRODUCTO_ELOTE_ID),
        nombre: 'Elote por Kilo',
        cantidad: 350,
        unidad_venta: 'peso',
        variantes: {},
      },
    ],
  },
];

const consumosInternos = [
  {
    id: 'consumo-empleado-1',
    producto_id: PRODUCTO_ESQUITE_ID,
    cantidad: 1,
    variantes: null,
    deleted_at: null,
    productos: {
      id: PRODUCTO_ESQUITE_ID,
      nombre: 'Esquite',
      unidad_venta: 'pieza',
    },
  },
];

describe('inventarioSnapshotHelpers — caso controlado DEV (esquite)', () => {
  test('calcula carga, consumo venta, consumo empleados y teórico esperado', () => {
    const cargaInicial = calcularCargaInicialPorInsumos(cargas);
    const consumoVenta = calcularConsumoVenta(
      pedidos,
      jornada,
      insumoRecetas,
      insumoRecetasVariantes
    );
    const consumoEmpleados = calcularConsumoEmpleados(
      consumosInternos,
      insumoRecetas,
      insumoRecetasVariantes
    );
    const teorico = calcularTeorico(cargaInicial, consumoVenta, consumoEmpleados);

    const insumoId = INSUMO_ESQUITE_ID;
    const resumen = {
      insumo_id: insumoId,
      carga_inicial: cargaInicial[insumoId],
      consumo_venta: consumoVenta[insumoId],
      consumo_empleados: consumoEmpleados[insumoId],
      teorico: teorico[insumoId],
    };

    // eslint-disable-next-line no-console
    console.log('\n=== Snapshot esquite (g) — caso controlado ===');
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(resumen, null, 2));
    // eslint-disable-next-line no-console
    console.log('Desglose esperado a mano:');
    // eslint-disable-next-line no-console
    console.log('  carga_inicial     = 5000 + 2000 = 7000 g');
    // eslint-disable-next-line no-console
    console.log('  consumo_venta     = 2×60 + (350/1000)×1000 = 120 + 350 = 470 g');
    // eslint-disable-next-line no-console
    console.log('  consumo_empleados = 1×60 = 60 g');
    // eslint-disable-next-line no-console
    console.log('  teórico           = 7000 - 470 - 60 = 6470 g\n');

    expect(resumen.carga_inicial).toBe(7000);
    expect(resumen.consumo_venta).toBe(470);
    expect(resumen.consumo_empleados).toBe(60);
    expect(resumen.teorico).toBe(6470);
  });

  test('diferencia suma merma al conteo físico sin restarla del teórico', () => {
    const cargaInicial = calcularCargaInicialPorInsumos(cargas);
    const consumoVenta = calcularConsumoVenta(
      pedidos,
      jornada,
      insumoRecetas,
      insumoRecetasVariantes
    );
    const consumoEmpleados = calcularConsumoEmpleados(
      consumosInternos,
      insumoRecetas,
      insumoRecetasVariantes
    );
    const teorico = calcularTeorico(cargaInicial, consumoVenta, consumoEmpleados);
    const contadoFisico = { [INSUMO_ESQUITE_ID]: 6400 };
    const mermaExplicada = { [INSUMO_ESQUITE_ID]: 70 };

    const diferencia = calcularDiferencia(contadoFisico, mermaExplicada, teorico);

    expect(teorico[INSUMO_ESQUITE_ID]).toBe(6470);
    expect(diferencia[INSUMO_ESQUITE_ID]).toBe(0);
  });
});
