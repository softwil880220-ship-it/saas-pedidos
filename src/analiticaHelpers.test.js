import {
  ALTURA_BARRA_MAX,
  ALTURA_BARRA_MIN,
  calcularAlturasBarras,
  calcularAvance,
  calcularEscalaEjeY,
  calcularParticipacion,
  esDiaEtiquetaClave,
  esFinDeSemana,
  etiquetaMes,
  formatearMontoCompacto,
  inicialDiaSemana,
  nombreCompletoDiaSemana,
  nombreCompletoMes,
  nombreCortoMes,
  ordenarPorVentas,
  validarMonto,
} from './analiticaHelpers';

describe('etiquetaMes', () => {
  test('arma octubre a partir del día 1 del mes', () => {
    expect(etiquetaMes('2026-10-01')).toBe('octubre 2026');
  });

  test('arma diciembre a partir del texto de la fecha', () => {
    expect(etiquetaMes('2026-12-01')).toBe('diciembre 2026');
  });
});

describe('calcularAvance', () => {
  test('meta null no divide entre cero', () => {
    expect(calcularAvance({ vendido: 100, meta: null })).toEqual({
      porcentaje: null,
      anchoBarra: 0,
      faltante: null,
      superada: false,
      diasRestantes: null,
    });
  });

  test('meta 0 no divide entre cero', () => {
    expect(calcularAvance({ vendido: 100, meta: 0 })).toEqual({
      porcentaje: null,
      anchoBarra: 0,
      faltante: null,
      superada: false,
      diasRestantes: null,
    });
  });

  test('50 % del avance', () => {
    expect(calcularAvance({ vendido: 50, meta: 100 })).toEqual({
      porcentaje: 50,
      anchoBarra: 50,
      faltante: 50,
      superada: false,
      diasRestantes: null,
    });
  });

  test('100 % del avance', () => {
    expect(calcularAvance({ vendido: 100, meta: 100 })).toEqual({
      porcentaje: 100,
      anchoBarra: 100,
      faltante: 0,
      superada: false,
      diasRestantes: null,
    });
  });

  test('112 % deja la barra en 100 y marca la meta superada', () => {
    expect(calcularAvance({ vendido: 112, meta: 100 })).toEqual({
      porcentaje: 112,
      anchoBarra: 100,
      faltante: 0,
      superada: true,
      diasRestantes: null,
    });
  });

  test('vendido 0 deja la barra vacía y el faltante igual a la meta', () => {
    expect(calcularAvance({ vendido: 0, meta: 200 })).toEqual({
      porcentaje: 0,
      anchoBarra: 0,
      faltante: 200,
      superada: false,
      diasRestantes: null,
    });
  });

  test('día 28 de 31 cuenta hoy y deja 4 días', () => {
    expect(
      calcularAvance({ vendido: 1015, meta: 3000, diaActual: 28, diasEnMes: 31 }).diasRestantes
    ).toBe(4);
  });

  test('el último día del mes deja 1 día', () => {
    expect(
      calcularAvance({ vendido: 10, meta: 100, diaActual: 31, diasEnMes: 31 }).diasRestantes
    ).toBe(1);
  });

  test('dia_actual null no inventa días restantes', () => {
    expect(
      calcularAvance({ vendido: 10, meta: 100, diaActual: null, diasEnMes: 31 }).diasRestantes
    ).toBeNull();
  });

  test('un día inválido no inventa días restantes', () => {
    expect(
      calcularAvance({ vendido: 10, meta: 100, diaActual: 32, diasEnMes: 31 }).diasRestantes
    ).toBeNull();
  });

  test('meta superada topa la barra y conserva los días', () => {
    expect(calcularAvance({ vendido: 1015, meta: 800, diaActual: 28, diasEnMes: 31 })).toEqual({
      porcentaje: 126.9,
      anchoBarra: 100,
      faltante: 0,
      superada: true,
      diasRestantes: 4,
    });
  });

  test('meta igual al vendido no queda superada', () => {
    expect(calcularAvance({ vendido: 1015, meta: 1015, diaActual: 28, diasEnMes: 31 })).toEqual({
      porcentaje: 100,
      anchoBarra: 100,
      faltante: 0,
      superada: false,
      diasRestantes: 4,
    });
  });

  test('vendido 0 conserva el faltante y los días', () => {
    expect(calcularAvance({ vendido: 0, meta: 3000, diaActual: 28, diasEnMes: 31 })).toEqual({
      porcentaje: 0,
      anchoBarra: 0,
      faltante: 3000,
      superada: false,
      diasRestantes: 4,
    });
  });

  test('meta nula no divide y sí calcula los días', () => {
    expect(calcularAvance({ vendido: 1015, meta: null, diaActual: 28, diasEnMes: 31 })).toEqual({
      porcentaje: null,
      anchoBarra: 0,
      faltante: null,
      superada: false,
      diasRestantes: 4,
    });
  });

  test('porcentaje con un decimal', () => {
    expect(calcularAvance({ vendido: 1015, meta: 3000 }).porcentaje).toBe(33.8);
  });
});

describe('validarMonto', () => {
  test('vacío', () => {
    expect(validarMonto('')).toEqual({
      valido: false,
      monto: null,
      error: 'Escribe el monto de la meta.',
    });
    expect(validarMonto('   ').error).toBe('Escribe el monto de la meta.');
  });

  test('texto no numérico', () => {
    expect(validarMonto('abc')).toEqual({
      valido: false,
      monto: null,
      error: 'Escribe un monto válido.',
    });
  });

  test('cero', () => {
    expect(validarMonto(0)).toEqual({
      valido: false,
      monto: null,
      error: 'La meta debe ser mayor a 0.',
    });
    expect(validarMonto('0').error).toBe('La meta debe ser mayor a 0.');
  });

  test('negativo', () => {
    expect(validarMonto(-10).error).toBe('La meta debe ser mayor a 0.');
    expect(validarMonto('-1.5').error).toBe('La meta debe ser mayor a 0.');
  });

  test('1500', () => {
    expect(validarMonto(1500)).toEqual({ valido: true, monto: 1500, error: null });
    expect(validarMonto('1500')).toEqual({ valido: true, monto: 1500, error: null });
  });

  test('1500.50', () => {
    expect(validarMonto('1500.50')).toEqual({ valido: true, monto: 1500.5, error: null });
  });

  test('más de dos decimales', () => {
    expect(validarMonto('1500.555')).toEqual({
      valido: false,
      monto: null,
      error: 'Usa máximo 2 decimales.',
    });
  });

  test('tope numeric(12,2)', () => {
    expect(validarMonto('9999999999.99')).toEqual({
      valido: true,
      monto: 9999999999.99,
      error: null,
    });
    expect(validarMonto('10000000000')).toEqual({
      valido: false,
      monto: null,
      error: 'El monto es demasiado grande.',
    });
  });

  test('espacios alrededor', () => {
    expect(validarMonto('  1500.50  ')).toEqual({
      valido: true,
      monto: 1500.5,
      error: null,
    });
  });

  test('coma decimal solo cuando no parece separador de miles', () => {
    expect(validarMonto('1500,50')).toEqual({ valido: true, monto: 1500.5, error: null });
    expect(validarMonto('1500,555').error).toBe('Usa máximo 2 decimales.');
    expect(validarMonto('1,500')).toEqual({
      valido: false,
      monto: null,
      error: 'Escribe un monto válido.',
    });
    expect(validarMonto('1,500.50').error).toBe('Escribe un monto válido.');
  });
});

function sumaDecimas(filas) {
  return filas.reduce((suma, fila) => suma + Math.round(Number(fila.porcentaje.toFixed(1)) * 10), 0);
}

describe('calcularParticipacion', () => {
  test('los porcentajes con un decimal suman 100.0', () => {
    const filas = calcularParticipacion([
      { canal: 'caja', total: 20 },
      { canal: 'mostrador', total: 30 },
      { canal: 'mesas', total: 50 },
    ]);

    expect(filas.map((fila) => fila.porcentaje.toFixed(1))).toEqual(['20.0', '30.0', '50.0']);
    expect(sumaDecimas(filas)).toBe(1000);
  });

  test('un solo canal ocupa el 100.0', () => {
    expect(calcularParticipacion([{ canal: 'caja', total: 80 }])).toEqual([
      { canal: 'caja', porcentaje: 100, total: 80 },
    ]);
  });

  test('suma 0 no divide y deja todo en 0', () => {
    expect(calcularParticipacion([
      { canal: 'caja', total: 0 },
      { canal: 'mesas', total: 0 },
    ])).toEqual([
      { canal: 'caja', porcentaje: 0, total: 0 },
      { canal: 'mesas', porcentaje: 0, total: 0 },
    ]);
  });

  test('un canal en 0 se queda en 0.0 y el resto suma 100.0', () => {
    const filas = calcularParticipacion([
      { canal: 'caja', total: 80 },
      { canal: 'mostrador', total: 0 },
      { canal: 'mesas', total: 20 },
    ]);

    expect(filas[1]).toEqual({ canal: 'mostrador', porcentaje: 0, total: 0 });
    expect(sumaDecimas(filas)).toBe(1000);
  });

  test('tres partes iguales reparten el resto y suman 100.0', () => {
    const filas = calcularParticipacion([
      { canal: 'caja', total: 1 },
      { canal: 'mostrador', total: 1 },
      { canal: 'mesas', total: 1 },
    ]);

    expect(filas.map((fila) => fila.porcentaje.toFixed(1))).toEqual(['33.4', '33.3', '33.3']);
    expect(sumaDecimas(filas)).toBe(1000);
  });
});

describe('ordenarPorVentas', () => {
  test('deja igual una lista que ya está de mayor a menor', () => {
    expect(ordenarPorVentas([
      { canal: 'mesas', total: 50, porcentaje: 50 },
      { canal: 'caja', total: 30, porcentaje: 30 },
      { canal: 'mostrador', total: 20, porcentaje: 20 },
    ]).map((fila) => fila.canal)).toEqual(['mesas', 'caja', 'mostrador']);
  });

  test('ordena una lista desordenada por total descendente', () => {
    expect(ordenarPorVentas([
      { canal: 'caja', total: 10, porcentaje: 10 },
      { canal: 'mesas', total: 70, porcentaje: 70 },
      { canal: 'mostrador', total: 20, porcentaje: 20 },
    ]).map((fila) => fila.canal)).toEqual(['mesas', 'mostrador', 'caja']);
  });

  test('un empate conserva el orden original', () => {
    expect(ordenarPorVentas([
      { canal: 'caja', total: 40, porcentaje: 40 },
      { canal: 'mostrador', total: 40, porcentaje: 40 },
      { canal: 'mesas', total: 20, porcentaje: 20 },
    ]).map((fila) => fila.canal)).toEqual(['caja', 'mostrador', 'mesas']);
  });

  test('un canal en 0 queda al final', () => {
    expect(ordenarPorVentas([
      { canal: 'mostrador', total: 0, porcentaje: 0 },
      { canal: 'caja', total: 80, porcentaje: 80 },
      { canal: 'mesas', total: 20, porcentaje: 20 },
    ]).map((fila) => fila.canal)).toEqual(['caja', 'mesas', 'mostrador']);
  });

  test('no muta el arreglo recibido', () => {
    const entrada = [
      { canal: 'caja', total: 10, porcentaje: 20 },
      { canal: 'mesas', total: 40, porcentaje: 80 },
    ];
    const antes = entrada.map((fila) => ({ ...fila }));

    const resultado = ordenarPorVentas(entrada);

    expect(entrada).toEqual(antes);
    expect(resultado).not.toBe(entrada);
    expect(resultado[0]).not.toBe(entrada[1]);
    expect(resultado.map((fila) => fila.canal)).toEqual(['mesas', 'caja']);
  });

  test('un arreglo vacío sigue vacío', () => {
    expect(ordenarPorVentas([])).toEqual([]);
  });

  test('un solo canal se devuelve en una copia', () => {
    const entrada = [{ canal: 'caja', total: 15, porcentaje: 100 }];
    const resultado = ordenarPorVentas(entrada);

    expect(resultado).toEqual(entrada);
    expect(resultado).not.toBe(entrada);
  });
});

describe('nombreCortoMes', () => {
  test('abrevia julio y octubre a partir del texto', () => {
    expect(nombreCortoMes('2026-07-01')).toBe('Jul');
    expect(nombreCortoMes('2026-10-01')).toBe('Oct');
    expect(nombreCortoMes('2026-09-01')).toBe('Sep');
    expect(nombreCortoMes('2026-12-01')).toBe('Dic');
  });

  test('un mes inválido no arma nombre', () => {
    expect(nombreCortoMes('2026-13-01')).toBe('');
    expect(nombreCortoMes('2026-00-01')).toBe('');
    expect(nombreCortoMes('no-es-fecha')).toBe('');
    expect(nombreCortoMes(null)).toBe('');
  });
});

describe('nombreCompletoMes', () => {
  test('arma el nombre completo sin correr el mes', () => {
    expect(nombreCompletoMes('2026-01-01')).toBe('Enero');
    expect(nombreCompletoMes('2026-07-01')).toBe('Julio');
    expect(nombreCompletoMes('2026-10-01')).toBe('Octubre');
  });

  test('un mes inválido no arma nombre', () => {
    expect(nombreCompletoMes('2026-13-01')).toBe('');
    expect(nombreCompletoMes('')).toBe('');
  });
});

describe('formatearMontoCompacto', () => {
  test('deja el cero y los montos chicos sin escala', () => {
    expect(formatearMontoCompacto(0)).toBe('$0');
    expect(formatearMontoCompacto(203)).toBe('$203');
  });

  test('usa miles con un decimal solo cuando hace falta', () => {
    expect(formatearMontoCompacto(3279)).toBe('$3.3 mil');
    expect(formatearMontoCompacto(203000)).toBe('$203 mil');
  });

  test('usa millones', () => {
    expect(formatearMontoCompacto(1200000)).toBe('$1.2 M');
    expect(formatearMontoCompacto(1000000)).toBe('$1 M');
  });

  test('un monto inválido queda vacío', () => {
    expect(formatearMontoCompacto('abc')).toBe('');
    expect(formatearMontoCompacto(null)).toBe('');
  });
});

describe('calcularAlturasBarras', () => {
  test('un mes en cero usa la altura mínima y el mayor llena la escala', () => {
    expect(calcularAlturasBarras([0, 200])).toEqual([ALTURA_BARRA_MIN, ALTURA_BARRA_MAX]);
  });

  test('la altura es proporcional al tope del eje', () => {
    expect(calcularAlturasBarras([50, 100, 0], 100)).toEqual([
      80,
      ALTURA_BARRA_MAX,
      ALTURA_BARRA_MIN,
    ]);
    expect(calcularAlturasBarras([4000], 8000)).toEqual([ALTURA_BARRA_MAX / 2]);
  });

  test('una lista vacía no arma barras', () => {
    expect(calcularAlturasBarras([])).toEqual([]);
  });

  test('un solo mes positivo ocupa toda la escala', () => {
    expect(calcularAlturasBarras([480])).toEqual([ALTURA_BARRA_MAX]);
  });

  test('si el máximo es 0 no divide y todas quedan en la altura mínima', () => {
    expect(calcularAlturasBarras([0, 0, 0])).toEqual([
      ALTURA_BARRA_MIN,
      ALTURA_BARRA_MIN,
      ALTURA_BARRA_MIN,
    ]);
  });

  test('no muta el arreglo recibido', () => {
    const entrada = [0, 50, 100];
    const copia = [...entrada];

    calcularAlturasBarras(entrada, 100);

    expect(entrada).toEqual(copia);
  });

  test('un valor no numérico o negativo queda en la altura mínima', () => {
    expect(calcularAlturasBarras(['no', -20, 0], 8000)).toEqual([
      ALTURA_BARRA_MIN,
      ALTURA_BARRA_MIN,
      ALTURA_BARRA_MIN,
    ]);
  });
});

describe('inicialDiaSemana', () => {
  test('dow ISO 1 a 7', () => {
    expect(inicialDiaSemana(1)).toBe('L');
    expect(inicialDiaSemana(2)).toBe('M');
    expect(inicialDiaSemana(3)).toBe('M');
    expect(inicialDiaSemana(4)).toBe('J');
    expect(inicialDiaSemana(5)).toBe('V');
    expect(inicialDiaSemana(6)).toBe('S');
    expect(inicialDiaSemana(7)).toBe('D');
  });

  test('dow inválido queda vacío', () => {
    expect(inicialDiaSemana(0)).toBe('');
    expect(inicialDiaSemana(8)).toBe('');
    expect(inicialDiaSemana(null)).toBe('');
    expect(inicialDiaSemana('texto')).toBe('');
  });
});

describe('nombreCompletoDiaSemana', () => {
  test('dow ISO 1 a 7', () => {
    expect(nombreCompletoDiaSemana(1)).toBe('Lunes');
    expect(nombreCompletoDiaSemana(5)).toBe('Viernes');
    expect(nombreCompletoDiaSemana(7)).toBe('Domingo');
  });

  test('dow inválido queda vacío', () => {
    expect(nombreCompletoDiaSemana(0)).toBe('');
    expect(nombreCompletoDiaSemana(8)).toBe('');
    expect(nombreCompletoDiaSemana(null)).toBe('');
    expect(nombreCompletoDiaSemana('texto')).toBe('');
  });
});

describe('esFinDeSemana', () => {
  test('sábado y domingo', () => {
    expect(esFinDeSemana(6)).toBe(true);
    expect(esFinDeSemana(7)).toBe(true);
  });

  test('días de semana y valores inválidos', () => {
    expect(esFinDeSemana(1)).toBe(false);
    expect(esFinDeSemana(5)).toBe(false);
    expect(esFinDeSemana(0)).toBe(false);
    expect(esFinDeSemana(null)).toBe(false);
  });
});

describe('esDiaEtiquetaClave', () => {
  test('días clave del mes', () => {
    expect(esDiaEtiquetaClave(1)).toBe(true);
    expect(esDiaEtiquetaClave(5)).toBe(true);
    expect(esDiaEtiquetaClave(10)).toBe(true);
    expect(esDiaEtiquetaClave(15)).toBe(true);
    expect(esDiaEtiquetaClave(20)).toBe(true);
    expect(esDiaEtiquetaClave(25)).toBe(true);
    expect(esDiaEtiquetaClave(30)).toBe(true);
  });

  test('días que no son clave', () => {
    expect(esDiaEtiquetaClave(2)).toBe(false);
    expect(esDiaEtiquetaClave(31)).toBe(false);
  });
});

describe('calcularEscalaEjeY', () => {
  test('máximo 0 usa un solo intervalo hasta $1 mil', () => {
    expect(calcularEscalaEjeY(0)).toEqual({ tope: 1000, marcas: [0, 1000] });
  });

  test('un máximo chico no parte de cero ni divide entre cero', () => {
    expect(calcularEscalaEjeY(220)).toEqual({
      tope: 300,
      marcas: [0, 100, 200, 300],
    });
  });

  test('6497.5 termina en 8 mil con pasos de 2 mil', () => {
    expect(calcularEscalaEjeY(6497.5)).toEqual({
      tope: 8000,
      marcas: [0, 2000, 4000, 6000, 8000],
    });
  });

  test('286877.78 termina en 300 mil', () => {
    expect(calcularEscalaEjeY(286877.78)).toEqual({
      tope: 300000,
      marcas: [0, 100000, 200000, 300000],
    });
  });

  test('un tope ya redondo no salta al siguiente', () => {
    expect(calcularEscalaEjeY(10000)).toEqual({
      tope: 10000,
      marcas: [0, 5000, 10000],
    });
  });

  test('un solo mes positivo cubre ese total', () => {
    const escala = calcularEscalaEjeY(480);
    expect(escala.marcas[0]).toBe(0);
    expect(escala.tope).toBeGreaterThanOrEqual(480);
    expect(escala.marcas[escala.marcas.length - 1]).toBe(escala.tope);
    expect(escala.marcas.every((marca) => Number.isFinite(marca))).toBe(true);
  });

  test('un valor no numérico o negativo no produce NaN', () => {
    expect(calcularEscalaEjeY('abc')).toEqual({ tope: 1000, marcas: [0, 1000] });
    expect(calcularEscalaEjeY(-40)).toEqual({ tope: 1000, marcas: [0, 1000] });
    expect(calcularEscalaEjeY(null)).toEqual({ tope: 1000, marcas: [0, 1000] });
  });
});
