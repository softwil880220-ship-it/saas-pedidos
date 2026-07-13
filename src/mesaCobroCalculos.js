import { redondearMoneda } from './pedidoCarritoCalculos';

export const TIPOS_AJUSTE_MONETARIO = {
  PORCENTAJE: 'porcentaje',
  MONTO_FIJO: 'monto_fijo',
};

const ROLES_CON_DESCUENTO_MESA = new Set(['dueno', 'administrador']);

export function puedeAplicarDescuentoMesaCobro(rol) {
  return rol != null && ROLES_CON_DESCUENTO_MESA.has(rol);
}

function extraerNombreBase(descripcion, nombreLinea) {
  const nombre = String(nombreLinea ?? '').trim();
  if (nombre) {
    return nombre;
  }

  const texto = String(descripcion ?? '').trim();
  const indiceVariantes = texto.indexOf(' (');
  return indiceVariantes >= 0 ? texto.slice(0, indiceVariantes).trim() : texto;
}

function extraerEtiquetaVariantes(descripcion) {
  const texto = String(descripcion ?? '').trim();
  const coincidencia = texto.match(/\(([^)]+)\)\s*$/);
  if (!coincidencia) {
    return null;
  }

  return coincidencia[1].trim() || null;
}

function normalizarLineaDetalleCobro(linea) {
  const cantidad = Math.max(1, parseInt(linea?.cantidad, 10) || 1);
  const extras = redondearMoneda(Number(linea?.extras) || 0);
  const precioUnitarioGuardado = Number(linea?.precioUnitario ?? linea?.precio_unitario);
  const precioBaseGuardado = Number(linea?.precioBase);
  const precioBase = Number.isFinite(precioBaseGuardado)
    ? redondearMoneda(precioBaseGuardado)
    : Number.isFinite(precioUnitarioGuardado)
      ? redondearMoneda(precioUnitarioGuardado - extras)
      : redondearMoneda((Number(linea?.subtotal) || 0) / cantidad - extras);

  const subtotal = redondearMoneda(Number(linea?.subtotal) || precioBase * cantidad + extras * cantidad);
  const subtotalBase = redondearMoneda(precioBase * cantidad);
  const subtotalExtras = redondearMoneda(subtotal - subtotalBase);
  const nombre = extraerNombreBase(linea?.descripcion, linea?.nombre);
  const etiquetaVariantes = extras > 0 ? extraerEtiquetaVariantes(linea?.descripcion) : null;

  return {
    productoId: linea?.productoId != null ? String(linea.productoId) : '',
    nombre,
    cantidad,
    precioUnitario: precioBase,
    subtotalBase,
    subtotalExtras,
    etiquetaVariantes,
    tieneVariantes: extras > 0,
  };
}

function claveLineaBase({ productoId, nombre, precioUnitario }) {
  return `base|${productoId}|${nombre}|${precioUnitario}`;
}

function claveLineaConVariantes({ productoId, nombre, precioUnitario, etiquetaVariantes }) {
  return `variante|${productoId}|${nombre}|${precioUnitario}|${etiquetaVariantes ?? ''}`;
}

export function consolidarProductosRondasMesa(rondas) {
  const mapaBase = new Map();
  const mapaVariantes = new Map();

  (rondas || []).forEach((ronda) => {
    const lineas = Array.isArray(ronda?.lineas_detalle) ? ronda.lineas_detalle : [];

    lineas.forEach((lineaCruda) => {
      const linea = normalizarLineaDetalleCobro(lineaCruda);

      if (linea.tieneVariantes) {
        const clave = claveLineaConVariantes(linea);
        const existente = mapaVariantes.get(clave);

        if (existente) {
          mapaVariantes.set(clave, {
            ...existente,
            cantidad: existente.cantidad + linea.cantidad,
            subtotalBase: redondearMoneda(existente.subtotalBase + linea.subtotalBase),
            extrasLineas: [
              {
                etiqueta: existente.extrasLineas[0].etiqueta,
                subtotal: redondearMoneda(
                  existente.extrasLineas[0].subtotal + linea.subtotalExtras
                ),
              },
            ],
          });
          return;
        }

        mapaVariantes.set(clave, {
          clave,
          nombre: linea.nombre,
          cantidad: linea.cantidad,
          precioUnitario: linea.precioUnitario,
          subtotalBase: linea.subtotalBase,
          extrasLineas: [
            {
              etiqueta: linea.etiquetaVariantes || 'Extra',
              subtotal: linea.subtotalExtras,
            },
          ],
        });
        return;
      }

      const clave = claveLineaBase(linea);
      const existente = mapaBase.get(clave);

      if (existente) {
        mapaBase.set(clave, {
          ...existente,
          cantidad: existente.cantidad + linea.cantidad,
          subtotalBase: redondearMoneda(existente.subtotalBase + linea.subtotalBase),
        });
        return;
      }

      mapaBase.set(clave, {
        clave,
        nombre: linea.nombre,
        cantidad: linea.cantidad,
        precioUnitario: linea.precioUnitario,
        subtotalBase: linea.subtotalBase,
        extrasLineas: [],
      });
    });
  });

  return [...mapaBase.values(), ...mapaVariantes.values()].sort((a, b) =>
    a.nombre.localeCompare(b.nombre, 'es')
  );
}

export function calcularSubtotalConsolidadoMesa(productosConsolidados) {
  return redondearMoneda(
    (productosConsolidados || []).reduce((suma, grupo) => {
      const totalExtras = (grupo.extrasLineas || []).reduce(
        (acumulado, extra) => acumulado + Number(extra.subtotal || 0),
        0
      );

      return suma + Number(grupo.subtotalBase || 0) + totalExtras;
    }, 0)
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
