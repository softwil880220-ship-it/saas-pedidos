import {
  redondearCantidadInventario,
  textoCantidadInventario,
} from './inventarioFormatoHelpers';
import { esProductoPorPeso } from './productoUnidadVenta';
import { formatearClaveFecha } from './pedidosShared';
import {
  consultarRegistrosReportePaginados,
  descripcionPeriodoTarjeta,
  fechasPeriodoTarjeta,
  filtrarPorPeriodoCreatedAt,
  formatearEtiquetaJornadaFocoReporte,
  rangoFechasInvalido,
} from './reportesHelpers';
import { formatearLineaResumen } from './variantesDinamicas';
import { queryConNegocio } from './tenantHelpers';

const SELECT_CONSUMO_INTERNO_REPORTE =
  'id, jornada_id, empleado_id, producto_id, cantidad, variantes, created_at, deleted_at';

const SELECT_SNAPSHOTS_INVENTARIO_REPORTE =
  'id, created_at, autorizado_por, creado_por, detalle, jornada_id';

export function fechasRangoDesdeJornadaAbierta(jornada) {
  if (!jornada?.abierta_en) {
    return { fechaDesde: '', fechaHasta: '' };
  }

  return {
    fechaDesde: formatearClaveFecha(new Date(jornada.abierta_en)),
    fechaHasta: formatearClaveFecha(new Date()),
  };
}

export function inventarioReportePeriodoActivo({
  jornadaFocoId = null,
  rangoInvalido = false,
} = {}) {
  if (jornadaFocoId) {
    return true;
  }

  return !rangoInvalido;
}

export function deduplicarConsumosInternosPorId(consumos) {
  const vistos = new Set();
  const unicos = [];

  (consumos || []).forEach((consumo) => {
    const id = consumo?.id;

    if (id == null || vistos.has(String(id))) {
      return;
    }

    vistos.add(String(id));
    unicos.push(consumo);
  });

  return unicos;
}

function normalizarVariantesConsumo(variantes) {
  if (!variantes || typeof variantes !== 'object') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(variantes).filter(
      ([, ids]) => Array.isArray(ids) && ids.length > 0
    )
  );
}

function serializarVariantesConsumo(variantes) {
  const normalizado = normalizarVariantesConsumo(variantes);

  if (Object.keys(normalizado).length === 0) {
    return '{}';
  }

  return JSON.stringify(
    Object.fromEntries(
      Object.entries(normalizado)
        .sort(([a], [b]) => String(a).localeCompare(String(b), 'es'))
        .map(([categoriaId, ids]) => [
          categoriaId,
          [...ids].sort((a, b) => String(a).localeCompare(String(b), 'es')),
        ])
    )
  );
}

export function enriquecerConsumosInternosReporte(
  consumos,
  productosPorId = {},
  empleadosPorId = {}
) {
  return deduplicarConsumosInternosPorId(consumos).map((consumo) => ({
    ...consumo,
    productos: productosPorId[String(consumo.producto_id)] || null,
    empleados: empleadosPorId[String(consumo.empleado_id)] || null,
  }));
}

export function formatearFechaHoraConsumoReporte(createdAt) {
  if (!createdAt) return '—';

  return new Date(createdAt).toLocaleString('es-MX', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function cantidadConsumoRegistro(consumo) {
  return Number(consumo?.cantidad);
}

function resolverProductoConsumo(consumo) {
  return consumo?.productos || null;
}

export function formatearCantidadConsumoProducto(producto, cantidad) {
  const cantidadNumerica = redondearCantidadInventario(cantidad);

  if (cantidadNumerica == null) {
    return '—';
  }

  if (esProductoPorPeso(producto)) {
    return `${textoCantidadInventario(cantidadNumerica)} g`;
  }

  return cantidadNumerica === 1
    ? '1 pieza'
    : `${textoCantidadInventario(cantidadNumerica)} piezas`;
}

export function resumenVariantesConsumo(variantes, producto, variantesCtx) {
  if (!variantes || !producto) {
    return null;
  }

  const tieneSeleccion = Object.values(variantes).some(
    (ids) => Array.isArray(ids) && ids.length > 0
  );

  if (!tieneSeleccion) {
    return null;
  }

  return formatearLineaResumen(
    { productoId: String(producto.id), cantidad: '1', variantes },
    producto,
    variantesCtx
  );
}

export function filtrarConsumoInternoPorEmpleado(consumos, empleadoId) {
  if (!empleadoId) {
    return consumos || [];
  }

  return (consumos || []).filter(
    (consumo) => String(consumo.empleado_id) === String(empleadoId)
  );
}

export function agruparConsumoPersonalPorProducto(consumos, variantesCtx) {
  const mapa = new Map();

  (consumos || []).forEach((consumo) => {
    if (consumo?.deleted_at != null) {
      return;
    }

    const producto = resolverProductoConsumo(consumo);
    const clave = `${consumo.producto_id}::${serializarVariantesConsumo(consumo.variantes)}`;
    const existente = mapa.get(clave) || {
      clave,
      productoId: consumo.producto_id,
      producto,
      nombreProducto: producto?.nombre || 'Producto desconocido',
      resumenVariantes: resumenVariantesConsumo(consumo.variantes, producto, variantesCtx),
      cantidadTotal: 0,
    };

    existente.cantidadTotal += cantidadConsumoRegistro(consumo) || 0;
    mapa.set(clave, existente);
  });

  return [...mapa.values()]
    .map((fila) => ({
      ...fila,
      cantidadEtiqueta: formatearCantidadConsumoProducto(fila.producto, fila.cantidadTotal),
    }))
    .sort((a, b) => a.nombreProducto.localeCompare(b.nombreProducto, 'es'));
}

export function listarConsumoPersonalDetallado(consumos, variantesCtx) {
  return deduplicarConsumosInternosPorId(consumos)
    .filter((consumo) => consumo?.deleted_at == null)
    .map((consumo) => {
      const producto = resolverProductoConsumo(consumo);

      return {
        id: consumo.id,
        empleadoId: consumo.empleado_id,
        nombreEmpleado: consumo.empleados?.nombre || 'Empleado desconocido',
        nombreProducto: producto?.nombre || 'Producto desconocido',
        resumenVariantes: resumenVariantesConsumo(consumo.variantes, producto, variantesCtx),
        cantidadEtiqueta: formatearCantidadConsumoProducto(
          producto,
          cantidadConsumoRegistro(consumo)
        ),
        fechaHoraEtiqueta: formatearFechaHoraConsumoReporte(consumo.created_at),
        createdAt: consumo.created_at,
      };
    })
    .sort((a, b) => {
      const porEmpleado = a.nombreEmpleado.localeCompare(b.nombreEmpleado, 'es');

      if (porEmpleado !== 0) {
        return porEmpleado;
      }

      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
}

export function calcularResumenConsumoPersonal(consumos, filasPorProducto) {
  const activos = (consumos || []).filter((consumo) => consumo?.deleted_at == null);

  return {
    totalRegistros: activos.length,
    totalProductos: filasPorProducto?.length ?? 0,
  };
}

export function calcularResumenCortesInventario(snapshots) {
  return {
    totalCortes: (snapshots || []).length,
  };
}

async function consultarConsumoInternoReportePaginado(supabase, negocioId, aplicarFiltro) {
  const acumulado = [];
  let offset = 0;
  const tamanoPagina = 1000;

  while (true) {
    let query = queryConNegocio(
      supabase
        .from('inventario_consumo_interno')
        .select(SELECT_CONSUMO_INTERNO_REPORTE)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(offset, offset + tamanoPagina - 1),
      negocioId
    );

    query = aplicarFiltro(query);

    const { data, error } = await query;

    if (error) {
      return { data: [], error };
    }

    const lote = deduplicarConsumosInternosPorId(data || []);
    acumulado.push(...lote);

    if (lote.length < tamanoPagina) {
      break;
    }

    offset += tamanoPagina;
  }

  return { data: deduplicarConsumosInternosPorId(acumulado), error: null };
}

export async function consultarConsumoInternoReporte(supabase, negocioId, inicio, fin) {
  if (!negocioId || !inicio || !fin) {
    return { data: [], error: null };
  }

  return consultarConsumoInternoReportePaginado(supabase, negocioId, (query) =>
    query.gte('created_at', inicio.toISOString()).lte('created_at', fin.toISOString())
  );
}

export async function consultarConsumoInternoPorJornadaReporte(
  supabase,
  negocioId,
  jornadaId
) {
  if (!negocioId || !jornadaId) {
    return { data: [], error: null };
  }

  return consultarConsumoInternoReportePaginado(supabase, negocioId, (query) =>
    query.eq('jornada_id', jornadaId)
  );
}

export async function consultarSnapshotsInventarioReporte(supabase, negocioId, inicio, fin) {
  return consultarRegistrosReportePaginados(supabase, negocioId, {
    tabla: 'inventario_snapshots',
    select: SELECT_SNAPSHOTS_INVENTARIO_REPORTE,
    columnaFecha: 'created_at',
    inicio,
    fin,
  });
}

export async function consultarSnapshotsInventarioPorJornadaReporte(
  supabase,
  negocioId,
  jornadaId
) {
  if (!negocioId || !jornadaId) {
    return { data: [], error: null };
  }

  const acumulado = [];
  let offset = 0;
  const tamanoPagina = 1000;

  while (true) {
    const { data, error } = await queryConNegocio(
      supabase
        .from('inventario_snapshots')
        .select(SELECT_SNAPSHOTS_INVENTARIO_REPORTE)
        .eq('jornada_id', jornadaId)
        .order('created_at', { ascending: false })
        .range(offset, offset + tamanoPagina - 1),
      negocioId
    );

    if (error) {
      return { data: [], error };
    }

    const lote = data || [];
    acumulado.push(...lote);

    if (lote.length < tamanoPagina) {
      break;
    }

    offset += tamanoPagina;
  }

  return { data: acumulado, error: null };
}

export function filtrarSnapshotsInventarioReporte(snapshots, configPeriodo) {
  return filtrarPorPeriodoCreatedAt(snapshots, configPeriodo);
}

export function etiquetaEmpleadoConsumoPersonal(empleadoId, empleadosPorId) {
  if (!empleadoId) return null;
  return empleadosPorId[String(empleadoId)]?.nombre || 'Empleado desconocido';
}

export function periodoTarjetaConsumoPersonal(configPeriodo, jornadaFoco = null, jornadaFocoOrigen = null) {
  if (jornadaFoco?.abierta_en) {
    return {
      descripcion: formatearEtiquetaJornadaFocoReporte(jornadaFoco, jornadaFocoOrigen),
      fechas: fechasPeriodoTarjeta(configPeriodo),
    };
  }

  if (rangoFechasInvalido(configPeriodo.fechaDesde, configPeriodo.fechaHasta)) {
    return {
      descripcion: 'Corrige el rango De/Hasta',
      fechas: '—',
    };
  }

  return {
    descripcion: descripcionPeriodoTarjeta(configPeriodo),
    fechas: fechasPeriodoTarjeta(configPeriodo),
  };
}
