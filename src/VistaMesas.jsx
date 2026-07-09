import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  cargarMesaActiva,
  configurarContextoMesas,
  folioSigueAbierto,
  hidratarFoliosMesas,
  limpiarMesaActiva,
  obtenerFolioAbiertoPorMesa,
  obtenerNumeroMesaDeFolio,
  obtenerNumerosMesaOcupados,
  persistirMesaActiva,
} from './pedidoCarritoStorage';
import { useMesasFoliosRealtime } from './useMesasFoliosRealtime';
import MesaCarritoPanel from './MesaCarritoPanel';

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
  const [mesasOcupadas, setMesasOcupadas] = useState(() => obtenerNumerosMesaOcupados());
  const [panelMesa, setPanelMesa] = useState(null);
  const [folioCacheActualizado, setFolioCacheActualizado] = useState({
    revision: 0,
    folioId: null,
    eventType: null,
  });
  const panelMesaRef = useRef(panelMesa);

  useEffect(() => {
    panelMesaRef.current = panelMesa;
  }, [panelMesa]);

  const handleFolioEliminado = useCallback(() => {
    setPanelMesa((prev) => (prev ? { ...prev, folioId: null } : prev));
    limpiarMesaActiva();
    setMesasOcupadas(obtenerNumerosMesaOcupados());
  }, []);

  const handleFolioCreadoRemoto = useCallback((folioId) => {
    setPanelMesa((prev) => (prev ? { ...prev, folioId } : prev));
    persistirMesaActiva(folioId);
  }, []);

  const sincronizarOcupacion = useCallback(() => {
    setMesasOcupadas(obtenerNumerosMesaOcupados());

    const panel = panelMesaRef.current;

    if (panel?.folioId && !folioSigueAbierto(panel.folioId)) {
      handleFolioEliminado();
      return;
    }

    if (panel && !panel.folioId) {
      const folioRemoto = obtenerFolioAbiertoPorMesa(panel.numero);
      if (folioRemoto) {
        handleFolioCreadoRemoto(folioRemoto);
      }
    }
  }, [handleFolioEliminado, handleFolioCreadoRemoto]);

  const manejarCambioCacheMesas = useCallback(
    (detalle) => {
      sincronizarOcupacion();

      if (detalle?.folioId && detalle.eventType === 'UPDATE') {
        setFolioCacheActualizado((prev) => ({
          revision: prev.revision + 1,
          folioId: String(detalle.folioId),
          eventType: 'UPDATE',
        }));
      }
    },
    [sincronizarOcupacion]
  );

  useEffect(() => {
    configurarContextoMesas({ usuarioId, rol });
  }, [usuarioId, rol]);

  useEffect(() => {
    let activo = true;

    const hidratar = async () => {
      setErrorHidratacion(null);

      try {
        await hidratarFoliosMesas(negocioId);
        if (!activo) return;

        setHidrato(true);
        sincronizarOcupacion();

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
      sincronizarOcupacion();
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
    sincronizarOcupacion();
  };

  const handleFolioCreado = useCallback(
    (folioId) => {
      setPanelMesa((prev) => (prev ? { ...prev, folioId } : prev));
      persistirMesaActiva(folioId);
      sincronizarOcupacion();
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
        Selecciona una mesa para abrir o continuar un pedido.
      </p>

      {errorHidratacion ? (
        <p className="formulario-error-guardar" role="alert">
          {errorHidratacion}
        </p>
      ) : null}

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
          onCerrar={cerrarPanel}
          onFolioCreado={handleFolioCreado}
          onFolioEliminado={handleFolioEliminado}
          onRondaEnviada={sincronizarOcupacion}
        />
      ) : null}
    </section>
  );
}
