import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  cargarMesaActiva,
  cargarTabMesas,
  configurarContextoMesas,
  folioSigueAbierto,
  hidratarFoliosMesas,
  limpiarEstadoCobroMesa,
  limpiarMesaActiva,
  obtenerFolioAbiertoPorMesa,
  obtenerNumeroMesaDeFolio,
  obtenerNumerosMesaOcupados,
  persistirMesaActiva,
  persistirTabMesas,
  MOTIVO_CIERRE_FOLIO_MESA,
  resolverMotivoCierreFolioDesdeRealtime,
  verificarFolioAbiertoEnServidor,
} from './pedidoCarritoStorage';
import { useMesasFoliosRealtime } from './useMesasFoliosRealtime';
import MesaCarritoPanel from './MesaCarritoPanel';
import MesaFoliosCobradosConsulta from './MesaFoliosCobradosConsulta.jsx';

const TABS_MESAS = [
  { value: 'activas', label: 'Mesas activas' },
  { value: 'cobradas', label: 'Cobradas hoy' },
];

export const CANTIDAD_MESAS = 10;

export default function VistaMesas({
  productos,
  productosOrdenados,
  frecuenciaCategorias,
  frecuenciaLista,
  variantesCtx,
  negocioId,
  usuarioId,
  rol,
}) {
  const [hidrato, setHidrato] = useState(false);
  const [errorHidratacion, setErrorHidratacion] = useState(null);
  const [tabActivo, setTabActivo] = useState(() => cargarTabMesas());
  const [mesasOcupadas, setMesasOcupadas] = useState(() => obtenerNumerosMesaOcupados());
  const [panelMesa, setPanelMesa] = useState(null);
  const [folioCacheActualizado, setFolioCacheActualizado] = useState({
    revision: 0,
    folioId: null,
    eventType: null,
  });
  const [motivoCierreFolio, setMotivoCierreFolio] = useState(null);
  const motivoCierreFolioRef = useRef(null);
  const panelMesaRef = useRef(panelMesa);

  useEffect(() => {
    panelMesaRef.current = panelMesa;
  }, [panelMesa]);

  const cerrarFolioPanelRemoto = useCallback((motivo) => {
    if (motivo) {
      motivoCierreFolioRef.current = motivo;
      setMotivoCierreFolio(motivo);
    }

    setPanelMesa((prev) => (prev ? { ...prev, folioId: null } : prev));
    limpiarMesaActiva();
    limpiarEstadoCobroMesa();
    setMesasOcupadas(obtenerNumerosMesaOcupados());
  }, []);

  const handleFolioEliminado = useCallback((motivo = null) => {
    cerrarFolioPanelRemoto(motivo);
  }, [cerrarFolioPanelRemoto]);

  const handleMotivoCierreFolioConsumido = useCallback(() => {
    motivoCierreFolioRef.current = null;
    setMotivoCierreFolio(null);
  }, []);

  const handleFolioCerrado = useCallback(() => {
    setPanelMesa((prev) => (prev ? { ...prev, folioId: null } : prev));
    limpiarMesaActiva();
    limpiarEstadoCobroMesa();
    setMesasOcupadas(obtenerNumerosMesaOcupados());
  }, []);

  const handleFolioCreadoRemoto = useCallback((folioId) => {
    setPanelMesa((prev) => (prev ? { ...prev, folioId } : prev));
    persistirMesaActiva(folioId);
  }, []);

  const sincronizarOcupacion = useCallback(async () => {
    setMesasOcupadas(obtenerNumerosMesaOcupados());

    const panel = panelMesaRef.current;

    if (panel?.folioId && !folioSigueAbierto(panel.folioId)) {
      const estadoServidor = await verificarFolioAbiertoEnServidor(
        panel.folioId,
        negocioId
      );

      if (estadoServidor === 'cerrada') {
        handleFolioEliminado(MOTIVO_CIERRE_FOLIO_MESA.COBRADA_REMOTO);
        return;
      }

      if (estadoServidor === 'eliminado') {
        handleFolioEliminado(MOTIVO_CIERRE_FOLIO_MESA.MODIFICADA_SIN_COBRAR);
        return;
      }

      if (estadoServidor === null) {
        return;
      }

      setMesasOcupadas(obtenerNumerosMesaOcupados());
    }

    const panelActualizado = panelMesaRef.current;

    if (panelActualizado && !panelActualizado.folioId) {
      const folioRemoto = obtenerFolioAbiertoPorMesa(panelActualizado.numero);
      if (folioRemoto) {
        handleFolioCreadoRemoto(folioRemoto);
      }
    }
  }, [handleFolioEliminado, handleFolioCreadoRemoto, negocioId]);

  const manejarCambioCacheMesas = useCallback(
    (detalle) => {
      const panel = panelMesaRef.current;
      const motivoRealtime = resolverMotivoCierreFolioDesdeRealtime(
        detalle,
        panel?.folioId
      );

      if (motivoRealtime) {
        cerrarFolioPanelRemoto(motivoRealtime);
        return;
      }

      void sincronizarOcupacion();

      if (detalle?.folioId && detalle.eventType === 'UPDATE') {
        setFolioCacheActualizado((prev) => ({
          revision: prev.revision + 1,
          folioId: String(detalle.folioId),
          eventType: 'UPDATE',
        }));
      }
    },
    [cerrarFolioPanelRemoto, sincronizarOcupacion]
  );

  useEffect(() => {
    configurarContextoMesas({ usuarioId, rol });
  }, [usuarioId, rol]);

  useEffect(() => {
    persistirTabMesas(tabActivo);
  }, [tabActivo]);

  useEffect(() => {
    const restaurarTabAlMostrarPagina = (evento) => {
      if (!evento.persisted) return;
      setTabActivo(cargarTabMesas());
    };

    window.addEventListener('pageshow', restaurarTabAlMostrarPagina);
    return () => window.removeEventListener('pageshow', restaurarTabAlMostrarPagina);
  }, []);

  useEffect(() => {
    let activo = true;

    const hidratar = async () => {
      setErrorHidratacion(null);

      try {
        await hidratarFoliosMesas(negocioId);
        if (!activo) return;

        setHidrato(true);
        await sincronizarOcupacion();

        const guardada = cargarMesaActiva();
        if (guardada && folioSigueAbierto(guardada)) {
          const numero = obtenerNumeroMesaDeFolio(guardada);
          if (numero != null) {
            setPanelMesa({ numero, folioId: guardada });
          } else {
            limpiarMesaActiva();
          }
        } else if (guardada) {
          limpiarMesaActiva();
        }
      } catch {
        if (!activo) return;
        setErrorHidratacion('No se pudieron cargar las mesas. Intenta recargar la página.');
      }
    };

    void hidratar();

    return () => {
      activo = false;
    };
  }, [negocioId, sincronizarOcupacion]);

  useMesasFoliosRealtime({
    negocioId: hidrato ? negocioId : null,
    onCambio: manejarCambioCacheMesas,
  });

  useEffect(() => {
    const restaurarMesaActivaAlMostrarPagina = (evento) => {
      if (!evento.persisted || !hidrato) return;

      const guardada = cargarMesaActiva();
      if (guardada && folioSigueAbierto(guardada)) {
        const numero = obtenerNumeroMesaDeFolio(guardada);
        setPanelMesa(numero != null ? { numero, folioId: guardada } : null);
      } else {
        setPanelMesa(null);
        if (guardada) {
          limpiarMesaActiva();
        }
      }
      void sincronizarOcupacion();
    };

    window.addEventListener('pageshow', restaurarMesaActivaAlMostrarPagina);
    return () => window.removeEventListener('pageshow', restaurarMesaActivaAlMostrarPagina);
  }, [hidrato, sincronizarOcupacion]);

  const mesas = useMemo(
    () =>
      Array.from({ length: CANTIDAD_MESAS }, (_, indice) => {
        const numero = indice + 1;
        const ocupada = mesasOcupadas.has(String(numero));

        return { numero, ocupada };
      }),
    [mesasOcupadas]
  );

  const abrirMesa = (numero) => {
    if (!hidrato) return;

    const folioExistente = obtenerFolioAbiertoPorMesa(numero);
    setPanelMesa({ numero, folioId: folioExistente });

    if (folioExistente) {
      persistirMesaActiva(folioExistente);
    } else {
      limpiarMesaActiva();
    }
  };

  const cerrarPanel = () => {
    setPanelMesa(null);
    limpiarMesaActiva();
    limpiarEstadoCobroMesa();
    void sincronizarOcupacion();
  };

  const cambiarTabMesas = (value) => {
    if (value === 'activas') {
      setTabActivo(value);
      return;
    }

    cerrarPanel();
    setTabActivo(value);
  };

  const handleFolioCreado = useCallback(
    (folioId) => {
      setPanelMesa((prev) => (prev ? { ...prev, folioId } : prev));
      persistirMesaActiva(folioId);
      void sincronizarOcupacion();
    },
    [sincronizarOcupacion]
  );

  if (!hidrato && !errorHidratacion) {
    return (
      <section className="vista-mesas">
        <h2 className="formulario-titulo">Mesas</h2>
        <p className="vista-mesas-descripcion">Cargando mesas...</p>
      </section>
    );
  }

  return (
    <section className="vista-mesas">
      <h2 className="formulario-titulo">Mesas</h2>
      <p className="vista-mesas-descripcion">
        {tabActivo === 'activas'
          ? 'Selecciona una mesa para abrir o continuar un pedido.'
          : 'Consulta las mesas cobradas hoy.'}
      </p>

      <nav className="seccion-subtabs-nav" aria-label="Secciones de mesas">
        {TABS_MESAS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className={`seccion-subtabs-tab${tabActivo === value ? ' activo' : ''}`}
            onClick={() => cambiarTabMesas(value)}
          >
            {label}
          </button>
        ))}
      </nav>

      {errorHidratacion ? (
        <p className="formulario-error-guardar" role="alert">
          {errorHidratacion}
        </p>
      ) : null}

      {tabActivo === 'activas' ? (
        <>
          <div className="vista-mesas-grilla" role="list" aria-label="Mesas del local">
            {mesas.map(({ numero, ocupada }) => {
              const activa = panelMesa?.numero === numero;

              return (
                <button
                  key={numero}
                  type="button"
                  role="listitem"
                  className={`mesa-tarjeta${ocupada ? ' mesa-tarjeta-ocupada' : ' mesa-tarjeta-disponible'}${
                    activa ? ' mesa-tarjeta-activa' : ''
                  }`}
                  onClick={() => abrirMesa(numero)}
                  aria-pressed={activa}
                >
                  <span className="mesa-tarjeta-numero">Mesa {numero}</span>
                  <span className="mesa-tarjeta-estado">{ocupada ? 'Ocupada' : 'Disponible'}</span>
                </button>
              );
            })}
          </div>

          {panelMesa ? (
            <MesaCarritoPanel
              key={`mesa-panel-${panelMesa.numero}`}
              folioId={panelMesa.folioId}
              folioCacheActualizado={folioCacheActualizado}
              numeroMesa={panelMesa.numero}
              productos={productos}
              productosOrdenados={productosOrdenados}
              frecuenciaCategorias={frecuenciaCategorias}
              frecuenciaLista={frecuenciaLista}
              variantesCtx={variantesCtx}
              negocioId={negocioId}
              usuarioId={usuarioId}
              rol={rol}
              onCerrar={cerrarPanel}
              onFolioCreado={handleFolioCreado}
              onFolioEliminado={handleFolioEliminado}
              onFolioCerrado={handleFolioCerrado}
              motivoCierreFolio={motivoCierreFolio}
              motivoCierreFolioRef={motivoCierreFolioRef}
              onMotivoCierreFolioConsumido={handleMotivoCierreFolioConsumido}
              onRondaEnviada={sincronizarOcupacion}
              onRondasCambiadas={sincronizarOcupacion}
            />
          ) : null}
        </>
      ) : (
        <MesaFoliosCobradosConsulta
          negocioId={negocioId}
          productos={productos}
          variantesCtx={variantesCtx}
        />
      )}
    </section>
  );
}
