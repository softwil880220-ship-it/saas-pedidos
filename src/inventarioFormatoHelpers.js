export const DECIMALES_INVENTARIO = 2;

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

export function formatearCantidadConUnidadMedida(valor, unidadMedida) {
  const texto = textoCantidadInventario(valor);

  if (texto === '—') {
    return texto;
  }

  return unidadMedida ? `${texto} ${unidadMedida}` : texto;
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
  const texto = formatearDiferenciaInventario(valor);

  if (texto === '—' || !unidadMedida) {
    return texto;
  }

  return `${texto} ${unidadMedida}`;
}
