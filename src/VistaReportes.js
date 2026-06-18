import { useEffect, useMemo, useState } from 'react';
import './App.css';
import DashboardNav from './DashboardNav';
import {
  calcularResumenReporte,
  etiquetaFiltroVentaReporte,
  etiquetaPeriodoReporte,
  etiquetaTipoEntregaReporte,
  exportarReportePdf,
  FILTROS_VENTA_REPORTE,
  filtrarPedidosReporte,
  formatearClienteReporte,
  formatearFechaPedidoReporte,
  formatearProductosReporte,
  obtenerRangoPeriodoReporte,
  PERIODOS_REPORTE,
} from './reportesHelpers';
import { supabase } from './supabase';

export default function VistaReportes() {
  const [periodo, setPeriodo] = useState(PERIODOS_REPORTE.SEMANA);
  const [filtroVenta, setFiltroVenta] = useState('todos');
  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let activo = true;

    const cargarPedidos = async () => {
      setCargando(true);
      setError(null);

      const { inicio } = obtenerRangoPeriodoReporte(periodo);
      const { data, error: errorConsulta } = await supabase
        .from('pedidos')
        .select('*')
        .gte('created_at', inicio.toISOString())
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
  }, [periodo]);

  const pedidosFiltrados = useMemo(
    () => filtrarPedidosReporte(pedidos, periodo, filtroVenta),
    [pedidos, periodo, filtroVenta]
  );

  const resumen = useMemo(
    () => calcularResumenReporte(pedidosFiltrados),
    [pedidosFiltrados]
  );

  const exportarPdf = () => {
    exportarReportePdf({
      periodo,
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
          <p className="reportes-periodo-activo">{etiquetaPeriodoReporte(periodo)}</p>
        </div>
      </header>

      <main className="dashboard-main">
        <DashboardNav activo="reportes" />

        <section className="reportes-vista">
          <div className="reportes-controles">
            <div className="reportes-control-grupo">
              <span className="reportes-control-etiqueta">Período</span>
              <nav className="reportes-periodo-nav" aria-label="Período del reporte">
                <button
                  type="button"
                  className={`reportes-periodo-btn${
                    periodo === PERIODOS_REPORTE.SEMANA ? ' activo' : ''
                  }`}
                  onClick={() => setPeriodo(PERIODOS_REPORTE.SEMANA)}
                >
                  Semana
                </button>
                <button
                  type="button"
                  className={`reportes-periodo-btn${
                    periodo === PERIODOS_REPORTE.MES ? ' activo' : ''
                  }`}
                  onClick={() => setPeriodo(PERIODOS_REPORTE.MES)}
                >
                  Mes
                </button>
              </nav>
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
              disabled={cargando}
            >
              Exportar PDF
            </button>
          </div>

          <p className="reportes-filtro-activo">
            Filtro activo: <strong>{etiquetaFiltroVentaReporte(filtroVenta)}</strong>
          </p>

          <div className="reportes-resumen">
            <article className="reportes-resumen-card">
              <span className="reportes-resumen-label">Total de pedidos</span>
              <span className="reportes-resumen-valor">{resumen.totalPedidos}</span>
            </article>
            <article className="reportes-resumen-card">
              <span className="reportes-resumen-label">Monto acumulado</span>
              <span className="reportes-resumen-valor reportes-resumen-valor-monto">
                ${resumen.montoAcumulado.toFixed(2)}
              </span>
            </article>
          </div>

          {cargando ? (
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
                    ${Number(pedido.total || 0).toFixed(2)}
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
