import { useCallback, useEffect, useState } from 'react';
import { ejecutarEnvioCocina } from './ejecutarEnvioCocina';
import useCarritoPedido from './useCarritoPedido';
import SelectorProductosPedido from './SelectorProductosPedido.jsx';
import PedidoLineasCarrito from './PedidoLineasCarrito.jsx';
import {
  cargarCarritosMesasAbiertos,
  crearFormularioCapturaMesaVacio,
  mesaEstaOcupada,
  obtenerMetadatosMesa,
  persistirCarritosMesas,
} from './pedidoCarritoStorage';

export default function MesaCarritoPanel({
  folioId,
  numeroMesa,
  productos,
  productosOrdenados,
  frecuenciaCategorias,
  frecuenciaLista,
  variantesCtx,
  negocioId,
  usuarioId,
  onCerrar,
  onOcupacionMesaChange,
  onRondaEnviada,
}) {
  const carrito = useCarritoPedido({
    folioId,
    modoCaptura: 'mesa',
    persistir: true,
    productos,
    variantesCtx,
  });
  const [enviandoCocina, setEnviandoCocina] = useState(false);
  const [errorEnvioCocina, setErrorEnvioCocina] = useState(null);

  const notificarOcupacion = useCallback(() => {
    const snapshot = cargarCarritosMesasAbiertos()[folioId];
    const ocupada = !carrito.estaVacio || mesaEstaOcupada(snapshot);
    onOcupacionMesaChange?.(folioId, ocupada);
  }, [folioId, carrito.estaVacio, onOcupacionMesaChange]);

  useEffect(() => {
    notificarOcupacion();
  }, [notificarOcupacion]);

  const handleEnviarCocina = async () => {
    const detallePedido = carrito.obtenerDetallePedido();
    if (detallePedido.lineas.length === 0 || detallePedido.total <= 0) {
      return;
    }

    const { numeroRondaSiguiente, rondasEnviadas } = obtenerMetadatosMesa(folioId);
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
        rondasEnviadas: rondasEnviadas + 1,
      },
    });

    carrito.reanudarPersistencia();
    onRondaEnviada?.();
    onOcupacionMesaChange?.(folioId, true);
    setEnviandoCocina(false);
  };

  const puedeEnviarCocina =
    carrito.lineasPedidoActivas.length > 0 && carrito.totalPedido > 0 && !enviandoCocina;

  return (
    <section className="mesa-carrito-panel">
      <div className="mesa-carrito-panel-cabecera">
        <h3 className="mesa-carrito-panel-titulo">Mesa {numeroMesa}</h3>
        <button type="button" className="mesa-carrito-cerrar-btn" onClick={onCerrar}>
          Cerrar panel
        </button>
      </div>

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
