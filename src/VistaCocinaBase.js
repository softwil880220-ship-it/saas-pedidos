import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';
import './VistaCocinaMostrador.css';
import BotonCerrarSesion from './BotonCerrarSesion';
import { useAuth } from './AuthContext';
import {
  DesgloseProductosPedido,
  ETIQUETA_CANAL_MOSTRADOR,
  botonesMostradorCocina,
  construirUpdateAlMarcarCocinaLista,
  construirUpdateMostradorEnPreparacion,
  construirUpdateMostradorEntregado,
  enriquecerLineasDetalleCocina,
  esPedidoMostrador,
  esPedidoWhatsapp,
  etiquetaCanalEntregaCocina,
  formatearFechaHoraCocina,
  pedidoVisibleEnCocina,
  pedidoVisibleEnCocinaColumnaDerecha,
  pedidoVisibleEnCocinaColumnaIzquierda,
  resolverNombreCapturaPedido,
} from './pedidosShared';
import { supabase } from './supabase';
import { queryConNegocio } from './tenantHelpers';
import { usePedidosRealtime, useProductosRealtime } from './usePedidosRealtime';

function pedidoPermaneceEnCocinaTrasUpdate(pedido, update, mostradorFlujoCocina) {
  return (
    esPedidoMostrador(pedido) &&
    mostradorFlujoCocina === 3 &&
    update?.status === 'listo-para-recoger'
  );
}

function TarjetaPedidoCocina({
  pedido,
  pedidoEnriquecido,
  nombreCaptura,
  cocina,
  mostradorFlujoCocina,
  actualizandoId,
  onMarcarEnPreparacion,
  onMarcarListo,
  onMarcarEntregado,
}) {
  const esWhatsapp = esPedidoWhatsapp(pedido);
  const esMostrador = esPedidoMostrador(pedido);
  const botonesMostrador = botonesMostradorCocina(mostradorFlujoCocina, pedido);

  return (
    <article className="vista-operativa-tarjeta">
      <div className="vista-operativa-tarjeta-cabecera">
        <div className="vista-operativa-tarjeta-titulo">
          <h2 className="vista-operativa-cliente">{pedido.cliente}</h2>
          {esWhatsapp ? (
            <span className="vista-operativa-canal">
              {etiquetaCanalEntregaCocina(pedido.tipo_entrega)}
            </span>
          ) : null}
          {esMostrador ? (
            <span className="vista-operativa-canal vista-operativa-canal-texto">
              {ETIQUETA_CANAL_MOSTRADOR}
            </span>
          ) : null}
        </div>
        <div className="vista-operativa-tarjeta-meta">
          {pedido.folio != null ? (
            <span className="vista-operativa-folio">{pedido.folio}</span>
          ) : null}
          {pedido.tipo === 'mesa' && pedido.referencia ? (
            <span className="vista-operativa-ronda">{pedido.referencia}</span>
          ) : null}
          <time className="vista-operativa-fecha-hora" dateTime={pedido.created_at}>
            {formatearFechaHoraCocina(pedido.created_at)}
          </time>
        </div>
      </div>

      {nombreCaptura ? (
        <p className="vista-operativa-captura">
          Capturado por: <span>{nombreCaptura}</span>
        </p>
      ) : null}

      <DesgloseProductosPedido
        pedido={pedidoEnriquecido}
        mostrarTotal={false}
        filtrarCocina={cocina}
      />

      <div className="vista-operativa-acciones">
        {esMostrador ? (
          <>
            {botonesMostrador.enPreparacion ? (
              <button
                type="button"
                className="vista-operativa-btn en-preparacion-btn"
                disabled={actualizandoId === pedido.id}
                onClick={() => onMarcarEnPreparacion(pedidoEnriquecido)}
              >
                {actualizandoId === pedido.id ? 'Guardando...' : 'En preparación'}
              </button>
            ) : null}
            {botonesMostrador.listo ? (
              <button
                type="button"
                className="vista-operativa-btn listo-btn"
                disabled={actualizandoId === pedido.id}
                onClick={() => onMarcarListo(pedidoEnriquecido)}
              >
                {actualizandoId === pedido.id ? 'Guardando...' : 'Listo'}
              </button>
            ) : null}
            {botonesMostrador.entregado ? (
              <button
                type="button"
                className="vista-operativa-btn entregado-btn"
                disabled={actualizandoId === pedido.id}
                onClick={() => onMarcarEntregado(pedidoEnriquecido)}
              >
                {actualizandoId === pedido.id ? 'Guardando...' : 'Entregado'}
              </button>
            ) : null}
          </>
        ) : (
          <button
            type="button"
            className="vista-operativa-btn listo-btn"
            disabled={actualizandoId === pedido.id}
            onClick={() => onMarcarListo(pedidoEnriquecido)}
          >
            {actualizandoId === pedido.id ? 'Guardando...' : 'Listo'}
          </button>
        )}
      </div>
    </article>
  );
}

function ColumnaCocina({ titulo, pedidos, vacioMensaje, ...tarjetaProps }) {
  return (
    <section className="vista-cocina-columna">
      <header className="vista-cocina-columna-cabecera">
        <h2 className="vista-cocina-columna-titulo">{titulo}</h2>
        <span className="vista-cocina-columna-contador">{pedidos.length} en cola</span>
      </header>
      {pedidos.length === 0 ? (
        <p className="vista-operativa-vacio vista-cocina-columna-vacio">{vacioMensaje}</p>
      ) : (
        <div className="vista-operativa-grid vista-cocina-columna-grid">
          {pedidos.map((pedido) => {
            const pedidoEnriquecido = enriquecerLineasDetalleCocina(
              pedido,
              tarjetaProps.productos
            );
            const nombreCaptura = resolverNombreCapturaPedido(
              pedido,
              tarjetaProps.nombresCapturaPorId
            );

            return (
              <TarjetaPedidoCocina
                key={pedido.id}
                pedido={pedido}
                pedidoEnriquecido={pedidoEnriquecido}
                nombreCaptura={nombreCaptura}
                {...tarjetaProps}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function VistaCocinaBase({ cocina, titulo, channelName, claseVista }) {
  const { negocioId } = useAuth();
  const { productos } = useProductosRealtime({
    channelName: `${channelName}-productos`,
    negocioId,
  });
  const [nombresCapturaPorId, setNombresCapturaPorId] = useState({});
  const [mostradorFlujoCocina, setMostradorFlujoCocina] = useState(0);

  const filtrarPedidos = useCallback(
    (pedido) =>
      pedidoVisibleEnCocina(
        enriquecerLineasDetalleCocina(pedido, productos),
        cocina,
        productos,
        mostradorFlujoCocina
      ),
    [cocina, productos, mostradorFlujoCocina]
  );
  const compararPedidos = useCallback(
    (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0),
    []
  );

  const { pedidos, setPedidos, cargando } = usePedidosRealtime({
    channelName,
    negocioId,
    filtrar: filtrarPedidos,
    comparar: compararPedidos,
  });
  const [actualizandoId, setActualizandoId] = useState(null);

  useEffect(() => {
    if (!negocioId) {
      setMostradorFlujoCocina(0);
      return;
    }

    let activo = true;

    const cargarFlujoMostrador = async () => {
      const { data, error } = await supabase
        .from('negocios')
        .select('mostrador_flujo_cocina')
        .eq('id', negocioId)
        .maybeSingle();

      if (!activo || error) return;

      const flujo = Number(data?.mostrador_flujo_cocina);
      setMostradorFlujoCocina(
        Number.isFinite(flujo) && flujo >= 0 && flujo <= 3 ? flujo : 0
      );
    };

    void cargarFlujoMostrador();

    return () => {
      activo = false;
    };
  }, [negocioId]);

  useEffect(() => {
    if (!negocioId) {
      setNombresCapturaPorId({});
      return;
    }

    let activo = true;

    const cargarNombresCaptura = async () => {
      const { data, error } = await queryConNegocio(
        supabase.from('usuarios_negocio').select('id, nombre').eq('activo', true),
        negocioId
      );

      if (!activo || error || !data) {
        return;
      }

      setNombresCapturaPorId(
        Object.fromEntries(data.map((usuario) => [String(usuario.id), usuario.nombre]))
      );
    };

    void cargarNombresCaptura();

    return () => {
      activo = false;
    };
  }, [negocioId]);

  const aplicarUpdatePedido = useCallback(
    (pedido, update) => {
      if (!update) return;

      setActualizandoId(pedido.id);

      void (async () => {
        const { error } = await queryConNegocio(
          supabase.from('pedidos').update(update).eq('id', pedido.id),
          negocioId
        );

        if (!error) {
          setPedidos((prev) => {
            if (pedidoPermaneceEnCocinaTrasUpdate(pedido, update, mostradorFlujoCocina)) {
              return prev.map((item) =>
                item.id === pedido.id ? { ...item, ...update } : item
              );
            }
            return prev.filter((item) => item.id !== pedido.id);
          });
        }

        setActualizandoId(null);
      })();
    },
    [negocioId, mostradorFlujoCocina, setPedidos]
  );

  const marcarListo = useCallback(
    (pedido) => {
      const update = construirUpdateAlMarcarCocinaLista(pedido, cocina);
      aplicarUpdatePedido(pedido, update);
    },
    [aplicarUpdatePedido, cocina]
  );

  const marcarEnPreparacion = useCallback(
    (pedido) => {
      const update = construirUpdateMostradorEnPreparacion(pedido);
      aplicarUpdatePedido(pedido, update);
    },
    [aplicarUpdatePedido]
  );

  const marcarEntregado = useCallback(
    (pedido) => {
      const update = construirUpdateMostradorEntregado(pedido);
      aplicarUpdatePedido(pedido, update);
    },
    [aplicarUpdatePedido]
  );

  const pedidosColumnaIzquierda = useMemo(
    () => pedidos.filter((pedido) => pedidoVisibleEnCocinaColumnaIzquierda(pedido)),
    [pedidos]
  );

  const pedidosColumnaDerecha = useMemo(
    () =>
      pedidos.filter((pedido) =>
        pedidoVisibleEnCocinaColumnaDerecha(pedido, mostradorFlujoCocina)
      ),
    [pedidos, mostradorFlujoCocina]
  );

  const tarjetaProps = {
    cocina,
    productos,
    mostradorFlujoCocina,
    actualizandoId,
    nombresCapturaPorId,
    onMarcarEnPreparacion: marcarEnPreparacion,
    onMarcarListo: marcarListo,
    onMarcarEntregado: marcarEntregado,
  };

  return (
    <div className={`vista-operativa ${claseVista}`}>
      <header className="vista-operativa-header vista-operativa-header-con-acciones">
        <div className="vista-operativa-header-contenido">
          <h1>{titulo}</h1>
          <p className="vista-operativa-subtitulo">
            Pedidos en preparación · actualización en tiempo real
          </p>
          <span className="vista-operativa-contador">{pedidos.length} en cola</span>
        </div>
        <BotonCerrarSesion />
      </header>

      {cargando ? (
        <p className="vista-operativa-vacio">Cargando pedidos...</p>
      ) : pedidos.length === 0 ? (
        <p className="vista-operativa-vacio">No hay pedidos en {titulo.toLowerCase()}</p>
      ) : (
        <div className="vista-cocina-dos-columnas">
          <ColumnaCocina
            titulo="Mesas"
            pedidos={pedidosColumnaIzquierda}
            vacioMensaje="No hay pedidos de mesas en cola"
            {...tarjetaProps}
          />
          <ColumnaCocina
            titulo="Mostrador y recoger/domicilio"
            pedidos={pedidosColumnaDerecha}
            vacioMensaje="No hay pedidos de mostrador ni recoger/domicilio en cola"
            {...tarjetaProps}
          />
        </div>
      )}
    </div>
  );
}
