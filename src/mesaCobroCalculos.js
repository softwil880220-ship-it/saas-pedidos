import { redondearMoneda } from './pedidoCarritoCalculos';
import {
  UNIDAD_VENTA_PESO,
  calcularSubtotalPorUnidadVenta,
  esProductoPorPeso,
  formatearDescripcionLineaPesoSinPrecio,
  normalizarUnidadVenta,
  parseCantidadPieza,
  parseGramosLinea,
} from './productoUnidadVenta';

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
  const unidadVenta = normalizarUnidadVenta(linea?.unidad_venta);
  const extras = redondearMoneda(Number(linea?.extras) || 0);
  const precioUnitarioGuardado = Number(linea?.precioUnitario ?? linea?.precio_unitario);
  const precioBaseGuardado = Number(linea?.precioBase);
  const precioBase = Number.isFinite(precioBaseGuardado)
    ? redondearMoneda(precioBaseGuardado)
    : Number.isFinite(precioUnitarioGuardado)
      ? redondearMoneda(precioUnitarioGuardado - extras)
      : 0;
  const nombre = extraerNombreBase(linea?.descripcion, linea?.nombre);
  const etiquetaVariantes = extras > 0 ? extraerEtiquetaVariantes(linea?.descripcion) : null;

  if (unidadVenta === UNIDAD_VENTA_PESO) {
    const cantidad = parseGramosLinea(linea?.cantidad);
    const precioUnitario = Number.isFinite(precioUnitarioGuardado)
      ? redondearMoneda(precioUnitarioGuardado)
      : redondearMoneda(precioBase + extras);
    const subtotal = redondearMoneda(
      Number(linea?.subtotal) ||
        calcularSubtotalPorUnidadVenta({
          unidadVenta,
          cantidad,
          precioUnitario,
        })
    );
    const subtotalBase = calcularSubtotalPorUnidadVenta({
      unidadVenta,
      cantidad,
      precioUnitario: precioBase,
    });
    const subtotalExtras = redondearMoneda(subtotal - subtotalBase);

    return {
      productoId: linea?.productoId != null ? String(linea.productoId) : '',
      nombre,
      cantidad,
      unidad_venta: unidadVenta,
      precioUnitario: precioBase,
      subtotal,
      subtotalBase,
      subtotalExtras,
      etiquetaVariantes,
      tieneVariantes: extras > 0,
      textoLinea: formatearDescripcionLineaPesoSinPrecio({
        nombre,
        cantidad,
      }),
    };
  }

  const cantidad = parseCantidadPieza(linea?.cantidad);
  const precioBasePieza = Number.isFinite(precioBaseGuardado)
    ? redondearMoneda(precioBaseGuardado)
    : Number.isFinite(precioUnitarioGuardado)
      ? redondearMoneda(precioUnitarioGuardado - extras)
      : redondearMoneda((Number(linea?.subtotal) || 0) / cantidad - extras);

  const subtotal = redondearMoneda(
    Number(linea?.subtotal) || precioBasePieza * cantidad + extras * cantidad
  );
  const subtotalBase = redondearMoneda(precioBasePieza * cantidad);
  const subtotalExtras = redondearMoneda(subtotal - subtotalBase);

  return {
    productoId: linea?.productoId != null ? String(linea.productoId) : '',
    nombre,
    cantidad,
    unidad_venta: unidadVenta,
    precioUnitario: precioBasePieza,
    subtotal,
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

function claveBaseAsociadaAVariante(claveVariante) {
  if (!String(claveVariante).startsWith('variante|')) {
    return null;
  }

  const partes = String(claveVariante).split('|');
  if (partes.length < 5) {
    return null;
  }

  return `base|${partes[1]}|${partes[2]}|${partes[3]}`;
}

function indiceInsercionGrupoNuevo(ordenClaves, clave, linea) {
  const claveBase = claveLineaBase(linea);

  if (linea.tieneVariantes) {
    const indiceBase = ordenClaves.indexOf(claveBase);
    if (indiceBase < 0) {
      return ordenClaves.length;
    }

    let insertarEn = indiceBase + 1;
    while (
      insertarEn < ordenClaves.length &&
      claveBaseAsociadaAVariante(ordenClaves[insertarEn]) === claveBase
    ) {
      insertarEn += 1;
    }

    return insertarEn;
  }

  const indicePrimeraVariante = ordenClaves.findIndex(
    (claveOrden) => claveBaseAsociadaAVariante(claveOrden) === clave
  );

  if (indicePrimeraVariante >= 0) {
    return indicePrimeraVariante;
  }

  return ordenClaves.length;
}

function registrarGrupoConsolidado(ordenClaves, gruposPorClave, clave, grupo, linea) {
  if (gruposPorClave.has(clave)) {
    gruposPorClave.set(clave, grupo);
    return;
  }

  gruposPorClave.set(clave, grupo);
  const indice = indiceInsercionGrupoNuevo(ordenClaves, clave, linea);
  ordenClaves.splice(indice, 0, clave);
}

export function consolidarProductosRondasMesa(rondas) {
  const gruposPorClave = new Map();
  const ordenClaves = [];

  (rondas || []).forEach((ronda) => {
    const lineas = Array.isArray(ronda?.lineas_detalle) ? ronda.lineas_detalle : [];

    lineas.forEach((lineaCruda) => {
      const linea = normalizarLineaDetalleCobro(lineaCruda);

      if (linea.tieneVariantes) {
        const clave = claveLineaConVariantes(linea);
        const existente = gruposPorClave.get(clave);

        if (existente) {
          registrarGrupoConsolidado(ordenClaves, gruposPorClave, clave, {
            ...existente,
            cantidad: existente.cantidad + linea.cantidad,
            subtotal: redondearMoneda(Number(existente.subtotal || 0) + Number(linea.subtotal || 0)),
            subtotalBase: redondearMoneda(existente.subtotalBase + linea.subtotalBase),
            textoLinea: esProductoPorPeso(linea)
              ? formatearDescripcionLineaPesoSinPrecio({
                  nombre: linea.nombre,
                  cantidad: existente.cantidad + linea.cantidad,
                })
              : existente.textoLinea,
            extrasLineas: [
              {
                etiqueta: existente.extrasLineas[0].etiqueta,
                subtotal: redondearMoneda(
                  existente.extrasLineas[0].subtotal + linea.subtotalExtras
                ),
              },
            ],
          }, linea);
          return;
        }

        registrarGrupoConsolidado(ordenClaves, gruposPorClave, clave, {
          clave,
          nombre: linea.nombre,
          cantidad: linea.cantidad,
          unidad_venta: linea.unidad_venta,
          precioUnitario: linea.precioUnitario,
          subtotal: linea.subtotal,
          subtotalBase: linea.subtotalBase,
          textoLinea: linea.textoLinea,
          extrasLineas: [
            {
              etiqueta: linea.etiquetaVariantes || 'Extra',
              subtotal: linea.subtotalExtras,
            },
          ],
        }, linea);
        return;
      }

      const clave = claveLineaBase(linea);
      const existente = gruposPorClave.get(clave);

      if (existente) {
        registrarGrupoConsolidado(ordenClaves, gruposPorClave, clave, {
          ...existente,
          cantidad: existente.cantidad + linea.cantidad,
          subtotal: redondearMoneda(Number(existente.subtotal || 0) + Number(linea.subtotal || 0)),
          subtotalBase: redondearMoneda(existente.subtotalBase + linea.subtotalBase),
          textoLinea: esProductoPorPeso(linea)
            ? formatearDescripcionLineaPesoSinPrecio({
                nombre: linea.nombre,
                cantidad: existente.cantidad + linea.cantidad,
              })
            : existente.textoLinea,
        }, linea);
        return;
      }

      registrarGrupoConsolidado(ordenClaves, gruposPorClave, clave, {
        clave,
        nombre: linea.nombre,
        cantidad: linea.cantidad,
        unidad_venta: linea.unidad_venta,
        precioUnitario: linea.precioUnitario,
        subtotal: linea.subtotal,
        subtotalBase: linea.subtotalBase,
        textoLinea: linea.textoLinea,
        extrasLineas: [],
      }, linea);
    });
  });

  return ordenClaves.map((clave) => gruposPorClave.get(clave));
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
