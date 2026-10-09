import {
  formatearCantidadConUnidadMedida,
  formatearDiferenciaConUnidadMedida,
  formatearDiferenciaInventario,
  formatearEtiquetaCantidadPiezas,
  redondearCantidadInventario,
  resolverEtiquetaUnidadMedida,
  textoCantidadInventario,
} from './inventarioFormatoHelpers';

describe('inventarioFormatoHelpers', () => {
  test('redondearCantidadInventario corrige errores de punto flotante', () => {
    expect(redondearCantidadInventario(-350.4599999999)).toBe(-350.46);
    expect(redondearCantidadInventario(470.00000000000006)).toBe(470);
    expect(redondearCantidadInventario(1.005)).toBe(1.01);
  });

  test('redondearCantidadInventario devuelve null para valores no finitos', () => {
    expect(redondearCantidadInventario('')).toBeNull();
    expect(redondearCantidadInventario(null)).toBeNull();
    expect(redondearCantidadInventario(Number.NaN)).toBeNull();
  });

  test('textoCantidadInventario muestra enteros sin decimales y fracciones con 2 decimales', () => {
    expect(textoCantidadInventario(27)).toBe('27');
    expect(textoCantidadInventario(-350.4599999999)).toBe('-350.46');
    expect(textoCantidadInventario(Number.NaN)).toBe('—');
  });

  test('formatearCantidadConUnidadMedida concatena unidad de insumo', () => {
    expect(formatearCantidadConUnidadMedida(500, 'g')).toBe('500 g');
    expect(formatearCantidadConUnidadMedida(27.999999999999996, 'pieza')).toBe('28 piezas');
  });

  test('formatearDiferenciaInventario agrega signo positivo explícito', () => {
    expect(formatearDiferenciaInventario(-350.4599999999)).toBe('-350.46');
    expect(formatearDiferenciaInventario(12.4)).toBe('+12.40');
    expect(formatearDiferenciaInventario(0)).toBe('0');
  });

  test('formatearDiferenciaConUnidadMedida incluye unidad', () => {
    expect(formatearDiferenciaConUnidadMedida(-350.4599999999, 'g')).toBe('-350.46 g');
    expect(formatearDiferenciaConUnidadMedida(3, 'ml')).toBe('+3 ml');
  });

  describe('resolverEtiquetaUnidadMedida y plural pieza', () => {
    test('singular y plural de pieza según cantidad redondeada', () => {
      expect(resolverEtiquetaUnidadMedida('pieza', 0)).toBe('piezas');
      expect(resolverEtiquetaUnidadMedida('pieza', 1)).toBe('pieza');
      expect(resolverEtiquetaUnidadMedida('pieza', -1)).toBe('pieza');
      expect(resolverEtiquetaUnidadMedida('pieza', 1.5)).toBe('piezas');
      expect(resolverEtiquetaUnidadMedida('pieza', 2)).toBe('piezas');
      expect(resolverEtiquetaUnidadMedida('pieza', redondearCantidadInventario(27.999))).toBe(
        'piezas'
      );
      expect(resolverEtiquetaUnidadMedida('pieza', redondearCantidadInventario(1.0000001))).toBe(
        'pieza'
      );
    });

    test('g y ml no cambian con la cantidad', () => {
      expect(resolverEtiquetaUnidadMedida('g', 1)).toBe('g');
      expect(resolverEtiquetaUnidadMedida('g', 500)).toBe('g');
      expect(resolverEtiquetaUnidadMedida('ml', 1)).toBe('ml');
      expect(resolverEtiquetaUnidadMedida('ml', 2)).toBe('ml');
    });

    test('unidad desconocida, vacía y nula se muestran tal cual', () => {
      expect(resolverEtiquetaUnidadMedida('kg', 2)).toBe('kg');
      expect(resolverEtiquetaUnidadMedida('  Litro ', 2)).toBe('Litro');
      expect(resolverEtiquetaUnidadMedida('', 1)).toBe('');
      expect(resolverEtiquetaUnidadMedida(null, 1)).toBe('');
    });
  });

  describe('formatearCantidadConUnidadMedida — casos pieza', () => {
    test('cantidades representativas con pieza', () => {
      expect(formatearCantidadConUnidadMedida(0, 'pieza')).toBe('0 piezas');
      expect(formatearCantidadConUnidadMedida(1, 'pieza')).toBe('1 pieza');
      expect(formatearCantidadConUnidadMedida(-1, 'pieza')).toBe('-1 pieza');
      expect(formatearCantidadConUnidadMedida(1.5, 'pieza')).toBe('1.50 piezas');
      expect(formatearCantidadConUnidadMedida(2, 'pieza')).toBe('2 piezas');
    });
  });

  describe('formatearDiferenciaConUnidadMedida — diferencia negativa en pieza', () => {
    test('diferencia -1 pieza singular', () => {
      expect(formatearDiferenciaConUnidadMedida(-1, 'pieza')).toBe('-1 pieza');
    });
  });

  describe('formatearEtiquetaCantidadPiezas — regla estricta producto', () => {
    test('solo cantidad exactamente 1 es singular', () => {
      expect(formatearEtiquetaCantidadPiezas(1)).toBe('1 pieza');
      expect(formatearEtiquetaCantidadPiezas(2)).toBe('2 piezas');
      expect(formatearEtiquetaCantidadPiezas(-1)).toBe('-1 piezas');
      expect(formatearEtiquetaCantidadPiezas(0)).toBe('0 piezas');
    });
  });
});
