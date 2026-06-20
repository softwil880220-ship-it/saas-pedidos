import { useEffect, useMemo, useState } from 'react';
import './App.css';
import DashboardNav from './DashboardNav';
import {
  calcularResumenReporte,
  descripcionPeriodoTarjeta,
  etiquetaFiltroVentaReporte,
  etiquetaPeriodoReporte,
  etiquetaTipoEntregaReporte,
  exportarReportePdf,
  fechasPeriodoTarjeta,
  FILTROS_VENTA_REPORTE,
  filtrarPedidosReporte,
  formatearClienteReporte,
  formatearFechaPedidoReporte,
  formatearProductosReporte,
  obtenerRangoReporte,
  PERIODOS_REPORTE,
  rangoFechasInvalido,
  rangoPersonalizadoActivo,
} from './reportesHelpers';
import { formatearMoneda } from './pedidosShared';
import { supabase } from './supabase';

export default function VistaReportes() {
  const [periodo, setPeriodo] = useState(PERIODOS_REPORTE.SEMANA);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [filtroVenta, setFiltroVenta] = useState('todos');
  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const configPeriodo = useMemo(
    () => ({ periodo, fechaDesde, fechaHasta }),
    [periodo, fechaDesde, fechaHasta]
  );

  const usaRangoPersonalizado = rangoPersonalizadoActivo(fechaDesde, fechaHasta);
  const rangoInvalido = rangoFechasInvalido(fechaDesde, fechaHasta);
  const reporteDeshabilitado = rangoInvalido;

  useEffect(() => {
    let activo = true;

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
      const { data, error: errorConsulta } = await supabase
        .from('pedidos')
        .select('*')
        .gte('created_at', inicio.toISOString())
        .lte('created_at', fin.toISOString())
        .order('created_at', { ascending: false });

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
  }, [configPeriodo, rangoInvalido]);

  const pedidosFiltrados = useMemo(
    () => filtrarPedidosReporte(pedidos, configPeriodo, filtroVenta),
    [pedidos, configPeriodo, filtroVenta]
  );

  const resumen = useMemo(
    () => calcularResumenReporte(pedidosFiltrados),
    [pedidosFiltrados]
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

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-top">
          <h1>Reportes</h1>
          <p className="reportes-periodo-activo">
            {etiquetaPeriodoReporte(configPeriodo)}
          </p>
        </div>
      </header>

      <main className="dashboard-main">
        <DashboardNav activo="reportes" />

        <section className="reportes-vista">
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
        </section>
      </main>
    </div>
  );
}
