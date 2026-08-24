import TarjetaPedidoRecogerDomicilio from './TarjetaPedidoRecogerDomicilio.jsx';

export default function ListaPedidosRecogerDomicilio({
  pedidos,
  productos,
  variantesCtx,
  repartidores,
  pedidoResaltadoId,
  editandoPedidoId,
  bloqueadoPorJornada,
  claseBotonJornadaCerrada,
  asignandoRepartidorId,
  mensajeVacio,
  onAvanzar,
  onRetroceder,
  onEditar,
  onEliminar,
  onAsignarRepartidor,
}) {
  if (!pedidos.length) {
    return <p className="recoger-domicilio-lista-vacio">{mensajeVacio}</p>;
  }

  return (
    <div className="mostrador-pendientes-lista recoger-domicilio-lista">
      {pedidos.map((pedido) => (
        <TarjetaPedidoRecogerDomicilio
          key={pedido.id}
          pedido={pedido}
          productos={productos}
          variantesCtx={variantesCtx}
          repartidores={repartidores}
          resaltado={pedidoResaltadoId === pedido.id}
          otroEditando={editandoPedidoId != null && editandoPedidoId !== pedido.id}
          estaEditando={editandoPedidoId === pedido.id}
          bloqueadoPorJornada={bloqueadoPorJornada}
          claseBotonJornadaCerrada={claseBotonJornadaCerrada}
          asignandoRepartidor={asignandoRepartidorId === pedido.id}
          onAvanzar={onAvanzar}
          onRetroceder={onRetroceder}
          onEditar={onEditar}
          onEliminar={onEliminar}
          onAsignarRepartidor={onAsignarRepartidor}
        />
      ))}
    </div>
  );
}
