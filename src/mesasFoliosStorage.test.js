jest.mock('./supabase', () => ({
  supabase: {},
}));

import {
  debeIgnorarActualizacionRemotaCarrito,
  registrarSnapshotFlushPropio,
  registrarSnapshotLocalActivo,
  resetEstadoEcoCarritoMesasParaTests,
  serializarSnapshotParaComparacion,
} from './mesasFoliosStorage';

const FOLIO = 'folio-1';

function snapshotConCantidad(cantidad) {
  return {
    form: {
      lineas: [
        {
          id: 1,
          productoId: 'p1',
          cantidad: String(cantidad),
          variantes: {},
        },
      ],
    },
    pagoRecibido: '',
    nextLineaId: 2,
  };
}

function snapshotPesoConCantidad(cantidad, { id = null, nextLineaId = 2 } = {}) {
  const cantidadStr = String(cantidad);

  return {
    form: {
      lineas: [
        {
          id: id ?? `peso:p1::${cantidadStr}`,
          productoId: 'p1',
          cantidad: cantidadStr,
          variantes: {},
        },
      ],
    },
    pagoRecibido: '',
    nextLineaId,
  };
}

describe('debeIgnorarActualizacionRemotaCarrito', () => {
  beforeEach(() => {
    resetEstadoEcoCarritoMesasParaTests();
  });

  test('devuelve true cuando incomingSer es igual a localSer', () => {
    const snapshot = snapshotConCantidad('500');

    registrarSnapshotLocalActivo(FOLIO, snapshot);

    expect(debeIgnorarActualizacionRemotaCarrito(FOLIO, snapshot)).toBe(true);
  });

  test('devuelve true cuando incoming es eco flush propio mas viejo que local', () => {
    const snapshotViejo = snapshotConCantidad('5');
    const snapshotNuevo = snapshotConCantidad('50');

    registrarSnapshotLocalActivo(FOLIO, snapshotNuevo);
    registrarSnapshotFlushPropio(FOLIO, snapshotViejo);

    expect(debeIgnorarActualizacionRemotaCarrito(FOLIO, snapshotViejo)).toBe(true);
  });

  test('devuelve false cuando incoming difiere y no es eco flush propio', () => {
    const snapshotLocal = snapshotConCantidad('50');
    const snapshotRemoto = snapshotConCantidad('500');

    registrarSnapshotLocalActivo(FOLIO, snapshotLocal);

    expect(debeIgnorarActualizacionRemotaCarrito(FOLIO, snapshotRemoto)).toBe(false);
  });

  test('la cola de flush propio desliza tras K entradas', () => {
    const snapshotLocal = snapshotConCantidad('999');

    registrarSnapshotLocalActivo(FOLIO, snapshotLocal);

    for (let cantidad = 1; cantidad <= 7; cantidad += 1) {
      registrarSnapshotFlushPropio(FOLIO, snapshotConCantidad(cantidad));
    }

    expect(debeIgnorarActualizacionRemotaCarrito(FOLIO, snapshotConCantidad('1'))).toBe(
      false
    );
    expect(debeIgnorarActualizacionRemotaCarrito(FOLIO, snapshotConCantidad('2'))).toBe(
      false
    );
    expect(debeIgnorarActualizacionRemotaCarrito(FOLIO, snapshotConCantidad('3'))).toBe(
      true
    );
    expect(debeIgnorarActualizacionRemotaCarrito(FOLIO, snapshotConCantidad('7'))).toBe(
      true
    );
  });

  test('localSerOverride ignora eco propio aunque el Map siga con valor desfasado', () => {
    const snapshot200 = snapshotConCantidad('200');
    const snapshot20 = snapshotConCantidad('20');

    registrarSnapshotLocalActivo(FOLIO, snapshot200);
    registrarSnapshotFlushPropio(FOLIO, snapshot200);

    expect(debeIgnorarActualizacionRemotaCarrito(FOLIO, snapshot200)).toBe(true);

    const localSerSincrono = serializarSnapshotParaComparacion(snapshot20);

    expect(
      debeIgnorarActualizacionRemotaCarrito(FOLIO, snapshot200, localSerSincrono)
    ).toBe(true);
  });

  test('localSerOverride refleja re-edicion antes de que corra cualquier efecto', () => {
    const snapshot200 = snapshotConCantidad('200');
    const snapshot20 = snapshotConCantidad('20');
    const snapshot206 = snapshotConCantidad('206');

    registrarSnapshotLocalActivo(FOLIO, snapshot200);

    const localSerSincrono = serializarSnapshotParaComparacion(snapshot20);

    expect(debeIgnorarActualizacionRemotaCarrito(FOLIO, snapshot206, localSerSincrono)).toBe(
      false
    );

    registrarSnapshotFlushPropio(FOLIO, snapshot200);

    expect(
      debeIgnorarActualizacionRemotaCarrito(FOLIO, snapshot200, localSerSincrono)
    ).toBe(true);
  });
});

describe('debeIgnorarActualizacionRemotaCarrito — comparacion semantica', () => {
  beforeEach(() => {
    resetEstadoEcoCarritoMesasParaTests();
  });

  test('rama A: mismos gramos con id distinto se ignoran', () => {
    const local = snapshotPesoConCantidad('200', { id: 'peso:p1::200' });
    const incoming = snapshotPesoConCantidad('200', {
      id: 'peso:p1::200-stale',
      nextLineaId: 9,
    });

    registrarSnapshotLocalActivo(FOLIO, local);

    expect(debeIgnorarActualizacionRemotaCarrito(FOLIO, incoming)).toBe(true);
  });

  test('rama C: eco peso obsoleto fuera de cola JSON se ignora (206 espurio)', () => {
    const local = snapshotPesoConCantidad('206');
    const incoming = snapshotPesoConCantidad('200');

    registrarSnapshotLocalActivo(FOLIO, local);
    registrarSnapshotFlushPropio(FOLIO, snapshotPesoConCantidad('200', { nextLineaId: 2 }));

    for (let nextLineaId = 3; nextLineaId <= 8; nextLineaId += 1) {
      registrarSnapshotFlushPropio(
        FOLIO,
        snapshotPesoConCantidad('200', { nextLineaId })
      );
    }

    expect(debeIgnorarActualizacionRemotaCarrito(FOLIO, incoming)).toBe(true);
  });

  test('rama C: remoto legitimo no se ignora si el gramo no esta en anillo propio', () => {
    const local = snapshotPesoConCantidad('50');
    const incoming = snapshotPesoConCantidad('500');

    registrarSnapshotLocalActivo(FOLIO, local);

    expect(debeIgnorarActualizacionRemotaCarrito(FOLIO, incoming)).toBe(false);
  });

  test('rama C + localSerOverride: ignora eco obsoleto aunque el Map siga desfasado', () => {
    const mapSnapshot = snapshotPesoConCantidad('200');
    const localOverride = snapshotPesoConCantidad('206');
    const incoming = snapshotPesoConCantidad('200');

    registrarSnapshotLocalActivo(FOLIO, mapSnapshot);
    registrarSnapshotFlushPropio(FOLIO, snapshotPesoConCantidad('200'));

    const localSerSincrono = serializarSnapshotParaComparacion(localOverride);

    expect(
      debeIgnorarActualizacionRemotaCarrito(FOLIO, incoming, localSerSincrono)
    ).toBe(true);
  });
});
