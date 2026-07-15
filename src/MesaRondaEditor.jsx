import { useMemo, useState } from 'react';
import SelectorProductosPedido from './SelectorProductosPedido.jsx';
import PedidoLineasCarrito from './PedidoLineasCarrito.jsx';
import useCarritoPedido from './useCarritoPedido';
import {
  construirPayloadEdicionRondaMesa,
  construirSnapshotCarritoDesdePedido,
  resumenProductosDesdeLineas,
} from './pedidoEdicionHelpers';
import { queryConNegocio } from './tenantHelpers';
import { supabase } from './supabase';

export default function MesaRondaEditor({
  ronda,
  productos,
  productosOrdenados,
  frecuenciaCategorias,
  frecuenciaLista,
  variantesCtx,
  negocioId,
  onGuardar,
  onCancelar,
}) {
  const [guardando, setGuardando] = useState(false);
  const snapshotInicial = useMemo(
    () => construirSnapshotCarritoDesdePedido(ronda, productos, variantesCtx),
    [ronda, productos, variantesCtx]
  );

  const carrito = useCarritoPedido({
    variantesCtx,
    productos,
    modoCaptura: 'mesa',
    persistir: false,
    snapshotInicial,
  });

  const handleGuardar = async () => {
    if (carrito.totalPedido <= 0 || guardando) return;

    setGuardando(true);

    const detallePedido = carrito.obtenerDetallePedido();
    const resumen = resumenProductosDesdeLineas(
      carrito.lineasPedidoActivas,
      productos,
      variantesCtx
    );

    const payload = construirPayloadEdicionRondaMesa({
      pedidoOriginal: ronda,
      detallePedido,
      resumen,
      productos,
    });

    const { data, error } = await queryConNegocio(
      supabase.from('pedidos').update(payload).eq('id', ronda.id).select().single(),
      negocioId
    );

    if (!error && data) {
      onGuardar(data);
    }

    setGuardando(false);
  };

  return (
    <div className="mesa-ronda-editor">
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
        <div className="mesa-ronda-editor-acciones">
          <button
            type="button"
            className="limpiar-pedido-btn"
            disabled={guardando}
            onClick={onCancelar}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="guardar-btn"
            disabled={guardando || carrito.totalPedido <= 0}
            onClick={() => void handleGuardar()}
          >
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </PedidoLineasCarrito>
    </div>
  );
}
