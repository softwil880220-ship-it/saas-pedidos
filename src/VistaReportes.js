import { useEffect, useMemo, useState } from 'react';
import './App.css';
import DashboardNav from './DashboardNav';
import DashboardHeaderReservaMovil from './DashboardHeaderReservaMovil';
import {
  agruparPedidosPorDia,
  calcularResumenReporte,
  claveFechaDesdeDate,
  descripcionPeriodoTarjeta,
  etiquetaFiltroVentaReporte,
  etiquetaTipoEntregaReporte,
  exportarArqueosPdf,
  exportarFondosFijosPdf,
  exportarReportePdf,
  exportarRetirosPdf,
  fechasPeriodoTarjeta,
  FILTROS_VENTA_REPORTE,
  filtrarArqueosReporte,
  filtrarPedidosReporte,
  formatearClienteReporte,
  formatearFechaPedidoReporte,
  formatearHoraPedidoLista,
  formatearProductosReporte,
  obtenerRangoReporte,
  PERIODOS_REPORTE,
  periodoMultiplesDias,
  rangoFechasInvalido,
  rangoPersonalizadoActivo,
} from './reportesHelpers';
import { formatearMoneda } from './pedidosShared';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import { queryConNegocio } from './tenantHelpers';

const REPORTES_TABS = [
  { value: 'ventas', label: 'Ventas' },
  { value: 'arqueos', label: 'Arqueos' },
  { value: 'retiros', label: 'Retiros de efectivo' },
  { value: 'fondos-fijos', label: 'Fondos fijos' },
];

const MENSAJE_RETIRO_BLOQUEADO_ARQUEO =
  'No puedes eliminar este retiro de efectivo porque existe un arqueo de caja registrado para este día.';

const FORMAS_PAGO_ARQUEO = [
  { label: 'Efectivo', sistema: 'efectivo_sistema', contado: 'efectivo_contado' },
  { label: 'Tarjeta', sistema: 'tarjeta_sistema', contado: 'tarjeta_contado' },
  {
    label: 'Transferencia',
    sistema: 'transferencia_sistema',
    contado: 'transferencia_contado',
  },
  { label: 'Link de pago', sistema: 'link_sistema', contado: 'link_contado' },
];

function claseDiferenciaArqueoReporte(valor) {
  const diferencia = Number(valor) || 0;
  if (diferencia < 0) {
    return 'reportes-arqueo-diferencia reportes-arqueo-diferencia-negativa';
  }
  if (diferencia > 0) {
    return 'reportes-arqueo-diferencia reportes-arqueo-diferencia-positiva';
  }
  return 'reportes-arqueo-diferencia';
}

function formatearDiferenciaArqueoReporte(valor) {
  const diferencia = Number(valor) || 0;
  const prefijo = diferencia > 0 ? '+' : '';
  return `${prefijo}${formatearMoneda(diferencia)}`;
}

function formatearFechaSoloReporte(createdAt) {
  if (!createdAt) return '—';

  return new Date(createdAt).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function agruparRetirosPorDia(retiros) {
  const grupos = new Map();

  (retiros || []).forEach((retiro) => {
    const clave = claveFechaDesdeDate(
      retiro.created_at ? new Date(retiro.created_at) : new Date(0)
    );

    if (!grupos.has(clave)) {
      grupos.set(clave, []);
    }

    grupos.get(clave).push(retiro);
  });

  grupos.forEach((lista) => {
    lista.sort(
      (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
    );
  });

  return grupos;
}

export default function VistaReportes() {
  const { negocioId } = useAuth();
  const [tabReportes, setTabReportes] = useState('ventas');
  const [periodo, setPeriodo] = useState(PERIODOS_REPORTE.SEMANA);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [filtroVenta, setFiltroVenta] = useState('todos');
  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [arqueos, setArqueos] = useState([]);
  const [retiros, setRetiros] = useState([]);
  const [cargandoArqueos, setCargandoArqueos] = useState(false);
  const [errorArqueos, setErrorArqueos] = useState(null);
  const [arqueoConfirmarEliminar, setArqueoConfirmarEliminar] = useState(null);
  const [eliminandoArqueoId, setEliminandoArqueoId] = useState(null);
  const [retirosHistorial, setRetirosHistorial] = useState([]);
  const [cargandoRetiros, setCargandoRetiros] = useState(false);
  const [errorRetiros, setErrorRetiros] = useState(null);
  const [retiroConfirmarEliminar, setRetiroConfirmarEliminar] = useState(null);
  const [eliminandoRetiroId, setEliminandoRetiroId] = useState(null);
  const [arqueosHistorial, setArqueosHistorial] = useState([]);
  const [retiroMensajeBloqueo, setRetiroMensajeBloqueo] = useState(null);
  const [fondosFijosArqueos, setFondosFijosArqueos] = useState([]);
  const [cargandoFondosFijos, setCargandoFondosFijos] = useState(false);
  const [errorFondosFijos, setErrorFondosFijos] = useState(null);

  const configPeriodo = useMemo(
    () => ({ periodo, fechaDesde, fechaHasta }),
    [periodo, fechaDesde, fechaHasta]
  );

  const usaRangoPersonalizado = rangoPersonalizadoActivo(fechaDesde, fechaHasta);
  const rangoInvalido = rangoFechasInvalido(fechaDesde, fechaHasta);
  const reporteDeshabilitado = rangoInvalido;

  useEffect(() => {
    let activo = true;

    if (!negocioId) {
      setPedidos([]);
      setCargando(false);
      return undefined;
    }

    if (rangoInvalido) {
      setCargando(false);
      setError(null);
      setPedidos([]);
      return undefined;
    }

    const cargarPedidos = async () => {
      setCargando(true);
      setError(null);

      const { inicio, fin } = obtenerRangoReporte(configPeriodo);
      const { data, error: errorConsulta } = await queryConNegocio(
        supabase
          .from('pedidos')
          .select('*')
          .gte('created_at', inicio.toISOString())
          .lte('created_at', fin.toISOString()),
        negocioId
      ).order('created_at', { ascending: false });

      if (!activo) return;

      if (errorConsulta) {
        setError('No se pudieron cargar los pedidos.');
        setPedidos([]);
      } else {
        setPedidos(data || []);
      }

      setCargando(false);
    };

    cargarPedidos();

    return () => {
      activo = false;
    };
  }, [configPeriodo, rangoInvalido, negocioId]);

  useEffect(() => {
    let activo = true;

    if (tabReportes !== 'arqueos' || !negocioId) {
      return undefined;
    }

    const cargarArqueos = async () => {
      setCargandoArqueos(true);
      setErrorArqueos(null);

      const [arqueosRes, retirosRes] = await Promise.all([
        queryConNegocio(
          supabase.from('arqueos').select('*').order('created_at', { ascending: false }),
          negocioId
        ),
        queryConNegocio(
          supabase.from('retiros').select('*').order('created_at', { ascending: false }),
          negocioId
        ),
      ]);

      if (!activo) return;

      if (arqueosRes.error || retirosRes.error) {
        setErrorArqueos('No se pudo cargar el historial de arqueos.');
        setArqueos([]);
        setRetiros([]);
      } else {
        setArqueos(arqueosRes.data || []);
        setRetiros(retirosRes.data || []);
      }

      setCargandoArqueos(false);
    };

    cargarArqueos();

    return () => {
      activo = false;
    };
  }, [tabReportes, negocioId]);

  useEffect(() => {
    let activo = true;

    if (tabReportes !== 'retiros' || !negocioId) {
      return undefined;
    }

    const cargarRetiros = async () => {
      setCargandoRetiros(true);
      setErrorRetiros(null);
      setRetiroMensajeBloqueo(null);
      setRetiroConfirmarEliminar(null);

      const [retirosRes, arqueosRes] = await Promise.all([
        queryConNegocio(
          supabase.from('retiros').select('*').order('created_at', { ascending: false }),
          negocioId
        ),
        queryConNegocio(
          supabase.from('arqueos').select('*').order('created_at', { ascending: false }),
          negocioId
        ),
      ]);

      if (!activo) return;

      if (retirosRes.error || arqueosRes.error) {
        setErrorRetiros('No se pudo cargar el historial de retiros.');
        setRetirosHistorial([]);
        setArqueosHistorial([]);
      } else {
        setRetirosHistorial(retirosRes.data || []);
        setArqueosHistorial(arqueosRes.data || []);
      }

      setCargandoRetiros(false);
    };

    cargarRetiros();

    return () => {
      activo = false;
    };
  }, [tabReportes, negocioId]);

  useEffect(() => {
    let activo = true;

    if (tabReportes !== 'fondos-fijos' || !negocioId) {
      return undefined;
    }

    const cargarFondosFijos = async () => {
      setCargandoFondosFijos(true);
      setErrorFondosFijos(null);

      const { data, error: errorConsulta } = await queryConNegocio(
        supabase.from('arqueos').select('*').order('created_at', { ascending: false }),
        negocioId
      );

      if (!activo) return;

      if (errorConsulta) {
        setErrorFondosFijos('No se pudo cargar el historial de fondos fijos.');
        setFondosFijosArqueos([]);
      } else {
        setFondosFijosArqueos(data || []);
      }

      setCargandoFondosFijos(false);
    };

    cargarFondosFijos();

    return () => {
      activo = false;
    };
  }, [tabReportes, negocioId]);

  const retirosPorDia = useMemo(() => agruparRetirosPorDia(retiros), [retiros]);

  const arqueosFiltrados = useMemo(
    () => filtrarArqueosReporte(arqueos, configPeriodo),
    [arqueos, configPeriodo]
  );

  const retirosFiltrados = useMemo(
    () => filtrarArqueosReporte(retirosHistorial, configPeriodo),
    [retirosHistorial, configPeriodo]
  );

  const fondosFijosFiltrados = useMemo(
    () => filtrarArqueosReporte(fondosFijosArqueos, configPeriodo),
    [fondosFijosArqueos, configPeriodo]
  );

  const diasConArqueo = useMemo(() => {
    const dias = new Set();

    (arqueosHistorial || []).forEach((arqueo) => {
      dias.add(
        claveFechaDesdeDate(
          arqueo.created_at ? new Date(arqueo.created_at) : new Date(0)
        )
      );
    });

    return dias;
  }, [arqueosHistorial]);

  const pedidosFiltrados = useMemo(
    () => filtrarPedidosReporte(pedidos, configPeriodo, filtroVenta),
    [pedidos, configPeriodo, filtroVenta]
  );

  const resumen = useMemo(
    () => calcularResumenReporte(pedidosFiltrados),
    [pedidosFiltrados]
  );

  const multiplesDias = periodoMultiplesDias(configPeriodo);
  const pedidosAgrupados = useMemo(
    () => (multiplesDias ? agruparPedidosPorDia(pedidosFiltrados) : []),
    [multiplesDias, pedidosFiltrados]
  );

  const seleccionarSemana = () => {
    setPeriodo(PERIODOS_REPORTE.SEMANA);
    setFechaDesde('');
    setFechaHasta('');
  };

  const seleccionarMes = () => {
    setPeriodo(PERIODOS_REPORTE.MES);
    setFechaDesde('');
    setFechaHasta('');
  };

  const exportarPdf = () => {
    exportarReportePdf({
      configPeriodo,
      filtroVenta,
      resumen,
      pedidos: pedidosFiltrados,
    });
  };

  const exportarPdfArqueos = () => {
    exportarArqueosPdf({
      configPeriodo,
      arqueos,
      retiros,
    });
  };

  const exportarPdfRetiros = () => {
    exportarRetirosPdf({
      configPeriodo,
      retiros: retirosHistorial,
    });
  };

  const exportarPdfFondosFijos = () => {
    exportarFondosFijosPdf({
      configPeriodo,
      arqueos: fondosFijosArqueos,
    });
  };

  const confirmarEliminarArqueo = async (arqueoId) => {
    if (!negocioId || eliminandoArqueoId) return;

    setEliminandoArqueoId(arqueoId);
    setErrorArqueos(null);

    const { error } = await queryConNegocio(
      supabase.from('arqueos').delete().eq('id', arqueoId),
      negocioId
    );

    setEliminandoArqueoId(null);
    setArqueoConfirmarEliminar(null);

    if (error) {
      setErrorArqueos('No se pudo eliminar el arqueo.');
      return;
    }

    setArqueos((prev) => prev.filter((item) => item.id !== arqueoId));
  };

  const existeArqueoDelDiaRetiro = (retiro) => {
    const claveDia = claveFechaDesdeDate(
      retiro.created_at ? new Date(retiro.created_at) : new Date(0)
    );

    return diasConArqueo.has(claveDia);
  };

  const intentarEliminarRetiro = (retiro) => {
    setRetiroConfirmarEliminar(null);

    if (existeArqueoDelDiaRetiro(retiro)) {
      setRetiroMensajeBloqueo(retiro.id);
      return;
    }

    setRetiroMensajeBloqueo(null);
    setRetiroConfirmarEliminar(retiro.id);
  };

  const confirmarEliminarRetiro = async (retiroId) => {
    if (!negocioId || eliminandoRetiroId) return;

    const retiro = retirosHistorial.find((item) => item.id === retiroId);

    if (retiro && existeArqueoDelDiaRetiro(retiro)) {
      setRetiroConfirmarEliminar(null);
      setRetiroMensajeBloqueo(retiroId);
      return;
    }

    setEliminandoRetiroId(retiroId);
    setErrorRetiros(null);

    const { error } = await queryConNegocio(
      supabase.from('retiros').delete().eq('id', retiroId),
      negocioId
    );

    setEliminandoRetiroId(null);
    setRetiroConfirmarEliminar(null);

    if (error) {
      setErrorRetiros('No se pudo eliminar el retiro.');
      return;
    }

    setRetirosHistorial((prev) => prev.filter((item) => item.id !== retiroId));
  };

  const renderTarjetaArqueo = (arqueo) => {
    const claveDia = claveFechaDesdeDate(
      arqueo.created_at ? new Date(arqueo.created_at) : new Date(0)
    );
    const retirosDelDia = retirosPorDia.get(claveDia) || [];

    return (
      <article key={arqueo.id} className="reportes-arqueo-card">
        <header className="reportes-arqueo-cabecera">
          <div className="reportes-arqueo-cabecera-info">
            <time className="reportes-arqueo-fecha">
              {formatearFechaPedidoReporte(arqueo.created_at)}
            </time>
            <span className="reportes-arqueo-usuario">
              {arqueo.usuario?.trim() || '—'}
            </span>
          </div>
          <div className="reportes-arqueo-cabecera-acciones">
            {arqueoConfirmarEliminar === arqueo.id ? (
              <div className="reportes-arqueo-confirmar-eliminar">
                <span>¿Eliminar este arqueo?</span>
                <button
                  type="button"
                  className="reportes-arqueo-confirmar-btn reportes-arqueo-confirmar-cancelar"
                  onClick={() => setArqueoConfirmarEliminar(null)}
                  disabled={eliminandoArqueoId === arqueo.id}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="reportes-arqueo-confirmar-btn reportes-arqueo-confirmar-aceptar"
                  onClick={() => confirmarEliminarArqueo(arqueo.id)}
                  disabled={eliminandoArqueoId === arqueo.id}
                >
                  {eliminandoArqueoId === arqueo.id ? 'Eliminando...' : 'Confirmar'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="reportes-arqueo-eliminar-btn"
                onClick={() => setArqueoConfirmarEliminar(arqueo.id)}
                disabled={
                  eliminandoArqueoId !== null ||
                  (arqueoConfirmarEliminar !== null && arqueoConfirmarEliminar !== arqueo.id)
                }
              >
                Eliminar
              </button>
            )}
          </div>
        </header>

        <div className="reportes-arqueo-desglose">
          <div className="reportes-arqueo-desglose-encabezado">
            <span>Forma de pago</span>
            <span>Sistema</span>
            <span>Contado</span>
          </div>
          {FORMAS_PAGO_ARQUEO.map(({ label, sistema, contado }) => (
            <div key={sistema} className="reportes-arqueo-desglose-fila">
              <span>{label}</span>
              <span>{formatearMoneda(arqueo[sistema])}</span>
              <span>{formatearMoneda(arqueo[contado])}</span>
            </div>
          ))}
        </div>

        <div className="reportes-arqueo-retiros">
          <p className="reportes-arqueo-retiros-resumen">
            Ventas totales del día:{' '}
            {formatearMoneda(
              (Number(arqueo.total_sistema) || 0) -
                (Number(arqueo.fondo_fijo_del_dia) || 0) +
                (Number(arqueo.retiros_del_dia) || 0)
            )}
          </p>
          {Number(arqueo.fondo_fijo_del_dia) > 0 ? (
            <p className="reportes-arqueo-retiros-resumen">
              Fondo fijo del día: {formatearMoneda(arqueo.fondo_fijo_del_dia)}
            </p>
          ) : null}
          <p className="reportes-arqueo-retiros-resumen">
            Retiros del día: {formatearMoneda(arqueo.retiros_del_dia)}
          </p>
          {retirosDelDia.length > 0 ? (
            <ul className="reportes-arqueo-retiros-lista">
              {retirosDelDia.map((retiro) => (
                <li key={retiro.id}>
                  {formatearHoraPedidoLista(retiro.created_at)} —{' '}
                  {retiro.motivo?.trim() || 'Sin motivo'} —{' '}
                  {formatearMoneda(retiro.monto)}
                  {retiro.usuario ? ` (${retiro.usuario})` : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p className="reportes-arqueo-retiros-vacio">
              Sin retiros registrados ese día.
            </p>
          )}
        </div>

        <div className="reportes-arqueo-totales">
          <div className="reportes-arqueo-total-fila">
            <span>Total sistema</span>
            <strong>{formatearMoneda(arqueo.total_sistema)}</strong>
          </div>
          <div className="reportes-arqueo-total-fila">
            <span>Total contado</span>
            <strong>{formatearMoneda(arqueo.total_contado)}</strong>
          </div>
          <div className="reportes-arqueo-total-fila">
            <span>Diferencia</span>
            <strong className={claseDiferenciaArqueoReporte(arqueo.diferencia)}>
              {formatearDiferenciaArqueoReporte(arqueo.diferencia)}
            </strong>
          </div>
        </div>
      </article>
    );
  };

  const renderTarjetaRetiro = (retiro) => (
    <article key={retiro.id} className="reportes-arqueo-card">
      <header className="reportes-arqueo-cabecera">
        <div className="reportes-arqueo-cabecera-info">
          <time className="reportes-arqueo-fecha">
            {formatearFechaPedidoReporte(retiro.created_at)}
          </time>
          <span className="reportes-arqueo-usuario">
            {retiro.usuario?.trim() || '—'}
          </span>
        </div>
        <div className="reportes-arqueo-cabecera-acciones">
          {retiroMensajeBloqueo === retiro.id ? (
            <div
              className="reportes-arqueo-confirmar-eliminar"
              style={{ maxWidth: 'none', textAlign: 'left', alignItems: 'flex-start' }}
            >
              <p className="retiro-modal-error" role="alert" style={{ margin: 0, flex: '1 1 100%' }}>
                {MENSAJE_RETIRO_BLOQUEADO_ARQUEO}
              </p>
              <button
                type="button"
                className="reportes-arqueo-confirmar-btn reportes-arqueo-confirmar-cancelar"
                onClick={() => setRetiroMensajeBloqueo(null)}
              >
                Cancelar
              </button>
            </div>
          ) : retiroConfirmarEliminar === retiro.id ? (
            <div className="reportes-arqueo-confirmar-eliminar">
              <span>¿Eliminar este retiro?</span>
              <button
                type="button"
                className="reportes-arqueo-confirmar-btn reportes-arqueo-confirmar-cancelar"
                onClick={() => setRetiroConfirmarEliminar(null)}
                disabled={eliminandoRetiroId === retiro.id}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="reportes-arqueo-confirmar-btn reportes-arqueo-confirmar-aceptar"
                onClick={() => confirmarEliminarRetiro(retiro.id)}
                disabled={eliminandoRetiroId === retiro.id}
              >
                {eliminandoRetiroId === retiro.id ? 'Eliminando...' : 'Confirmar'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="reportes-arqueo-eliminar-btn"
              onClick={() => intentarEliminarRetiro(retiro)}
              disabled={
                eliminandoRetiroId !== null ||
                (retiroConfirmarEliminar !== null && retiroConfirmarEliminar !== retiro.id) ||
                (retiroMensajeBloqueo !== null && retiroMensajeBloqueo !== retiro.id)
              }
            >
              Eliminar
            </button>
          )}
        </div>
      </header>

      <div className="reportes-arqueo-retiros">
        <p className="reportes-arqueo-retiros-resumen">
          Motivo: {retiro.motivo?.trim() || 'Sin motivo'}
        </p>
        <p className="reportes-arqueo-retiros-resumen">
          Monto: {formatearMoneda(retiro.monto)}
        </p>
      </div>
    </article>
  );

  return (
    <div className="dashboard">
      <DashboardHeaderReservaMovil />

      <main className="dashboard-main">
        <DashboardNav activo="reportes" />

        <section className="reportes-vista">
          <nav className="reportes-seccion-nav" aria-label="Secciones de reportes">
            {REPORTES_TABS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={`reportes-seccion-tab${tabReportes === value ? ' activo' : ''}`}
                onClick={() => setTabReportes(value)}
              >
                {label}
              </button>
            ))}
          </nav>

          {tabReportes === 'ventas' ? (
            <>
          <div className="reportes-controles">
            <div className="reportes-control-grupo reportes-control-grupo-periodo">
              <span className="reportes-control-etiqueta">Período</span>
              <nav className="reportes-periodo-nav" aria-label="Período del reporte">
                <button
                  type="button"
                  className={`reportes-periodo-btn${
                    !usaRangoPersonalizado && periodo === PERIODOS_REPORTE.SEMANA
                      ? ' activo'
                      : ''
                  }${usaRangoPersonalizado ? ' desactivado' : ''}`}
                  onClick={seleccionarSemana}
                >
                  Semana
                </button>
                <button
                  type="button"
                  className={`reportes-periodo-btn${
                    !usaRangoPersonalizado && periodo === PERIODOS_REPORTE.MES ? ' activo' : ''
                  }${usaRangoPersonalizado ? ' desactivado' : ''}`}
                  onClick={seleccionarMes}
                >
                  Mes
                </button>
              </nav>

              <div className="reportes-rango-personalizado">
                <label className="reportes-fecha-campo" htmlFor="reportes-fecha-desde">
                  <span className="reportes-fecha-etiqueta">De:</span>
                  <input
                    id="reportes-fecha-desde"
                    type="date"
                    className="reportes-fecha-input"
                    value={fechaDesde}
                    onChange={(e) => setFechaDesde(e.target.value)}
                  />
                </label>
                <label className="reportes-fecha-campo" htmlFor="reportes-fecha-hasta">
                  <span className="reportes-fecha-etiqueta">Hasta:</span>
                  <input
                    id="reportes-fecha-hasta"
                    type="date"
                    className="reportes-fecha-input"
                    value={fechaHasta}
                    onChange={(e) => setFechaHasta(e.target.value)}
                  />
                </label>
              </div>
              {rangoInvalido ? (
                <p className="reportes-rango-error" role="alert">
                  La fecha inicial no puede ser mayor a la fecha final
                </p>
              ) : null}
            </div>

            <div className="reportes-control-grupo reportes-control-grupo-filtro">
              <label className="reportes-control-etiqueta" htmlFor="reportes-filtro-venta">
                Tipo de venta
              </label>
              <select
                id="reportes-filtro-venta"
                className="reportes-filtro-select"
                value={filtroVenta}
                onChange={(e) => setFiltroVenta(e.target.value)}
              >
                {FILTROS_VENTA_REPORTE.map((opcion) => (
                  <option key={opcion.value} value={opcion.value}>
                    {opcion.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="reportes-exportar-btn"
              onClick={exportarPdf}
              disabled={cargando || reporteDeshabilitado}
            >
              Exportar PDF
            </button>
          </div>

          <p className="reportes-filtro-activo">
            Filtro activo: <strong>{etiquetaFiltroVentaReporte(filtroVenta)}</strong>
          </p>

          <div className="reportes-resumen">
            <article className="reportes-resumen-card">
              <span className="reportes-resumen-label">Período activo</span>
              <div className="reportes-resumen-valor reportes-resumen-valor-periodo">
                <span className="reportes-periodo-descripcion">
                  {descripcionPeriodoTarjeta(configPeriodo)}
                </span>
                <span className="reportes-periodo-fechas">
                  {fechasPeriodoTarjeta(configPeriodo)}
                </span>
              </div>
            </article>
            <article className="reportes-resumen-card">
              <span className="reportes-resumen-label">Total de pedidos</span>
              <span className="reportes-resumen-valor">{resumen.totalPedidos}</span>
            </article>
            <article className="reportes-resumen-card">
              <span className="reportes-resumen-label">Monto acumulado</span>
              <span className="reportes-resumen-valor reportes-resumen-valor-monto">
                {formatearMoneda(resumen.montoAcumulado)}
              </span>
            </article>
          </div>

          {reporteDeshabilitado ? (
            <p className="dashboard-vacio reportes-error">
              Corrige el rango de fechas para ver el reporte.
            </p>
          ) : cargando ? (
            <p className="dashboard-vacio">Cargando pedidos...</p>
          ) : error ? (
            <p className="dashboard-vacio reportes-error">{error}</p>
          ) : pedidosFiltrados.length === 0 ? (
            <p className="dashboard-vacio">
              No hay pedidos para el período y tipo de venta seleccionados.
            </p>
          ) : (
            <>
              {multiplesDias ? (
                pedidosAgrupados.map((grupo) => (
                  <div key={grupo.clave} className="pedidos-grupo pedidos-grupo-separado">
                    <div className="pedidos-grupo-encabezado">
                      <span className="pedidos-grupo-encabezado-linea">
                        <span className="pedidos-grupo-encabezado-separador" aria-hidden="true">
                          ──
                        </span>
                        {grupo.etiqueta}
                        <span className="pedidos-grupo-encabezado-separador" aria-hidden="true">
                          ──
                        </span>
                      </span>
                      <span className="pedidos-grupo-encabezado-total">
                        Total del día: {formatearMoneda(grupo.totalDelDia)}
                      </span>
                    </div>
                    <div className="reportes-tabla pedidos-reporte">
                      <div className="reportes-tabla-header pedidos-reporte-header">
                        <span>Hora</span>
                        <span>Cliente</span>
                        <span>Productos</span>
                        <span>Tipo de entrega</span>
                        <span>Total</span>
                      </div>
                      {grupo.pedidos.map((pedido) => (
                        <div key={pedido.id} className="reportes-tabla-fila pedidos-reporte-fila">
                          <span className="reporte-hora">
                            {formatearHoraPedidoLista(pedido.created_at)}
                          </span>
                          <span className="reporte-cliente">
                            {formatearClienteReporte(pedido)}
                          </span>
                          <span className="reporte-productos">
                            {formatearProductosReporte(pedido)}
                          </span>
                          <span className="reporte-tipo-entrega">
                            {etiquetaTipoEntregaReporte(pedido)}
                          </span>
                          <span className="reporte-total">
                            {formatearMoneda(pedido.total)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="reportes-tabla pedidos-reporte">
                  <div className="reportes-tabla-header pedidos-reporte-header">
                    <span>Fecha</span>
                    <span>Cliente</span>
                    <span>Productos</span>
                    <span>Tipo de entrega</span>
                    <span>Total</span>
                  </div>
                  {pedidosFiltrados.map((pedido) => (
                    <div key={pedido.id} className="reportes-tabla-fila pedidos-reporte-fila">
                      <span className="reporte-fecha">
                        {formatearFechaPedidoReporte(pedido.created_at)}
                      </span>
                      <span className="reporte-cliente">{formatearClienteReporte(pedido)}</span>
                      <span className="reporte-productos">
                        {formatearProductosReporte(pedido)}
                      </span>
                      <span className="reporte-tipo-entrega">
                        {etiquetaTipoEntregaReporte(pedido)}
                      </span>
                      <span className="reporte-total">
                        {formatearMoneda(pedido.total)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
            </>
          ) : null}

          {tabReportes === 'arqueos' ? (
            <>
              <div className="reportes-controles">
                <div className="reportes-control-grupo reportes-control-grupo-periodo">
                  <span className="reportes-control-etiqueta">Período</span>
                  <nav className="reportes-periodo-nav" aria-label="Período de arqueos">
                    <button
                      type="button"
                      className={`reportes-periodo-btn${
                        !usaRangoPersonalizado && periodo === PERIODOS_REPORTE.SEMANA
                          ? ' activo'
                          : ''
                      }${usaRangoPersonalizado ? ' desactivado' : ''}`}
                      onClick={seleccionarSemana}
                    >
                      Semana
                    </button>
                    <button
                      type="button"
                      className={`reportes-periodo-btn${
                        !usaRangoPersonalizado && periodo === PERIODOS_REPORTE.MES
                          ? ' activo'
                          : ''
                      }${usaRangoPersonalizado ? ' desactivado' : ''}`}
                      onClick={seleccionarMes}
                    >
                      Mes
                    </button>
                  </nav>

                  <div className="reportes-rango-personalizado">
                    <label className="reportes-fecha-campo" htmlFor="reportes-arqueos-fecha-desde">
                      <span className="reportes-fecha-etiqueta">De:</span>
                      <input
                        id="reportes-arqueos-fecha-desde"
                        type="date"
                        className="reportes-fecha-input"
                        value={fechaDesde}
                        onChange={(e) => setFechaDesde(e.target.value)}
                      />
                    </label>
                    <label className="reportes-fecha-campo" htmlFor="reportes-arqueos-fecha-hasta">
                      <span className="reportes-fecha-etiqueta">Hasta:</span>
                      <input
                        id="reportes-arqueos-fecha-hasta"
                        type="date"
                        className="reportes-fecha-input"
                        value={fechaHasta}
                        onChange={(e) => setFechaHasta(e.target.value)}
                      />
                    </label>
                  </div>
                  {rangoInvalido ? (
                    <p className="reportes-rango-error" role="alert">
                      La fecha inicial no puede ser mayor a la fecha final
                    </p>
                  ) : null}
                </div>

                <button
                  type="button"
                  className="reportes-exportar-btn"
                  onClick={exportarPdfArqueos}
                  disabled={cargandoArqueos || reporteDeshabilitado}
                >
                  Exportar PDF
                </button>
              </div>

              {reporteDeshabilitado ? (
                <p className="dashboard-vacio reportes-error">
                  Corrige el rango de fechas para ver el reporte.
                </p>
              ) : cargandoArqueos ? (
                <p className="dashboard-vacio">Cargando arqueos...</p>
              ) : errorArqueos ? (
                <p className="dashboard-vacio reportes-error">{errorArqueos}</p>
              ) : arqueos.length === 0 ? (
                <p className="dashboard-vacio">No hay arqueos registrados.</p>
              ) : arqueosFiltrados.length === 0 ? (
                <p className="dashboard-vacio">
                  No hay arqueos para el período seleccionado.
                </p>
              ) : (
                <div className="reportes-arqueos-lista">
                  {arqueosFiltrados.map((arqueo) => renderTarjetaArqueo(arqueo))}
                </div>
              )}
            </>
          ) : null}

          {tabReportes === 'retiros' ? (
            <>
              <div className="reportes-controles">
                <div className="reportes-control-grupo reportes-control-grupo-periodo">
                  <span className="reportes-control-etiqueta">Período</span>
                  <nav className="reportes-periodo-nav" aria-label="Período de retiros">
                    <button
                      type="button"
                      className={`reportes-periodo-btn${
                        !usaRangoPersonalizado && periodo === PERIODOS_REPORTE.SEMANA
                          ? ' activo'
                          : ''
                      }${usaRangoPersonalizado ? ' desactivado' : ''}`}
                      onClick={seleccionarSemana}
                    >
                      Semana
                    </button>
                    <button
                      type="button"
                      className={`reportes-periodo-btn${
                        !usaRangoPersonalizado && periodo === PERIODOS_REPORTE.MES
                          ? ' activo'
                          : ''
                      }${usaRangoPersonalizado ? ' desactivado' : ''}`}
                      onClick={seleccionarMes}
                    >
                      Mes
                    </button>
                  </nav>

                  <div className="reportes-rango-personalizado">
                    <label className="reportes-fecha-campo" htmlFor="reportes-retiros-fecha-desde">
                      <span className="reportes-fecha-etiqueta">De:</span>
                      <input
                        id="reportes-retiros-fecha-desde"
                        type="date"
                        className="reportes-fecha-input"
                        value={fechaDesde}
                        onChange={(e) => setFechaDesde(e.target.value)}
                      />
                    </label>
                    <label className="reportes-fecha-campo" htmlFor="reportes-retiros-fecha-hasta">
                      <span className="reportes-fecha-etiqueta">Hasta:</span>
                      <input
                        id="reportes-retiros-fecha-hasta"
                        type="date"
                        className="reportes-fecha-input"
                        value={fechaHasta}
                        onChange={(e) => setFechaHasta(e.target.value)}
                      />
                    </label>
                  </div>
                  {rangoInvalido ? (
                    <p className="reportes-rango-error" role="alert">
                      La fecha inicial no puede ser mayor a la fecha final
                    </p>
                  ) : null}
                </div>

                <button
                  type="button"
                  className="reportes-exportar-btn"
                  onClick={exportarPdfRetiros}
                  disabled={cargandoRetiros || reporteDeshabilitado}
                >
                  Exportar PDF
                </button>
              </div>

              {reporteDeshabilitado ? (
                <p className="dashboard-vacio reportes-error">
                  Corrige el rango de fechas para ver el reporte.
                </p>
              ) : cargandoRetiros ? (
                <p className="dashboard-vacio">Cargando retiros...</p>
              ) : errorRetiros ? (
                <p className="dashboard-vacio reportes-error">{errorRetiros}</p>
              ) : retirosHistorial.length === 0 ? (
                <p className="dashboard-vacio">No hay retiros registrados.</p>
              ) : retirosFiltrados.length === 0 ? (
                <p className="dashboard-vacio">
                  No hay retiros para el período seleccionado.
                </p>
              ) : (
                <div className="reportes-arqueos-lista">
                  {retirosFiltrados.map((retiro) => renderTarjetaRetiro(retiro))}
                </div>
              )}
            </>
          ) : null}

          {tabReportes === 'fondos-fijos' ? (
            <>
              <div className="reportes-controles">
                <div className="reportes-control-grupo reportes-control-grupo-periodo">
                  <span className="reportes-control-etiqueta">Período</span>
                  <nav className="reportes-periodo-nav" aria-label="Período de fondos fijos">
                    <button
                      type="button"
                      className={`reportes-periodo-btn${
                        !usaRangoPersonalizado && periodo === PERIODOS_REPORTE.SEMANA
                          ? ' activo'
                          : ''
                      }${usaRangoPersonalizado ? ' desactivado' : ''}`}
                      onClick={seleccionarSemana}
                    >
                      Semana
                    </button>
                    <button
                      type="button"
                      className={`reportes-periodo-btn${
                        !usaRangoPersonalizado && periodo === PERIODOS_REPORTE.MES
                          ? ' activo'
                          : ''
                      }${usaRangoPersonalizado ? ' desactivado' : ''}`}
                      onClick={seleccionarMes}
                    >
                      Mes
                    </button>
                  </nav>

                  <div className="reportes-rango-personalizado">
                    <label
                      className="reportes-fecha-campo"
                      htmlFor="reportes-fondos-fijos-fecha-desde"
                    >
                      <span className="reportes-fecha-etiqueta">De:</span>
                      <input
                        id="reportes-fondos-fijos-fecha-desde"
                        type="date"
                        className="reportes-fecha-input"
                        value={fechaDesde}
                        onChange={(e) => setFechaDesde(e.target.value)}
                      />
                    </label>
                    <label
                      className="reportes-fecha-campo"
                      htmlFor="reportes-fondos-fijos-fecha-hasta"
                    >
                      <span className="reportes-fecha-etiqueta">Hasta:</span>
                      <input
                        id="reportes-fondos-fijos-fecha-hasta"
                        type="date"
                        className="reportes-fecha-input"
                        value={fechaHasta}
                        onChange={(e) => setFechaHasta(e.target.value)}
                      />
                    </label>
                  </div>
                  {rangoInvalido ? (
                    <p className="reportes-rango-error" role="alert">
                      La fecha inicial no puede ser mayor a la fecha final
                    </p>
                  ) : null}
                </div>

                <button
                  type="button"
                  className="reportes-exportar-btn"
                  onClick={exportarPdfFondosFijos}
                  disabled={cargandoFondosFijos || reporteDeshabilitado}
                >
                  Exportar PDF
                </button>
              </div>

              {reporteDeshabilitado ? (
                <p className="dashboard-vacio reportes-error">
                  Corrige el rango de fechas para ver el reporte.
                </p>
              ) : cargandoFondosFijos ? (
                <p className="dashboard-vacio">Cargando fondos fijos...</p>
              ) : errorFondosFijos ? (
                <p className="dashboard-vacio reportes-error">{errorFondosFijos}</p>
              ) : fondosFijosArqueos.length === 0 ? (
                <p className="dashboard-vacio">No hay arqueos registrados.</p>
              ) : fondosFijosFiltrados.length === 0 ? (
                <p className="dashboard-vacio">
                  No hay fondos fijos para el período seleccionado.
                </p>
              ) : (
                <div className="fondos-fijos-reporte">
                  <div className="fondos-fijos-reporte-header">
                    <span>Fecha</span>
                    <span>Hora</span>
                    <span>Usuario</span>
                    <span>Fondo fijo</span>
                  </div>
                  {fondosFijosFiltrados.map((arqueo) => (
                    <div key={arqueo.id} className="fondos-fijos-reporte-fila">
                      <span className="reporte-fecha">
                        {formatearFechaSoloReporte(arqueo.created_at)}
                      </span>
                      <span className="reporte-hora">
                        {formatearHoraPedidoLista(arqueo.created_at)}
                      </span>
                      <span className="reporte-cliente">
                        {arqueo.usuario?.trim() || '—'}
                      </span>
                      <span className="reporte-total">
                        {formatearMoneda(arqueo.fondo_fijo_del_dia)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </section>
      </main>
    </div>
  );
}
