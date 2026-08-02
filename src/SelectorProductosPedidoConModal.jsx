import { useState } from 'react';
import { buscarProductoPorId } from './pedidoCarritoCalculos';
import ModalSeleccionProductoPedido from './ModalSeleccionProductoPedido.jsx';
import SelectorProductosPedido from './SelectorProductosPedido.jsx';
import { productoTieneVariantesSeleccionables } from './productoVariantesHelpers';

export default function SelectorProductosPedidoConModal({
  productos,
  variantesCtx,
  onAgregarDirecto,
  onConfirmarLinea,
  ...selectorProps
}) {
  const [productoPendiente, setProductoPendiente] = useState(null);

  const handleAgregarProducto = (productoId) => {
    const producto = buscarProductoPorId(productos, productoId);

    if (producto && productoTieneVariantesSeleccionables(producto, variantesCtx)) {
      setProductoPendiente(producto);
      return;
    }

    onAgregarDirecto(productoId);
  };

  return (
    <>
      <SelectorProductosPedido
        {...selectorProps}
        productos={productos}
        onAgregarProducto={handleAgregarProducto}
      />
      {productoPendiente ? (
        <ModalSeleccionProductoPedido
          producto={productoPendiente}
          productos={productos}
          variantesCtx={variantesCtx}
          onCancelar={() => setProductoPendiente(null)}
          onConfirmar={(lineaDraft) => {
            onConfirmarLinea(lineaDraft);
            setProductoPendiente(null);
          }}
        />
      ) : null}
    </>
  );
}
