import ListaPedidosRecogerDomicilio from './ListaPedidosRecogerDomicilio.jsx';

export default function ListaPedidosRecogerDomicilioSecciones({
  secciones,
  mensajeVacio,
  ...listaProps
}) {
  const totalPedidos = secciones.reduce(
    (acumulado, seccion) => acumulado + seccion.pedidos.length,
    0
  );

  if (totalPedidos === 0) {
    return <p className="recoger-domicilio-lista-vacio">{mensajeVacio}</p>;
  }

  return (
    <div className="recoger-domicilio-lista-secciones">
      {secciones.map((seccion) => (
        <section
          key={seccion.id}
          className="recoger-domicilio-lista-seccion-grupo"
          aria-labelledby={`recoger-domicilio-seccion-${seccion.id}`}
        >
          <header
            className={`mostrador-pendientes-cabecera recoger-domicilio-seccion-cabecera recoger-domicilio-seccion-cabecera--${seccion.id}`}
          >
            <h3
              className="mostrador-pendientes-titulo recoger-domicilio-seccion-titulo"
              id={`recoger-domicilio-seccion-${seccion.id}`}
            >
              {seccion.titulo}
            </h3>
            <span className="mostrador-pendientes-contador">
              {seccion.pedidos.length} pedido
              {seccion.pedidos.length === 1 ? '' : 's'}
            </span>
          </header>
          <ListaPedidosRecogerDomicilio
            pedidos={seccion.pedidos}
            mensajeVacio=""
            {...listaProps}
          />
        </section>
      ))}
    </div>
  );
}
