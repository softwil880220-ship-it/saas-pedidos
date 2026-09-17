import { pedidoPerteneceJornada } from './jornadaHelpers';
import { esLineaFlete } from './pedidoFleteHelpers';
import {
  UNIDAD_VENTA_PESO,
  normalizarUnidadVenta,
  parseCantidadPieza,
  parseGramosLinea,
} from './productoUnidadVenta';

function agregarConsumo(mapa, insumoId, delta) {
  const incremento = Number(delta);

  if (!insumoId || !Number.isFinite(incremento) || incremento === 0) {
    return;
  }

  const clave = String(insumoId);
  mapa[clave] = (mapa[clave] || 0) + incremento;
}

function indiceRecetasPorProducto(insumoRecetas) {
  const indice = new Map();

  (insumoRecetas || []).forEach((receta) => {
    const productoId = receta?.producto_id;

    if (productoId == null || productoId === '') {
      return;
    }

    const clave = String(productoId);
    const filas = indice.get(clave);

    if (filas) {
      filas.push(receta);
      return;
    }

    indice.set(clave, [receta]);
  });

  return indice;
}

function indiceRecetasPorVariante(insumoRecetasVariantes) {
  const indice = new Map();

  (insumoRecetasVariantes || []).forEach((receta) => {
    const itemVarianteId = receta?.item_variante_id;

    if (itemVarianteId == null || itemVarianteId === '') {
      return;
    }

    const clave = String(itemVarianteId);
    const filas = indice.get(clave);

    if (filas) {
      filas.push(receta);
      return;
    }

    indice.set(clave, [receta]);
  });

  return indice;
}

function factorConsumoProducto({ unidadVenta, cantidad }) {
  if (normalizarUnidadVenta(unidadVenta) === UNIDAD_VENTA_PESO) {
    const gramos = parseGramosLinea(cantidad);

    if (gramos <= 0) {
      return 0;
    }

    return gramos / 1000;
  }

  return parseCantidadPieza(cantidad);
}

function multiplicadorConsumoVariantes({ unidadVenta, cantidad }) {
  if (normalizarUnidadVenta(unidadVenta) === UNIDAD_VENTA_PESO) {
    return 1;
  }

  return parseCantidadPieza(cantidad);
}

function listarItemVarianteIds(variantes) {
  if (!variantes || typeof variantes !== 'object') {
    return [];
  }

  const ids = [];

  Object.values(variantes).forEach((valores) => {
    if (!Array.isArray(valores)) {
      return;
    }

    valores.forEach((id) => {
      if (id == null || id === '') {
        return;
      }

      ids.push(String(id));
    });
  });

  return ids;
}

function acumularConsumoLinea(
  linea,
  mapa,
  recetasPorProducto,
  recetasPorVariante
) {
  const productoId = linea?.productoId ?? linea?.producto_id;

  if (productoId == null || productoId === '') {
    return;
  }

  const unidadVenta = linea?.unidad_venta ?? linea?.unidadVenta;
  const cantidad = linea?.cantidad;
  const factor = factorConsumoProducto({ unidadVenta, cantidad });

  if (factor > 0) {
    const recetasBase = recetasPorProducto.get(String(productoId)) || [];

    recetasBase.forEach((receta) => {
      const cantidadPorProducto = Number(receta?.cantidad_por_producto);

      if (!Number.isFinite(cantidadPorProducto)) {
        return;
      }

      agregarConsumo(mapa, receta.insumo_id, factor * cantidadPorProducto);
    });
  }

  const multiplicador = multiplicadorConsumoVariantes({ unidadVenta, cantidad });

  if (multiplicador <= 0) {
    return;
  }

  listarItemVarianteIds(linea?.variantes).forEach((itemVarianteId) => {
    const recetasExtra = recetasPorVariante.get(itemVarianteId) || [];

    recetasExtra.forEach((receta) => {
      const cantidadPorExtra = Number(receta?.cantidad_por_extra);

      if (!Number.isFinite(cantidadPorExtra)) {
        return;
      }

      agregarConsumo(mapa, receta.insumo_id, multiplicador * cantidadPorExtra);
    });
  });
}

function acumularConsumoRegistro(
  registro,
  mapa,
  recetasPorProducto,
  recetasPorVariante
) {
  const productoId = registro?.producto_id ?? registro?.productoId;
  const unidadVenta =
    registro?.productos?.unidad_venta ??
    registro?.unidad_venta ??
    registro?.unidadVenta;

  acumularConsumoLinea(
    {
      productoId,
      cantidad: registro?.cantidad,
      unidad_venta: unidadVenta,
      variantes: registro?.variantes,
    },
    mapa,
    recetasPorProducto,
    recetasPorVariante
  );
}

export function calcularCargaInicial(cargas, insumoId) {
  if (!insumoId) {
    return 0;
  }

  const claveInsumo = String(insumoId);

  return (cargas || []).reduce((suma, carga) => {
    if (carga?.deleted_at != null) {
      return suma;
    }

    if (String(carga?.insumo_id) !== claveInsumo) {
      return suma;
    }

    const cantidad = Number(carga?.cantidad);

    if (!Number.isFinite(cantidad)) {
      return suma;
    }

    return suma + cantidad;
  }, 0);
}

export function calcularCargaInicialPorInsumos(cargas) {
  const mapa = {};

  (cargas || []).forEach((carga) => {
    if (carga?.deleted_at != null || carga?.insumo_id == null) {
      return;
    }

    const cantidad = Number(carga?.cantidad);

    if (!Number.isFinite(cantidad)) {
      return;
    }

    const clave = String(carga.insumo_id);
    mapa[clave] = (mapa[clave] || 0) + cantidad;
  });

  return mapa;
}

export function calcularConsumoVenta(
  pedidos,
  jornada,
  insumoRecetas,
  insumoRecetasVariantes
) {
  const mapa = {};
  const recetasPorProducto = indiceRecetasPorProducto(insumoRecetas);
  const recetasPorVariante = indiceRecetasPorVariante(insumoRecetasVariantes);

  (pedidos || []).forEach((pedido) => {
    if (pedido?.deleted_at != null) {
      return;
    }

    if (!pedidoPerteneceJornada(pedido, jornada)) {
      return;
    }

    const lineas = Array.isArray(pedido?.lineas_detalle) ? pedido.lineas_detalle : [];

    lineas.forEach((linea) => {
      if (esLineaFlete(linea) || linea?.es_flete === true) {
        return;
      }

      acumularConsumoLinea(linea, mapa, recetasPorProducto, recetasPorVariante);
    });
  });

  return mapa;
}

export function calcularConsumoEmpleados(
  consumosInternos,
  insumoRecetas,
  insumoRecetasVariantes
) {
  const mapa = {};
  const recetasPorProducto = indiceRecetasPorProducto(insumoRecetas);
  const recetasPorVariante = indiceRecetasPorVariante(insumoRecetasVariantes);

  (consumosInternos || []).forEach((consumo) => {
    if (consumo?.deleted_at != null) {
      return;
    }

    acumularConsumoRegistro(consumo, mapa, recetasPorProducto, recetasPorVariante);
  });

  return mapa;
}

export function calcularTeorico(cargaInicial, consumoVenta, consumoEmpleados) {
  const cargas = cargaInicial || {};
  const ventas = consumoVenta || {};
  const empleados = consumoEmpleados || {};
  const insumoIds = new Set([
    ...Object.keys(cargas),
    ...Object.keys(ventas),
    ...Object.keys(empleados),
  ]);
  const teorico = {};

  insumoIds.forEach((insumoId) => {
    teorico[insumoId] =
      (Number(cargas[insumoId]) || 0) -
      (Number(ventas[insumoId]) || 0) -
      (Number(empleados[insumoId]) || 0);
  });

  return teorico;
}

export function calcularDiferencia(contadoFisico, mermaExplicada, teorico) {
  const contados = contadoFisico || {};
  const mermas = mermaExplicada || {};
  const teoricos = teorico || {};
  const insumoIds = new Set([
    ...Object.keys(contados),
    ...Object.keys(mermas),
    ...Object.keys(teoricos),
  ]);
  const diferencia = {};

  insumoIds.forEach((insumoId) => {
    diferencia[insumoId] =
      (Number(contados[insumoId]) || 0) +
      (Number(mermas[insumoId]) || 0) -
      (Number(teoricos[insumoId]) || 0);
  });

  return diferencia;
}
