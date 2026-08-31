import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';
import './VistaCocinaMostrador.css';
import BotonCerrarSesion from './BotonCerrarSesion';
import { useAuth } from './AuthContext';
import { cargarJornadaAbierta } from './jornadaHelpers';
import { cargarTabRepartidor, persistirTabRepartidor } from './pedidoCarritoStorage';
import { formatearMoneda, siguienteStatus } from './pedidosShared';
import { formatearEncabezadoGrupoJornada } from './reportesHelpers';
import {
  TABS_REPARTIDOR,
  concentradoCobrosPorFormaPago,
  filtrarPedidosRepartidorPorTab,
  filtrarPedidosRepartidorRealtime,
  resumenEntregadosRepartidor,
} from './repartidorHelpers';
import { supabase } from './supabase';
import TarjetaPedidoRepartidor from './TarjetaPedidoRepartidor';
import { queryConNegocio } from './tenantHelpers';
import useVariantesCtx from './useVariantesCtx';
import { usePedidosRealtime, useProductosRealtime } from './usePedidosRealtime';

const compararPedidosPorEntregar = (a, b) => {
  const fechaA = new Date(a.created_at || 0);
  const fechaB = new Date(b.created_at || 0);
  return fechaA - fechaB;
};

const compararPedidosEntregados = (a, b) => {
  const fechaA = new Date(a.entregado_en || a.created_at || 0);
  const fechaB = new Date(b.entregado_en || b.created_at || 0);
  return fechaB - fechaA;
};

export default function VistaRepartidor() {
  const { negocioId, usuario, rol } = useAuth();
  const [tabActivo, setTabActivo] = useState(() => cargarTabRepartidor());
  const [jornadaAbierta, setJornadaAbierta] = useState(null);
  const [cargandoJornada, setCargandoJornada] = useState(true);
  const [actualizandoId, setActualizandoId] = useState(null);

  const contextoVisibilidad = useMemo(
    () => ({
      usuarioId: usuario?.id ?? null,
      rol: rol ?? null,
    }),
    [usuario?.id, rol]
  );

  const { pedidos, setPedidos, cargando } = usePedidosRealtime({
    channelName: 'repartidor-pedidos',
    negocioId,
    filtrar: filtrarPedidosRepartidorRealtime,
  });

  const { productos } = useProductosRealtime({ negocioId });
  const variantesCtx = useVariantesCtx();

  useEffect(() => {
    persistirTabRepartidor(tabActivo);
  }, [tabActivo]);

  const recargarJornadaAbierta = useCallback(async () => {
    if (!negocioId) {
      setJornadaAbierta(null);
      setCargandoJornada(false);
      return;
    }

    setCargandoJornada(true);
    const { data } = await cargarJornadaAbierta(supabase, negocioId);
    setJornadaAbierta(data);
    setCargandoJornada(false);
  }, [negocioId]);

  useEffect(() => {
    void recargarJornadaAbierta();
  }, [recargarJornadaAbierta]);

  const pedidosPorEntregar = useMemo(() => {
    const filtrados = filtrarPedidosRepartidorPorTab(
      pedidos,
      'por-entregar',
      jornadaAbierta,
      contextoVisibilidad
    );
    return [...filtrados].sort(compararPedidosPorEntregar);
  }, [pedidos, jornadaAbierta, contextoVisibilidad]);

  const pedidosEntregados = useMemo(() => {
    const filtrados = filtrarPedidosRepartidorPorTab(
      pedidos,
      'entregados',
      jornadaAbierta,
      contextoVisibilidad
    );
    return [...filtrados].sort(compararPedidosEntregados);
  }, [pedidos, jornadaAbierta, contextoVisibilidad]);

  const conteosTabs = useMemo(
    () => ({
      'por-entregar': pedidosPorEntregar.length,
      entregados: pedidosEntregados.length,
    }),
    [pedidosPorEntregar.length, pedidosEntregados.length]
  );

  const resumenEntregados = useMemo(
    () => resumenEntregadosRepartidor(pedidosEntregados),
    [pedidosEntregados]
  );

  const concentradoCobros = useMemo(
    () => concentradoCobrosPorFormaPago(pedidosEntregados),
    [pedidosEntregados]
  );

  const marcarEntregado = async (pedido) => {
    const nuevoStatus = siguienteStatus(pedido.status, pedido.tipo_entrega);
    if (nuevoStatus === pedido.status) return;

    const entregadoEn = new Date().toISOString();

    setActualizandoId(pedido.id);
    const { error } = await queryConNegocio(
      supabase
        .from('pedidos')
        .update({ status: nuevoStatus, entregado_en: entregadoEn })
        .eq('id', pedido.id),
      negocioId
    );

    if (!error) {
      setPedidos((prev) =>
        prev.map((item) =>
          item.id === pedido.id
            ? { ...item, status: nuevoStatus, entregado_en: entregadoEn }
            : item
        )
      );
    }
    setActualizandoId(null);
  };

  const pedidosVisibles = tabActivo === 'entregados' ? pedidosEntregados : pedidosPorEntregar;
  const subtitulo =
    tabActivo === 'entregados'
      ? 'Entregas completadas en la jornada activa'
      : 'Pedidos en camino · actualización en tiempo real';

  return (
    <div className="vista-operativa vista-repartidor">
      <header className="vista-operativa-header vista-operativa-header-con-acciones">
        <div className="vista-operativa-header-contenido">
          <h1>Repartidor</h1>
          <p className="vista-operativa-subtitulo">{subtitulo}</p>
          {cargandoJornada ? (
            <p className="vista-repartidor-jornada">Cargando jornada...</p>
          ) : jornadaAbierta ? (
            <p className="vista-repartidor-jornada header-stat-fecha">
              {formatearEncabezadoGrupoJornada(jornadaAbierta)}
            </p>
          ) : (
            <p className="vista-repartidor-jornada vista-repartidor-jornada-inactiva">
              Sin jornada activa
            </p>
          )}
        </div>
        <BotonCerrarSesion />
      </header>

      <nav className="vista-cocina-columna-tabs vista-repartidor-tabs" aria-label="Entregas">
        {TABS_REPARTIDOR.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className={`vista-cocina-columna-tab${tabActivo === value ? ' activo' : ''}`}
            onClick={() => setTabActivo(value)}
          >
            {label} ({conteosTabs[value] ?? 0})
          </button>
        ))}
      </nav>

      {tabActivo === 'entregados' ? (
        <section className="vista-repartidor-resumen-entregados" aria-label="Resumen de entregas">
          {!jornadaAbierta?.id ? (
            <p className="vista-operativa-vacio">No hay jornada activa</p>
          ) : (
            <>
              <div className="vista-repartidor-resumen-totales">
                <p>
                  <strong>{resumenEntregados.cantidad}</strong> pedido
                  {resumenEntregados.cantidad === 1 ? '' : 's'} entregado
                  {resumenEntregados.cantidad === 1 ? '' : 's'}
                </p>
                <p className="vista-repartidor-resumen-monto">
                  Total entregado: {formatearMoneda(resumenEntregados.suma)}
                </p>
              </div>
              {concentradoCobros.length > 0 ? (
                <div className="vista-repartidor-concentrado-cobros">
                  <h2 className="vista-repartidor-concentrado-titulo">Concentrado de cobros</h2>
                  <ul className="vista-repartidor-concentrado-lista">
                    {concentradoCobros.map((item) => (
                      <li key={item.forma} className="vista-repartidor-concentrado-fila">
                        <span>
                          {item.etiqueta}: {formatearMoneda(item.total)}
                        </span>
                        <span className="vista-repartidor-concentrado-cantidad">
                          {item.cantidad} pedido{item.cantidad === 1 ? '' : 's'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {cargando ? (
        <p className="vista-operativa-vacio">Cargando pedidos...</p>
      ) : pedidosVisibles.length === 0 ? (
        <p className="vista-operativa-vacio">
          {tabActivo === 'entregados'
            ? jornadaAbierta?.id
              ? 'No hay entregas en esta jornada'
              : 'No hay jornada activa'
            : 'No hay pedidos por entregar'}
        </p>
      ) : (
        <div className="vista-operativa-grid">
          {pedidosVisibles.map((pedido) => (
            <TarjetaPedidoRepartidor
              key={pedido.id}
              pedido={pedido}
              modo={tabActivo === 'entregados' ? 'entregado' : 'por-entregar'}
              productos={productos}
              variantesCtx={variantesCtx}
              actualizandoId={actualizandoId}
              onMarcarEntregado={marcarEntregado}
            />
          ))}
        </div>
      )}
    </div>
  );
}
