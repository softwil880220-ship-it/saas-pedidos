import { useEffect } from 'react';
import useCarritoPedido from './useCarritoPedido';
import SelectorProductosPedido from './SelectorProductosPedido.jsx';
import PedidoLineasCarrito from './PedidoLineasCarrito.jsx';

export default function MesaCarritoPanel({
  folioId,
  numeroMesa,
  productos,
  productosOrdenados,
  frecuenciaCategorias,
  frecuenciaLista,
  variantesCtx,
  onCerrar,
  onOcupacionMesaChange,
}) {
  const carrito = useCarritoPedido({
    folioId,
    modoCaptura: 'mesa',
    persistir: true,
    productos,
    variantesCtx,
  });

  useEffect(() => {
    onOcupacionMesaChange?.(folioId, !carrito.estaVacio);
  }, [folioId, carrito.estaVacio, onOcupacionMesaChange]);

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
