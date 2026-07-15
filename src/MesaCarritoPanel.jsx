import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ejecutarEnvioCocina } from './ejecutarEnvioCocina';
import useCarritoPedido from './useCarritoPedido';
import SelectorProductosPedido from './SelectorProductosPedido.jsx';
import PedidoLineasCarrito from './PedidoLineasCarrito.jsx';
import MesaRondasEnviadas from './MesaRondasEnviadas.jsx';
import MesaCobroModal from './MesaCobroModal.jsx';
import {
  abrirFolioMesa,
  cargarCarritosMesasAbiertos,
  cargarEstadoCobroMesa,
  cerrarFolioMesa,
  crearFormularioCapturaMesaVacio,
  eliminarFolioMesa,
  folioCarritoEnmascaradoParaUsuarioActual,
  folioSigueAbierto,
  limpiarEstadoCobroMesa,
  MENSAJE_MESA_YA_COBRADA_POR_OTRO_USUARIO,
  MENSAJE_MESA_PEDIDO_MODIFICADO_SIN_COBRAR,
  MOTIVO_CIERRE_FOLIO_MESA,
  obtenerMetadatosMesa,
  folioFueCerradoPorCobro,
  limpiarMarcaFolioCerradoPorCobro,
  persistirCarritosMesas,
  persistirEstadoCobroMesa,
  serializarSnapshotParaComparacion,
  setUltimoSnapshotRemotoAplicado,
} from './pedidoCarritoStorage';
import { usePedidosFolioMesa } from './usePedidosFolioMesa';

function carritoTieneProductos(snapshot) {
  const lineas = Array.isArray(snapshot?.form?.lineas) ? snapshot.form.lineas : [];
  return lineas.some((linea) => linea?.productoId);
}

function construirSnapshotDesdeCache(folioId) {
  const restaurado = cargarCarritosMesasAbiertos()[folioId];

  if (restaurado?.form) {
    return {
      form: restaurado.form,
      pagoRecibido: restaurado.pagoRecibido ?? '',
      nextLineaId: restaurado.nextLineaId ?? 2,
    };
  }

  return {
    form: crearFormularioCapturaMesaVacio(),
    pagoRecibido: '',
    nextLineaId: 2,
  };
}

function asignarUltimoSnapshotRemoto(ref, snapshot) {
  const serializado = serializarSnapshotParaComparacion(snapshot);
  ref.current = serializado;
  setUltimoSnapshotRemotoAplicado(serializado);
}

function limpiarUltimoSnapshotRemoto(ref) {
  ref.current = null;
  setUltimoSnapshotRemotoAplicado(null);
}

export default function MesaCarritoPanel({
  folioId: folioIdProp,
  folioCacheActualizado,
  numeroMesa,
  productos,
  productosOrdenados,
  frecuenciaCategorias,
  frecuenciaLista,
  variantesCtx,
  negocioId,
  usuarioId,
  rol,
  onCerrar,
  onFolioCreado,
  onFolioEliminado,
  onFolioCerrado,
  onRondaEnviada,
  onRondasCambiadas,
  motivoCierreFolio,
  motivoCierreFolioRef,
  onMotivoCierreFolioConsumido,
}) {
  const [folioIdLocal, setFolioIdLocal] = useState(folioIdProp ?? null);
  const [revisionMetadatosFolio, setRevisionMetadatosFolio] = useState(0);
  const folioId = folioIdProp ?? folioIdLocal;
  const abiertaEnSesionRef = useRef(null);
  const folioIdSesionRef = useRef(folioId);
  const folioAjenoEnmascarado = useMemo(
    () => Boolean(folioId && folioCarritoEnmascaradoParaUsuarioActual(folioId)),
    [folioId, folioCacheActualizado?.revision]
  );
  const metadatosFolio = useMemo(() => {
    if (!folioId) {
      return { abiertaEn: null };
    }

    return obtenerMetadatosMesa(folioId);
  }, [folioId, folioCacheActualizado?.revision, revisionMetadatosFolio]);

  useEffect(() => {
    if (folioId !== folioIdSesionRef.current) {
      folioIdSesionRef.current = folioId;
      if (!folioId) {
        abiertaEnSesionRef.current = null;
      }
    }

    if (metadatosFolio.abiertaEn) {
      abiertaEnSesionRef.current = metadatosFolio.abiertaEn;
    }
  }, [folioId, metadatosFolio.abiertaEn]);

  const abiertaEnFolio = metadatosFolio.abiertaEn ?? abiertaEnSesionRef.current;

  const {
    pedidos: pedidosFolioMesa,
    productosConsolidados: productosConsolidadosFolio,
    subtotal: subtotalFolio,
    cargando: cargandoPedidosFolio,
  } = usePedidosFolioMesa({
    negocioId,
    numeroMesa,
    abiertaEn: abiertaEnFolio,
    activo: Boolean(folioId) && Boolean(abiertaEnFolio) && !folioAjenoEnmascarado,
  });
  const tieneRondasVigentes = pedidosFolioMesa.length > 0;
  const creacionFolioEnCursoRef = useRef(false);
  const folioCreacionIniciadaRef = useRef(false);
  const eliminacionFolioEnCursoRef = useRef(false);
  const folioIdPropAnteriorRef = useRef(folioIdProp);
  const folioIdPropAdjuncionEnCursoRef = useRef(false);
  const folioCacheRevisionAnteriorRef = useRef(0);
  const syncSnapshotExternoEnCursoRef = useRef(false);
  const ultimoSnapshotRemotoAplicadoRef = useRef(null);

  const carrito = useCarritoPedido({
    folioId,
    modoCaptura: 'mesa',
    persistir: Boolean(folioId) && !folioAjenoEnmascarado,
    productos,
    variantesCtx,
  });
  const [enviandoCocina, setEnviandoCocina] = useState(false);
  const [errorEnvioCocina, setErrorEnvioCocina] = useState(null);
  const [errorCreacionFolio, setErrorCreacionFolio] = useState(null);
  const [modalCobroAbierto, setModalCobroAbierto] = useState(false);
  const [estadoCobroPersistido, setEstadoCobroPersistido] = useState(null);
  const [revisionModalCobro, setRevisionModalCobro] = useState(0);
  const [errorCobroMesa, setErrorCobroMesa] = useState(null);
  const modalCobroAbiertoRef = useRef(modalCobroAbierto);

  useEffect(() => {
    modalCobroAbiertoRef.current = modalCobroAbierto;
  }, [modalCobroAbierto]);

  const aplicarMensajeCierreModalSiCorresponde = useCallback(
    (motivo) => {
      if (!modalCobroAbiertoRef.current || !motivo) {
        return;
      }

      if (motivo === MOTIVO_CIERRE_FOLIO_MESA.COBRADA_REMOTO) {
        setErrorCobroMesa(MENSAJE_MESA_YA_COBRADA_POR_OTRO_USUARIO);
      } else if (motivo === MOTIVO_CIERRE_FOLIO_MESA.MODIFICADA_SIN_COBRAR) {
        setErrorCobroMesa(MENSAJE_MESA_PEDIDO_MODIFICADO_SIN_COBRAR);
      }

      onMotivoCierreFolioConsumido?.();
    },
    [onMotivoCierreFolioConsumido]
  );

  useLayoutEffect(() => {
    if (folioIdProp !== null) {
      return;
    }

    const motivo =
      motivoCierreFolioRef?.current ??
      motivoCierreFolio ??
      null;

    aplicarMensajeCierreModalSiCorresponde(motivo);
    setEstadoCobroPersistido(null);
    setModalCobroAbierto(false);

    if (folioIdSesionRef.current) {
      limpiarMarcaFolioCerradoPorCobro(folioIdSesionRef.current);
    }

    abiertaEnSesionRef.current = null;

    if (folioIdLocal) {
      setFolioIdLocal(null);
    }
  }, [
    folioIdProp,
    folioIdLocal,
    motivoCierreFolio,
    motivoCierreFolioRef,
    aplicarMensajeCierreModalSiCorresponde,
  ]);

  useEffect(() => {
    if (!folioId) {
      return;
    }

    const guardado = cargarEstadoCobroMesa(folioId);
    if (guardado) {
      setEstadoCobroPersistido(guardado);
      setModalCobroAbierto(Boolean(guardado.abierto));
      return;
    }

    setEstadoCobroPersistido(null);
    setModalCobroAbierto(false);
  }, [folioId]);

  const handlePersistirEstadoCobro = useCallback(
    (campos) => {
      if (!folioId) {
        return;
      }

      persistirEstadoCobroMesa(folioId, {
        abierto: modalCobroAbierto,
        ...campos,
      });
    },
    [folioId, modalCobroAbierto]
  );

  const handleCancelarCobroMesa = useCallback(() => {
    limpiarEstadoCobroMesa();
    setEstadoCobroPersistido(null);
    setModalCobroAbierto(false);
    setRevisionModalCobro((revision) => revision + 1);
  }, []);

  const handleRondasCambiadas = useCallback(() => {
    setRevisionMetadatosFolio((revision) => revision + 1);
    onRondasCambiadas?.();
  }, [onRondasCambiadas]);

  useEffect(() => {
    setFolioIdLocal(folioIdProp ?? null);
  }, [folioIdProp]);

  const aplicarSnapshotExternoDesdeCache = (folioId, carritoRef) => {
    const snapshot = construirSnapshotDesdeCache(folioId);

    syncSnapshotExternoEnCursoRef.current = true;
    carritoRef.pausarPersistencia();
    carritoRef.aplicarSnapshot(snapshot);
    asignarUltimoSnapshotRemoto(ultimoSnapshotRemotoAplicadoRef, snapshot);
  };

  useLayoutEffect(() => {
    const folioAnterior = folioIdPropAnteriorRef.current;
    folioIdPropAnteriorRef.current = folioIdProp;

    if (folioAnterior && !folioIdProp && !folioSigueAbierto(folioAnterior)) {
      folioIdPropAdjuncionEnCursoRef.current = false;
      if (!creacionFolioEnCursoRef.current) {
        limpiarUltimoSnapshotRemoto(ultimoSnapshotRemotoAplicadoRef);
        syncSnapshotExternoEnCursoRef.current = false;
        folioCreacionIniciadaRef.current = false;
        carrito.pausarPersistencia();
        carrito.aplicarSnapshot({
          form: crearFormularioCapturaMesaVacio(),
          pagoRecibido: '',
          nextLineaId: 2,
        });
        carrito.reanudarPersistencia();
      }
      return;
    }

    const esAdjuncionFolioNuevo =
      folioIdProp &&
      folioIdProp !== folioAnterior &&
      (!folioAnterior || String(folioAnterior) !== String(folioIdProp));

    folioIdPropAdjuncionEnCursoRef.current = esAdjuncionFolioNuevo;

    if (esAdjuncionFolioNuevo) {
      limpiarUltimoSnapshotRemoto(ultimoSnapshotRemotoAplicadoRef);
    }

    if (!folioIdProp || folioIdProp === folioAnterior) {
      return;
    }

    if (creacionFolioEnCursoRef.current || folioCreacionIniciadaRef.current) {
      return;
    }

    aplicarSnapshotExternoDesdeCache(folioIdProp, carrito);
  }, [
    folioIdProp,
    carrito.pausarPersistencia,
    carrito.aplicarSnapshot,
    carrito.reanudarPersistencia,
  ]);

  useLayoutEffect(() => {
    if (!folioIdProp || !folioCacheActualizado) {
      return;
    }

    if (!folioSigueAbierto(folioIdProp)) {
      return;
    }

    if (folioCacheActualizado.eventType !== 'UPDATE') {
      return;
    }

    if (String(folioCacheActualizado.folioId) !== String(folioIdProp)) {
      return;
    }

    if (folioCacheActualizado.revision === folioCacheRevisionAnteriorRef.current) {
      return;
    }

    folioCacheRevisionAnteriorRef.current = folioCacheActualizado.revision;

    if (creacionFolioEnCursoRef.current) {
      return;
    }

    if (folioCreacionIniciadaRef.current && folioIdPropAdjuncionEnCursoRef.current) {
      return;
    }

    aplicarSnapshotExternoDesdeCache(folioIdProp, carrito);
  }, [
    folioIdProp,
    folioCacheActualizado,
    carrito.pausarPersistencia,
    carrito.aplicarSnapshot,
  ]);

  useEffect(() => {
    folioIdPropAdjuncionEnCursoRef.current = false;
  }, [folioIdProp]);

  useEffect(() => {
    if (syncSnapshotExternoEnCursoRef.current) {
      return;
    }

    limpiarUltimoSnapshotRemoto(ultimoSnapshotRemotoAplicadoRef);
  }, [carrito.snapshot, carrito.lineasPedidoActivas.length]);

  useEffect(() => {
    if (creacionFolioEnCursoRef.current || folioCreacionIniciadaRef.current) {
      return;
    }

    if (!folioIdProp && carrito.lineasPedidoActivas.length > 0) {
      return;
    }

    const folioActivo = folioIdProp ?? folioIdLocal;
    if (!folioActivo || folioSigueAbierto(folioActivo)) {
      return;
    }

    creacionFolioEnCursoRef.current = false;
    folioCreacionIniciadaRef.current = false;
    eliminacionFolioEnCursoRef.current = false;

    carrito.pausarPersistencia();
    carrito.aplicarSnapshot({
      form: crearFormularioCapturaMesaVacio(),
      pagoRecibido: '',
      nextLineaId: 2,
    });
    setFolioIdLocal(null);
  }, [
    folioIdProp,
    folioIdLocal,
    folioId,
    carrito.lineasPedidoActivas.length,
    carrito.pausarPersistencia,
    carrito.aplicarSnapshot,
  ]);

  useEffect(() => {
    if (folioId) return;

    if (carrito.lineasPedidoActivas.length === 0) {
      folioCreacionIniciadaRef.current = false;
      creacionFolioEnCursoRef.current = false;
      return undefined;
    }

    if (folioCreacionIniciadaRef.current || creacionFolioEnCursoRef.current) {
      return undefined;
    }

    const snapshotAlCrear = carrito.snapshot;
    if (!carritoTieneProductos(snapshotAlCrear)) {
      return undefined;
    }

    folioCreacionIniciadaRef.current = true;
    creacionFolioEnCursoRef.current = true;
    let cancelado = false;

    const crearFolio = async () => {
      setErrorCreacionFolio(null);

      try {
        const nuevoFolioId = await abrirFolioMesa({
          negocioId,
          numeroMesa,
          creadoPor: usuarioId,
          carritoSnapshot: snapshotAlCrear,
        });

        if (cancelado || !carritoTieneProductos(carrito.snapshot)) {
          return;
        }

        persistirCarritosMesas({
          [nuevoFolioId]: {
            ...carrito.snapshot,
            numeroRondaSiguiente: 1,
          },
        });

        setFolioIdLocal(nuevoFolioId);
        onFolioCreado?.(nuevoFolioId);
      } catch {
        if (!cancelado) {
          folioCreacionIniciadaRef.current = false;
          setErrorCreacionFolio('No se pudo registrar la mesa. Intenta agregar el producto de nuevo.');
        }
      } finally {
        if (!cancelado) {
          creacionFolioEnCursoRef.current = false;
        }
      }
    };

    void crearFolio();

    return () => {
      cancelado = true;
    };
  }, [
    folioId,
    carrito.lineasPedidoActivas.length,
    carrito.snapshot,
    negocioId,
    numeroMesa,
    usuarioId,
    onFolioCreado,
  ]);

  useEffect(() => {
    if (!folioId || carritoTieneProductos(carrito.snapshot)) {
      return undefined;
    }

    if (folioCarritoEnmascaradoParaUsuarioActual(folioId)) {
      return undefined;
    }

    if (syncSnapshotExternoEnCursoRef.current) {
      return undefined;
    }

    if (ultimoSnapshotRemotoAplicadoRef.current != null) {
      const snapshotActual = serializarSnapshotParaComparacion(carrito.snapshot);
      if (ultimoSnapshotRemotoAplicadoRef.current === snapshotActual) {
        return undefined;
      }
    }

    if (metadatosFolio.abiertaEn && cargandoPedidosFolio) {
      return undefined;
    }

    if (modalCobroAbiertoRef.current) {
      return undefined;
    }

    if (folioFueCerradoPorCobro(folioId)) {
      return undefined;
    }

    if (tieneRondasVigentes) {
      return undefined;
    }

    const { rondasEnviadas } = obtenerMetadatosMesa(folioId);
    if (rondasEnviadas > 0) {
      return undefined;
    }

    if (eliminacionFolioEnCursoRef.current || creacionFolioEnCursoRef.current) {
      return undefined;
    }

    eliminacionFolioEnCursoRef.current = true;
    const folioAEliminar = folioId;
    let cancelado = false;

    const eliminarFolio = async () => {
      try {
        carrito.pausarPersistencia();
        await eliminarFolioMesa(folioAEliminar);
        if (cancelado) return;

        setFolioIdLocal(null);
        folioCreacionIniciadaRef.current = false;
        onFolioEliminado?.(MOTIVO_CIERRE_FOLIO_MESA.MODIFICADA_SIN_COBRAR);
      } catch {
        if (!cancelado) {
          carrito.reanudarPersistencia();

          if (!folioSigueAbierto(folioAEliminar)) {
            const motivo = folioFueCerradoPorCobro(folioAEliminar)
              ? MOTIVO_CIERRE_FOLIO_MESA.COBRADA_REMOTO
              : MOTIVO_CIERRE_FOLIO_MESA.MODIFICADA_SIN_COBRAR;
            onFolioEliminado?.(motivo);
          }
        }
      } finally {
        if (!cancelado) {
          eliminacionFolioEnCursoRef.current = false;
        }
      }
    };

    void eliminarFolio();

    return () => {
      cancelado = true;
    };
  }, [
    folioId,
    carrito.snapshot,
    cargandoPedidosFolio,
    metadatosFolio.abiertaEn,
    tieneRondasVigentes,
    carrito.pausarPersistencia,
    carrito.reanudarPersistencia,
    onFolioEliminado,
  ]);

  useEffect(() => {
    if (!syncSnapshotExternoEnCursoRef.current) {
      return;
    }

    syncSnapshotExternoEnCursoRef.current = false;
    carrito.reanudarPersistencia();
  }, [
    folioIdProp,
    folioCacheActualizado?.revision,
    carrito.lineasPedidoActivas.length,
    carrito.reanudarPersistencia,
  ]);

  const handleEnviarCocina = async () => {
    if (!folioId) return;

    const detallePedido = carrito.obtenerDetallePedido();
    if (detallePedido.lineas.length === 0 || detallePedido.total <= 0) {
      return;
    }

    const { numeroRondaSiguiente } = obtenerMetadatosMesa(folioId);
    const resumen = carrito.obtenerResumenProductos();

    setEnviandoCocina(true);
    setErrorEnvioCocina(null);

    const { error } = await ejecutarEnvioCocina({
      negocioId,
      usuarioId,
      detallePedido,
      resumen,
      numeroMesa,
      numeroRonda: numeroRondaSiguiente,
      productos,
    });

    if (error) {
      setErrorEnvioCocina('No se pudo enviar a cocina. Intenta de nuevo.');
      setEnviandoCocina(false);
      return;
    }

    const formularioVacio = crearFormularioCapturaMesaVacio();

    carrito.pausarPersistencia();
    carrito.aplicarSnapshot({
      form: formularioVacio,
      pagoRecibido: '',
      nextLineaId: 2,
    });

    persistirCarritosMesas({
      [folioId]: {
        form: formularioVacio,
        pagoRecibido: '',
        nextLineaId: 2,
        numeroRondaSiguiente: numeroRondaSiguiente + 1,
      },
    });

    carrito.reanudarPersistencia();
    setRevisionMetadatosFolio((revision) => revision + 1);
    onRondaEnviada?.();
    setEnviandoCocina(false);
  };

  const puedeEnviarCocina =
    Boolean(folioId) &&
    carrito.lineasPedidoActivas.length > 0 &&
    carrito.totalPedido > 0 &&
    !enviandoCocina;

  const rondasEnviadas = metadatosFolio.rondasEnviadas ?? 0;
  const carritoActivoVacio = !carritoTieneProductos(carrito.snapshot);
  const puedeCobrarMesa =
    Boolean(folioId) &&
    !folioAjenoEnmascarado &&
    rondasEnviadas > 0 &&
    carritoActivoVacio &&
    !enviandoCocina &&
    !modalCobroAbierto;

  const handleConfirmarCobro = async (datosCobro) => {
    if (!folioId) {
      throw new Error('No hay folio activo para cobrar.');
    }

    await cerrarFolioMesa(folioId, datosCobro);

    limpiarEstadoCobroMesa();
    setEstadoCobroPersistido(null);

    carrito.pausarPersistencia();
    carrito.aplicarSnapshot({
      form: crearFormularioCapturaMesaVacio(),
      pagoRecibido: '',
      nextLineaId: 2,
    });
    carrito.reanudarPersistencia();

    setFolioIdLocal(null);
    setModalCobroAbierto(false);
    setErrorCobroMesa(null);
    onFolioCerrado?.();
  };

  return (
    <section className="mesa-carrito-panel">
      <div className="mesa-carrito-panel-cabecera">
        <h3 className="mesa-carrito-panel-titulo">Mesa {numeroMesa}</h3>
        <button type="button" className="mesa-carrito-cerrar-btn" onClick={onCerrar}>
          Cerrar panel
        </button>
      </div>

      {errorCreacionFolio ? (
        <p className="formulario-error-guardar" role="alert">
          {errorCreacionFolio}
        </p>
      ) : null}

      {folioAjenoEnmascarado ? (
        <p className="formulario-aviso" role="status">
          Mesa ocupada por otro usuario. No puedes ver ni modificar este pedido.
        </p>
      ) : productos.length > 0 ? (
        <>
          <MesaRondasEnviadas
            negocioId={negocioId}
            numeroMesa={numeroMesa}
            abiertaEn={abiertaEnFolio}
            visible={Boolean(folioId) && !folioAjenoEnmascarado}
            productos={productos}
            productosOrdenados={productosOrdenados}
            frecuenciaCategorias={frecuenciaCategorias}
            frecuenciaLista={frecuenciaLista}
            variantesCtx={variantesCtx}
            usuarioId={usuarioId}
            folioId={folioId}
            onRondasCambiadas={handleRondasCambiadas}
          />
          <SelectorProductosPedido
            productos={productosOrdenados}
            frecuenciaCategorias={frecuenciaCategorias}
            frecuenciaLista={frecuenciaLista}
            categoriaActiva={carrito.categoriaPedidoActiva}
            onCategoriaChange={carrito.setCategoriaPedidoActiva}
            onAgregarProducto={carrito.agregarProductoAlPedido}
          />
          <PedidoLineasCarrito
            lineas={carrito.lineasPedidoConProducto}
            productos={productos}
            variantesCtx={variantesCtx}
            totalPedido={carrito.totalPedido}
            onAjustarCantidad={carrito.ajustarCantidadLinea}
            onActualizarCantidad={carrito.actualizarCantidadLinea}
            onEliminarLinea={carrito.eliminarLinea}
            onCambiarVariante={carrito.cambiarVarianteLinea}
          >
            <div className="mesa-carrito-acciones">
              <div className="mesa-carrito-acciones-botones">
                <button
                  type="button"
                  className="guardar-btn mesa-enviar-cocina-btn"
                  disabled={!puedeEnviarCocina}
                  onClick={() => void handleEnviarCocina()}
                >
                  {enviandoCocina ? 'Enviando...' : 'Enviar a cocina'}
                </button>
                <button
                  type="button"
                  className="guardar-btn mesa-cobrar-mesa-btn"
                  disabled={!puedeCobrarMesa}
                  onClick={() => {
                    setErrorCobroMesa(null);
                    setModalCobroAbierto(true);
                  }}
                >
                  Cobrar mesa
                </button>
              </div>
              {errorEnvioCocina ? (
                <p className="formulario-error-guardar" role="alert">
                  {errorEnvioCocina}
                </p>
              ) : null}
              {errorCobroMesa ? (
                <p className="formulario-error-guardar" role="alert">
                  {errorCobroMesa}
                </p>
              ) : null}
            </div>
          </PedidoLineasCarrito>
          <MesaCobroModal
            key={`mesa-cobro-${folioId ?? 'sin-folio'}-${revisionModalCobro}`}
            abierto={modalCobroAbierto}
            folioId={folioId}
            numeroMesa={numeroMesa}
            usuarioId={usuarioId}
            rol={rol}
            productosConsolidados={productosConsolidadosFolio}
            subtotal={subtotalFolio}
            cargandoPedidosFolio={cargandoPedidosFolio}
            estadoPersistido={estadoCobroPersistido}
            onPersistirEstado={handlePersistirEstadoCobro}
            onCancelar={handleCancelarCobroMesa}
            onConfirmar={handleConfirmarCobro}
          />
        </>
      ) : (
        <p className="formulario-aviso">
          Agrega productos en la sección Catálogo de productos para tomar pedidos en mesas.
        </p>
      )}
    </section>
  );
}
