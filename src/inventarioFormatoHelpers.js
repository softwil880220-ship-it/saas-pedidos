export const DECIMALES_INVENTARIO = 2;

/** Pluralización explícita por unidad normalizada (minúsculas). Añadir unidades aquí. */
export const MAPA_PLURAL_UNIDAD_MEDIDA = {
  pieza: 'piezas',
  g: 'g',
  ml: 'ml',
};

export function redondearCantidadInventario(valor, decimales = DECIMALES_INVENTARIO) {
  if (valor === '' || valor == null) {
    return null;
  }

  const cantidad = Number(valor);

  if (!Number.isFinite(cantidad)) {
    return null;
  }

  const factor = 10 ** decimales;
  return Math.round((cantidad + Number.EPSILON) * factor) / factor;
}

export function textoCantidadInventario(valor) {
  const cantidad = redondearCantidadInventario(valor);

  if (cantidad == null) {
    return '—';
  }

  return Number.isInteger(cantidad)
    ? String(cantidad)
    : cantidad.toFixed(DECIMALES_INVENTARIO);
}

function esCantidadSingularInventario(cantidadNumerica) {
  return (
    cantidadNumerica != null &&
    Number.isInteger(cantidadNumerica) &&
    Math.abs(cantidadNumerica) === 1
  );
}

export function resolverEtiquetaUnidadMedida(unidadMedida, cantidadNumerica) {
  if (unidadMedida == null) {
    return '';
  }

  const original = String(unidadMedida).trim();

  if (!original) {
    return '';
  }

  const clave = original.toLowerCase();

  if (!Object.prototype.hasOwnProperty.call(MAPA_PLURAL_UNIDAD_MEDIDA, clave)) {
    return original;
  }

  if (clave === 'pieza') {
    return esCantidadSingularInventario(cantidadNumerica) ? 'pieza' : 'piezas';
  }

  return MAPA_PLURAL_UNIDAD_MEDIDA[clave];
}

export function formatearEtiquetaCantidadPiezas(cantidadNumerica) {
  if (cantidadNumerica == null) {
    return '—';
  }

  if (cantidadNumerica === 1) {
    return '1 pieza';
  }

  return `${textoCantidadInventario(cantidadNumerica)} piezas`;
}

export function formatearCantidadConUnidadMedida(valor, unidadMedida) {
  const cantidadNumerica = redondearCantidadInventario(valor);
  const texto = textoCantidadInventario(valor);

  if (texto === '—') {
    return texto;
  }

  const etiquetaUnidad = resolverEtiquetaUnidadMedida(unidadMedida, cantidadNumerica);

  return etiquetaUnidad ? `${texto} ${etiquetaUnidad}` : texto;
}

export function formatearDiferenciaInventario(valor) {
  const cantidad = redondearCantidadInventario(valor);

  if (cantidad == null) {
    return '—';
  }

  const signo = cantidad > 0 ? '+' : '';
  return `${signo}${textoCantidadInventario(cantidad)}`;
}

export function formatearDiferenciaConUnidadMedida(valor, unidadMedida) {
  const cantidadNumerica = redondearCantidadInventario(valor);
  const texto = formatearDiferenciaInventario(valor);

  if (texto === '—') {
    return texto;
  }

  const etiquetaUnidad = resolverEtiquetaUnidadMedida(unidadMedida, cantidadNumerica);

  if (!etiquetaUnidad) {
    return texto;
  }

  return `${texto} ${etiquetaUnidad}`;
}
