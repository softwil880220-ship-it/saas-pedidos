import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import './VistaCocinaMostrador.css';
import BotonCerrarSesion from './BotonCerrarSesion';
import { useAuth } from './AuthContext';
import { cargarJornadaAbierta } from './jornadaHelpers';
import {
  esPedidoProgramado,
  formatearProgramadoParaBadge,
  INTERVALO_REASIGNACION_JORNADA_MS,
  MINUTOS_ANTICIPACION_COCINA_DEFAULT,
  normalizarMinutosAnticipacionCocina,
  pedidosProgramadosPendientesReasignacion,
  pedidoWhatsappEnTabProgramadosCocina,
  pedidoWhatsappEnTabTiempoRealCocina,
} from './pedidosProgramadosHelpers';
import useVariantesCtx from './useVariantesCtx';
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
import {
  ejecutarConTimeout,
  esErrorRed,
  mensajeErrorOperacionRed,
} from './networkHelpers';

const TABS_COLUMNA_DERECHA = [
  { value: 'tiempo-real', label: 'Tiempo real' },
  { value: 'programados', label: 'Programados' },
];

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
  variantesCtx,
  badgeProgramado,
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
          {badgeProgramado ? (
            <span className="vista-cocina-badge-programado">{badgeProgramado}</span>
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

      <DesgloseProductosPedido
        pedido={pedidoEnriquecido}
        mostrarTotal={false}
        filtrarCocina={cocina}
        sinPrecio
        variantesCtx={variantesCtx}
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

      {nombreCaptura ? (
        <p className="vista-cocina-captura">
          Capturado por: {nombreCaptura}
        </p>
      ) : null}
    </article>
  );
}

function ColumnaCocina({ titulo, pedidos, vacioMensaje, resolverBadgeProgramado, ...tarjetaProps }) {
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
                badgeProgramado={resolverBadgeProgramado?.(pedido) ?? null}
                {...tarjetaProps}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

function ColumnaCocinaDerecha({
  pedidosMostrador,
  pedidosWhatsapp,
  tabActivo,
  onTabChange,
  conteosTabs,
  jornadaAbiertaId,
  minutosAnticipacion,
  relojCocina,
  ...tarjetaProps
}) {
  const pedidosFiltrados = useMemo(() => {
    if (tabActivo === 'programados') {
      return pedidosWhatsapp.filter((pedido) =>
        pedidoWhatsappEnTabProgramadosCocina(
          pedido,
          jornadaAbiertaId,
          minutosAnticipacion,
          relojCocina
        )
      );
    }

    const whatsappTiempoReal = pedidosWhatsapp.filter((pedido) =>
      pedidoWhatsappEnTabTiempoRealCocina(
        pedido,
        jornadaAbiertaId,
        minutosAnticipacion,
        relojCocina
      )
    );

    return [...pedidosMostrador, ...whatsappTiempoReal];
  }, [
    tabActivo,
    pedidosMostrador,
    pedidosWhatsapp,
    jornadaAbiertaId,
    minutosAnticipacion,
    relojCocina,
  ]);

  const resolverBadgeProgramado = useCallback(
    (pedido) => {
      if (!esPedidoWhatsapp(pedido) || !esPedidoProgramado(pedido)) return null;

      if (tabActivo === 'programados') {
        return formatearProgramadoParaBadge(pedido.programado_para);
      }

      if (
        pedidoWhatsappEnTabTiempoRealCocina(
          pedido,
          jornadaAbiertaId,
          minutosAnticipacion,
          relojCocina
        )
      ) {
        return formatearProgramadoParaBadge(pedido.programado_para);
      }

      return null;
    },
    [tabActivo, jornadaAbiertaId, minutosAnticipacion, relojCocina]
  );

  const vacioMensaje =
    tabActivo === 'programados'
      ? 'No hay pedidos programados en cola'
      : 'No hay pedidos de mostrador ni recoger/domicilio en cola';

  return (
    <section className="vista-cocina-columna vista-cocina-columna-derecha">
      <nav className="vista-cocina-columna-tabs" aria-label="Filtro de pedidos programados">
        {TABS_COLUMNA_DERECHA.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className={`vista-cocina-columna-tab${tabActivo === value ? ' activo' : ''}`}
            onClick={() => onTabChange(value)}
          >
            {label} ({conteosTabs[value] ?? 0})
          </button>
        ))}
      </nav>

      <header className="vista-cocina-columna-cabecera">
        <h2 className="vista-cocina-columna-titulo">Mostrador y recoger/domicilio</h2>
        <span className="vista-cocina-columna-contador">{pedidosFiltrados.length} en cola</span>
      </header>

      {pedidosFiltrados.length === 0 ? (
        <p className="vista-operativa-vacio vista-cocina-columna-vacio">{vacioMensaje}</p>
      ) : (
        <div className="vista-operativa-grid vista-cocina-columna-grid">
          {pedidosFiltrados.map((pedido) => {
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
                badgeProgramado={resolverBadgeProgramado(pedido)}
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
  const { variantesCtx } = useVariantesCtx(negocioId, productos);
  const [nombresCapturaPorId, setNombresCapturaPorId] = useState({});
  const [mostradorFlujoCocina, setMostradorFlujoCocina] = useState(0);
  const [minutosAnticipacion, setMinutosAnticipacion] = useState(
    MINUTOS_ANTICIPACION_COCINA_DEFAULT
  );
  const [jornadaAbierta, setJornadaAbierta] = useState(null);
  const [tabColumnaDerecha, setTabColumnaDerecha] = useState('tiempo-real');
  const [relojCocina, setRelojCocina] = useState(() => new Date());
  const pedidosRef = useRef([]);

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
  const [errorActualizacion, setErrorActualizacion] = useState(null);

  pedidosRef.current = pedidos;

  useEffect(() => {
    if (!errorActualizacion) return undefined;

    const timeoutId = setTimeout(() => setErrorActualizacion(null), 8000);
    return () => clearTimeout(timeoutId);
  }, [errorActualizacion]);

  useEffect(() => {
    if (!negocioId) {
      setMostradorFlujoCocina(0);
      setMinutosAnticipacion(MINUTOS_ANTICIPACION_COCINA_DEFAULT);
      return;
    }

    let activo = true;

    const cargarConfigNegocio = async () => {
      const { data, error } = await supabase
        .from('negocios')
        .select('mostrador_flujo_cocina, minutos_anticipacion_cocina')
        .eq('id', negocioId)
        .maybeSingle();

      if (!activo || error) return;

      const flujo = Number(data?.mostrador_flujo_cocina);
      setMostradorFlujoCocina(
        Number.isFinite(flujo) && flujo >= 0 && flujo <= 3 ? flujo : 0
      );
      setMinutosAnticipacion(normalizarMinutosAnticipacionCocina(data?.minutos_anticipacion_cocina));
    };

    void cargarConfigNegocio();

    return () => {
      activo = false;
    };
  }, [negocioId]);

  const recargarJornadaAbierta = useCallback(async () => {
    if (!negocioId) {
      setJornadaAbierta(null);
      return;
    }

    const { data } = await cargarJornadaAbierta(supabase, negocioId);
    setJornadaAbierta(data);
  }, [negocioId]);

  useEffect(() => {
    void recargarJornadaAbierta();
  }, [recargarJornadaAbierta]);

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

  const reasignarJornadasProgramadas = useCallback(async () => {
    const jornadaId = jornadaAbierta?.id;
    if (!negocioId || !jornadaId) return;

    const ahora = new Date();
    const pendientes = pedidosProgramadosPendientesReasignacion(
      pedidosRef.current,
      jornadaId,
      minutosAnticipacion,
      ahora
    );

    if (pendientes.length === 0) return;

    await Promise.all(
      pendientes.map(async (pedido) => {
        const { error } = await queryConNegocio(
          supabase
            .from('pedidos')
            .update({ jornada_id: jornadaId })
            .eq('id', pedido.id),
          negocioId
        );

        if (!error) {
          setPedidos((prev) =>
            prev.map((item) =>
              item.id === pedido.id ? { ...item, jornada_id: jornadaId } : item
            )
          );
        }
      })
    );
  }, [negocioId, jornadaAbierta?.id, minutosAnticipacion, setPedidos]);

  useEffect(() => {
    if (!negocioId) return undefined;

    const tick = () => {
      setRelojCocina(new Date());
      void recargarJornadaAbierta();
      void reasignarJornadasProgramadas();
    };

    tick();
    const intervaloId = setInterval(tick, INTERVALO_REASIGNACION_JORNADA_MS);

    return () => clearInterval(intervaloId);
  }, [negocioId, recargarJornadaAbierta, reasignarJornadasProgramadas]);

  const aplicarUpdatePedido = useCallback(
    (pedido, update) => {
      if (!update) return;

      setActualizandoId(pedido.id);
      setErrorActualizacion(null);

      void (async () => {
        try {
          const { error } = await ejecutarConTimeout(
            queryConNegocio(
              supabase.from('pedidos').update(update).eq('id', pedido.id),
              negocioId
            )
          );

          if (error) {
            setErrorActualizacion(
              esErrorRed(error)
                ? mensajeErrorOperacionRed(error)
                : 'No se pudo guardar. El pedido sigue en cola — intenta de nuevo.'
            );
            return;
          }

          setPedidos((prev) => {
            if (pedidoPermaneceEnCocinaTrasUpdate(pedido, update, mostradorFlujoCocina)) {
              return prev.map((item) =>
                item.id === pedido.id ? { ...item, ...update } : item
              );
            }
            return prev.filter((item) => item.id !== pedido.id);
          });
        } catch (error) {
          setErrorActualizacion(mensajeErrorOperacionRed(error));
        } finally {
          setActualizandoId(null);
        }
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

  const pedidosDerechaBase = useMemo(
    () =>
      pedidos.filter((pedido) =>
        pedidoVisibleEnCocinaColumnaDerecha(pedido, mostradorFlujoCocina)
      ),
    [pedidos, mostradorFlujoCocina]
  );

  const pedidosMostradorDerecha = useMemo(
    () => pedidosDerechaBase.filter((pedido) => esPedidoMostrador(pedido)),
    [pedidosDerechaBase]
  );

  const pedidosWhatsappDerecha = useMemo(
    () => pedidosDerechaBase.filter((pedido) => esPedidoWhatsapp(pedido)),
    [pedidosDerechaBase]
  );

  const conteosTabsColumnaDerecha = useMemo(() => {
    const jornadaId = jornadaAbierta?.id ?? null;

    const programados = pedidosWhatsappDerecha.filter((pedido) =>
      pedidoWhatsappEnTabProgramadosCocina(
        pedido,
        jornadaId,
        minutosAnticipacion,
        relojCocina
      )
    ).length;

    const whatsappTiempoReal = pedidosWhatsappDerecha.filter((pedido) =>
      pedidoWhatsappEnTabTiempoRealCocina(
        pedido,
        jornadaId,
        minutosAnticipacion,
        relojCocina
      )
    ).length;

    return {
      'tiempo-real': pedidosMostradorDerecha.length + whatsappTiempoReal,
      programados,
    };
  }, [
    pedidosMostradorDerecha,
    pedidosWhatsappDerecha,
    jornadaAbierta?.id,
    minutosAnticipacion,
    relojCocina,
  ]);

  const tarjetaProps = {
    cocina,
    productos,
    mostradorFlujoCocina,
    actualizandoId,
    nombresCapturaPorId,
    variantesCtx,
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

      {errorActualizacion ? (
        <p className="formulario-error-guardar vista-cocina-error-actualizacion" role="alert">
          {errorActualizacion}
        </p>
      ) : null}

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
          <ColumnaCocinaDerecha
            pedidosMostrador={pedidosMostradorDerecha}
            pedidosWhatsapp={pedidosWhatsappDerecha}
            tabActivo={tabColumnaDerecha}
            onTabChange={setTabColumnaDerecha}
            conteosTabs={conteosTabsColumnaDerecha}
            jornadaAbiertaId={jornadaAbierta?.id ?? null}
            minutosAnticipacion={minutosAnticipacion}
            relojCocina={relojCocina}
            {...tarjetaProps}
          />
        </div>
      )}
    </div>
  );
}
