import {
  formatearCantidadConUnidadMedida,
  formatearDiferenciaConUnidadMedida,
  formatearDiferenciaInventario,
  redondearCantidadInventario,
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
    expect(formatearCantidadConUnidadMedida(27.999999999999996, 'pieza')).toBe('28 pieza');
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
});
