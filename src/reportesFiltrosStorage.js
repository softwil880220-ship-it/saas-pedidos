import { FILTROS_VENTA_REPORTE, PERIODOS_REPORTE } from './reportesHelpers';

const STORAGE_KEY_PREFIX = 'pos_reportes_filtros';

const PERIODOS_VALIDOS = new Set(Object.values(PERIODOS_REPORTE));
const FILTROS_VENTA_VALIDOS = new Set(FILTROS_VENTA_REPORTE.map(({ value }) => value));

const FECHA_ISO_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const FILTROS_REPORTE_DEFAULT = {
  periodo: PERIODOS_REPORTE.SEMANA,
  fechaDesde: '',
  fechaHasta: '',
  filtroVenta: 'todos',
};

function claveStorageFiltrosReportes(negocioId) {
  if (negocioId == null || negocioId === '') return null;
  return `${STORAGE_KEY_PREFIX}:${negocioId}`;
}

function normalizarFechaGuardada(valor) {
  if (typeof valor !== 'string') return '';
  const fecha = valor.trim();
  return FECHA_ISO_REGEX.test(fecha) ? fecha : '';
}

function normalizarFiltrosReportes(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ...FILTROS_REPORTE_DEFAULT };
  }

  const periodo = PERIODOS_VALIDOS.has(raw.periodo)
    ? raw.periodo
    : FILTROS_REPORTE_DEFAULT.periodo;

  const filtroVenta = FILTROS_VENTA_VALIDOS.has(raw.filtroVenta)
    ? raw.filtroVenta
    : FILTROS_REPORTE_DEFAULT.filtroVenta;

  return {
    periodo,
    fechaDesde: normalizarFechaGuardada(raw.fechaDesde),
    fechaHasta: normalizarFechaGuardada(raw.fechaHasta),
    filtroVenta,
  };
}

export function cargarFiltrosReportes(negocioId) {
  const clave = claveStorageFiltrosReportes(negocioId);
  if (!clave || typeof window === 'undefined') {
    return { ...FILTROS_REPORTE_DEFAULT };
  }

  try {
    const serializado = window.localStorage.getItem(clave);
    if (!serializado) {
      return { ...FILTROS_REPORTE_DEFAULT };
    }

    return normalizarFiltrosReportes(JSON.parse(serializado));
  } catch {
    return { ...FILTROS_REPORTE_DEFAULT };
  }
}

export function persistirFiltrosReportes(negocioId, filtros) {
  const clave = claveStorageFiltrosReportes(negocioId);
  if (!clave || typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      clave,
      JSON.stringify(normalizarFiltrosReportes(filtros))
    );
  } catch {
    // Ignorar errores de almacenamiento local.
  }
}
