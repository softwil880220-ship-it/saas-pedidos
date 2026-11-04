import { formatearMontoOcultable, TEXTO_MONTO_OCULTO } from './formatearMontoOcultable';
import { formatearMoneda } from './pedidosShared';

describe('formatearMontoOcultable', () => {
  test('oculto devuelve $ •••• sin el número', () => {
    expect(formatearMontoOcultable(false, 1234.56)).toBe(TEXTO_MONTO_OCULTO);
    expect(formatearMontoOcultable(false, 1234.56)).toBe('$ ••••');
    expect(formatearMontoOcultable(false, 1234.56)).not.toContain('1234');
    expect(formatearMontoOcultable(false, 115)).not.toContain('115');
  });

  test('visible usa formatearMoneda', () => {
    expect(formatearMontoOcultable(true, 220)).toBe(formatearMoneda(220));
    expect(formatearMontoOcultable(true, 115)).toBe(formatearMoneda(115));
  });
});
