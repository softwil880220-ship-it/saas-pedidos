import { formatearZonaConTarifa } from './clientesHelpers';
import { formatearMoneda, TIPOS_ENTREGA } from './pedidosShared';

function redondearMoneda(valor) {
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}

export function esLineaFlete(linea) {
  return linea?.es_flete === true;
}

export function buscarLineaFlete(lineas) {
  return (lineas || []).find(esLineaFlete) ?? null;
}

export function quitarLineasFlete(lineas) {
  return (lineas || []).filter((linea) => !esLineaFlete(linea));
}

export function formatearDescripcionLineaFlete({ zonaNombre, monto, manual = false }) {
  const tarifa = formatearMoneda(monto);

  if (manual || !zonaNombre) {
    return `Flete — ${tarifa}`;
  }

  return `Flete: ${zonaNombre} — ${tarifa}`;
}

export function crearLineaFleteCarrito({
  id,
  monto,
  zonaId = null,
  zonaNombre = '',
  manual = false,
}) {
  return {
    id,
    es_flete: true,
    monto: redondearMoneda(monto),
    zona_id: zonaId || null,
    zona_nombre: zonaNombre || '',
    flete_manual: manual,
  };
}

export function calcularDetalleLineaFlete(linea) {
  if (!esLineaFlete(linea)) {
    return null;
  }

  const monto = redondearMoneda(Number(linea.monto ?? linea.subtotal) || 0);
  const zonaNombre = String(linea.zona_nombre ?? '').trim();
  const manual = linea.flete_manual === true || !linea.zona_id;
  const descripcion = formatearDescripcionLineaFlete({
    zonaNombre,
    monto,
    manual,
  });

  return {
    es_flete: true,
    zona_id: linea.zona_id || null,
    flete_manual: manual,
    zona_nombre: zonaNombre || null,
    nombre: 'Flete',
    cantidad: 1,
    unidad_venta: 'pieza',
    precioBase: monto,
    extras: 0,
    precioUnitario: monto,
    precio_unitario: monto,
    subtotal: monto,
    descripcion,
  };
}

export function buscarZonaActivaPorId(zonasActivas, zonaId) {
  if (!zonaId) {
    return null;
  }

  return (
    (zonasActivas || []).find(
      (zona) => String(zona.id) === String(zonaId) && zona.activa !== false
    ) ?? null
  );
}

export function tarifaFleteZonaActiva(zona) {
  if (!zona || zona.activa === false) {
    return null;
  }

  const tarifa = Number(zona.tarifa_flete);
  if (!Number.isFinite(tarifa) || tarifa <= 0) {
    return null;
  }

  return redondearMoneda(tarifa);
}

export function sincronizarLineaFleteAutomatica({
  lineas,
  zonaId,
  zonasActivas,
  tipoEntrega,
  nextLineaId,
  reemplazarManual = true,
}) {
  const sinFlete = quitarLineasFlete(lineas);
  const lineaFleteActual = buscarLineaFlete(lineas);

  if (tipoEntrega !== TIPOS_ENTREGA.DOMICILIO) {
    return { lineas: sinFlete, nextLineaId, cambio: lineas?.length !== sinFlete.length };
  }

  if (lineaFleteActual?.flete_manual && !reemplazarManual) {
    return { lineas, nextLineaId, cambio: false };
  }

  if (!zonaId) {
    return { lineas: sinFlete, nextLineaId, cambio: lineas?.length !== sinFlete.length };
  }

  const zona = buscarZonaActivaPorId(zonasActivas, zonaId);
  const tarifa = tarifaFleteZonaActiva(zona);

  if (tarifa == null) {
    return { lineas: sinFlete, nextLineaId, cambio: lineas?.length !== sinFlete.length };
  }

  const id = nextLineaId;
  const lineaFlete = crearLineaFleteCarrito({
    id,
    monto: tarifa,
    zonaId: zona.id,
    zonaNombre: zona.nombre,
    manual: false,
  });

  return {
    lineas: [...sinFlete, lineaFlete],
    nextLineaId: id + 1,
    cambio: true,
  };
}

export function aplicarLineaFleteManual({ lineas, monto, nextLineaId }) {
  const sinFlete = quitarLineasFlete(lineas);
  const tarifa = redondearMoneda(Number(monto));

  if (!Number.isFinite(tarifa) || tarifa < 0) {
    return { lineas: sinFlete, nextLineaId, cambio: lineas?.length !== sinFlete.length };
  }

  const id = nextLineaId;
  const lineaFlete = crearLineaFleteCarrito({
    id,
    monto: tarifa,
    zonaId: null,
    zonaNombre: '',
    manual: true,
  });

  return {
    lineas: [...sinFlete, lineaFlete],
    nextLineaId: id + 1,
    cambio: true,
  };
}

export function lineaFleteFormularioDesdeDetalle(linea, index) {
  return {
    id: index + 1,
    es_flete: true,
    monto: redondearMoneda(Number(linea.subtotal ?? linea.precioUnitario) || 0),
    zona_id: linea.zona_id || null,
    zona_nombre: linea.zona_nombre || '',
    flete_manual: linea.flete_manual === true || !linea.zona_id,
  };
}

export function etiquetaLineaFleteCarrito(linea) {
  if (!esLineaFlete(linea)) {
    return '';
  }

  return formatearDescripcionLineaFlete({
    zonaNombre: linea.zona_nombre,
    monto: linea.monto,
    manual: linea.flete_manual,
  });
}

export { formatearZonaConTarifa };
