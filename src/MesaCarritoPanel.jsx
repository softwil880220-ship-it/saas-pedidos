import { useEffect, useRef, useState } from 'react';
import { ejecutarEnvioCocina } from './ejecutarEnvioCocina';
import useCarritoPedido from './useCarritoPedido';
import SelectorProductosPedido from './SelectorProductosPedido.jsx';
import PedidoLineasCarrito from './PedidoLineasCarrito.jsx';
import {
  abrirFolioMesa,
  crearFormularioCapturaMesaVacio,
  eliminarFolioMesa,
  folioSigueAbierto,
  obtenerMetadatosMesa,
  persistirCarritosMesas,
} from './pedidoCarritoStorage';

function carritoTieneProductos(snapshot) {
  const lineas = Array.isArray(snapshot?.form?.lineas) ? snapshot.form.lineas : [];
  return lineas.some((linea) => linea?.productoId);
}

export default function MesaCarritoPanel({
  folioId: folioIdProp,
  numeroMesa,
  productos,
  productosOrdenados,
  frecuenciaCategorias,
  frecuenciaLista,
  variantesCtx,
  negocioId,
  usuarioId,
  onCerrar,
  onFolioCreado,
  onFolioEliminado,
  onRondaEnviada,
}) {
  const [folioIdLocal, setFolioIdLocal] = useState(folioIdProp ?? null);
  const folioId = folioIdProp ?? folioIdLocal;
  const creacionFolioEnCursoRef = useRef(false);
  const folioCreacionIniciadaRef = useRef(false);
  const eliminacionFolioEnCursoRef = useRef(false);

  const carrito = useCarritoPedido({
    folioId,
    modoCaptura: 'mesa',
    persistir: Boolean(folioId),
    productos,
    variantesCtx,
  });
  const [enviandoCocina, setEnviandoCocina] = useState(false);
  const [errorEnvioCocina, setErrorEnvioCocina] = useState(null);
  const [errorCreacionFolio, setErrorCreacionFolio] = useState(null);

  useEffect(() => {
    setFolioIdLocal(folioIdProp ?? null);
  }, [folioIdProp]);

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
    if (!folioId || carrito.lineasPedidoActivas.length > 0) {
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
        onFolioEliminado?.();
      } catch {
        if (!cancelado) {
          carrito.reanudarPersistencia();
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
    carrito.lineasPedidoActivas.length,
    carrito.pausarPersistencia,
    carrito.reanudarPersistencia,
    onFolioEliminado,
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
    onRondaEnviada?.();
    setEnviandoCocina(false);
  };

  const puedeEnviarCocina =
    Boolean(folioId) &&
    carrito.lineasPedidoActivas.length > 0 &&
    carrito.totalPedido > 0 &&
    !enviandoCocina;

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

      {productos.length > 0 ? (
        <>
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
            onEliminarLinea={carrito.eliminarLinea}
            onCambiarVariante={carrito.cambiarVarianteLinea}
          >
            <div className="mesa-carrito-acciones">
              <button
                type="button"
                className="guardar-btn mesa-enviar-cocina-btn"
                disabled={!puedeEnviarCocina}
                onClick={() => void handleEnviarCocina()}
              >
                {enviandoCocina ? 'Enviando...' : 'Enviar a cocina'}
              </button>
              {errorEnvioCocina ? (
                <p className="formulario-error-guardar" role="alert">
                  {errorEnvioCocina}
                </p>
              ) : null}
            </div>
          </PedidoLineasCarrito>
        </>
      ) : (
        <p className="formulario-aviso">
          Agrega productos en la sección Catálogo de productos para tomar pedidos en mesas.
        </p>
      )}
    </section>
  );
}
