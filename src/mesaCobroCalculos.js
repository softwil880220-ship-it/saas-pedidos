import { redondearMoneda } from './pedidoCarritoCalculos';

export const TIPOS_AJUSTE_MONETARIO = {
  PORCENTAJE: 'porcentaje',
  MONTO_FIJO: 'monto_fijo',
};

const ROLES_CON_DESCUENTO_MESA = new Set(['dueno', 'administrador']);

export function puedeAplicarDescuentoMesaCobro(rol) {
  return rol != null && ROLES_CON_DESCUENTO_MESA.has(rol);
}

function claveConsolidacionLinea(linea) {
  const productoId = linea?.productoId != null ? String(linea.productoId) : '';
  const descripcion = String(linea?.descripcion ?? '').trim();
  return `${productoId}|${descripcion}`;
}

export function consolidarProductosRondasMesa(rondas) {
  const mapa = new Map();

  (rondas || []).forEach((ronda) => {
    const lineas = Array.isArray(ronda?.lineas_detalle) ? ronda.lineas_detalle : [];

    lineas.forEach((linea) => {
      const clave = claveConsolidacionLinea(linea);
      const cantidad = Math.max(1, parseInt(linea?.cantidad, 10) || 1);
      const subtotal = redondearMoneda(Number(linea?.subtotal) || 0);

      if (mapa.has(clave)) {
        const existente = mapa.get(clave);
        mapa.set(clave, {
          ...existente,
          cantidad: existente.cantidad + cantidad,
          subtotal: redondearMoneda(existente.subtotal + subtotal),
        });
        return;
      }

      mapa.set(clave, {
        productoId: linea?.productoId != null ? String(linea.productoId) : '',
        descripcion: String(linea?.descripcion ?? '').trim(),
        cantidad,
        subtotal,
      });
    });
  });

  return [...mapa.values()].sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es'));
}

export function calcularSubtotalConsolidadoMesa(productosConsolidados) {
  return redondearMoneda(
    (productosConsolidados || []).reduce((suma, item) => suma + Number(item.subtotal || 0), 0)
  );
}

export function calcularMontoDescuentoMesa({
  subtotal,
  tipo,
  valor,
  puedeAplicarDescuento,
}) {
  if (!puedeAplicarDescuento || !tipo) {
    return 0;
  }

  const valorNumerico = Number(valor);
  if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
    return 0;
  }

  if (tipo === TIPOS_AJUSTE_MONETARIO.PORCENTAJE) {
    return redondearMoneda(Math.min(subtotal, subtotal * (valorNumerico / 100)));
  }

  if (tipo === TIPOS_AJUSTE_MONETARIO.MONTO_FIJO) {
    return redondearMoneda(Math.min(subtotal, valorNumerico));
  }

  return 0;
}

export function calcularMontoPropinaMesa({
  subtotal,
  tipo,
  valor,
  montoExactoActivo,
  montoExacto,
}) {
  if (montoExactoActivo) {
    const monto = Number(montoExacto);
    if (!Number.isFinite(monto) || monto < 0) {
      return 0;
    }

    return redondearMoneda(monto);
  }

  if (tipo !== TIPOS_AJUSTE_MONETARIO.PORCENTAJE) {
    return 0;
  }

  const valorNumerico = Number(valor);
  if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
    return 0;
  }

  return redondearMoneda(subtotal * (valorNumerico / 100));
}

export function calcularTotalCobroMesa({ subtotal, descuentoMontoAplicado, propinaMontoAplicado }) {
  return redondearMoneda(
    Math.max(0, subtotal - descuentoMontoAplicado + propinaMontoAplicado)
  );
}
