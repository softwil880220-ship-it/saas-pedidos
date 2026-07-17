import {
  ETIQUETA_CANAL_MOSTRADOR,
  enriquecerLineasDetalleCocina,
  etiquetaStatusMostrador,
  formatearFechaHoraCocina,
  formatearMoneda,
} from './pedidosShared';
import {
  formatearPrecioLineaRecibo,
  obtenerDesgloseLineasPedido,
} from './pedidoDesglose';

export default function MostradorEntregadoRecibo({ pedido, productos, variantesCtx }) {
  const pedidoEnriquecido = productos?.length
    ? enriquecerLineasDetalleCocina(pedido, productos)
    : pedido;
  const desglose = obtenerDesgloseLineasPedido(pedido, productos, variantesCtx);
  const horaEntrega = pedido.mostrador_entregado_at || pedido.created_at;

  return (
    <article className="mostrador-recibo mostrador-recibo-consulta">
      <header className="mostrador-recibo-cabecera">
        <div className="mostrador-recibo-cabecera-principal">
          <span className="mostrador-recibo-canal">{ETIQUETA_CANAL_MOSTRADOR}</span>
          {pedido.folio ? (
            <span className="mostrador-recibo-folio">{pedido.folio}</span>
          ) : null}
        </div>
        <time className="mostrador-recibo-fecha" dateTime={horaEntrega}>
          {formatearFechaHoraCocina(horaEntrega)}
        </time>
      </header>

      <div className="mostrador-recibo-estado">
        <span className="mostrador-recibo-estado-badge status-entregado">
          {etiquetaStatusMostrador('entregado')}
        </span>
      </div>

      {pedido.referencia ? (
        <p className="mostrador-recibo-referencia">{pedido.referencia}</p>
      ) : null}

      <div className="mostrador-recibo-lineas" role="list">
        {desglose.lineas.map((linea, index) => (
          <div key={index} className="mostrador-recibo-linea" role="listitem">
            {linea.textoLinea ? (
              <span className="mostrador-recibo-linea-completa">{linea.textoLinea}</span>
            ) : (
              <>
                <span
                  className="mostrador-recibo-cantidad"
                  aria-label={`Cantidad ${linea.cantidad}`}
                >
                  {linea.cantidad}
                </span>
                <span className="mostrador-recibo-nombre">{linea.nombre}</span>
                <span className="mostrador-recibo-precio">
                  {formatearPrecioLineaRecibo(linea.precioLinea)}
                </span>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="mostrador-recibo-total">
        <span>Total</span>
        <span>{formatearMoneda(desglose.total)}</span>
      </div>
    </article>
  );
}
