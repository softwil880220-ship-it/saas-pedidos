import {
  ETIQUETA_CANAL_MOSTRADOR,
  enriquecerLineasDetalleCocina,
  etiquetaStatusMostrador,
  formatearFechaHoraCocina,
  formatearMoneda,
  resolverEstadoMostradorPendiente,
} from './pedidosShared';
import {
  formatearPrecioLineaRecibo,
  obtenerDesgloseLineasPedido,
} from './pedidoDesglose';

export default function MostradorPendienteRecibo({
  pedido,
  productos,
  variantesCtx,
  estado,
  actualizando,
  onEntregado,
}) {
  const pedidoEnriquecido = productos?.length
    ? enriquecerLineasDetalleCocina(pedido, productos)
    : pedido;
  const statusVisual = resolverEstadoMostradorPendiente(pedidoEnriquecido);
  const desglose = obtenerDesgloseLineasPedido(pedido, productos, variantesCtx);

  return (
    <article className="mostrador-recibo">
      <header className="mostrador-recibo-cabecera">
        <div className="mostrador-recibo-cabecera-principal">
          <span className="mostrador-recibo-canal">{ETIQUETA_CANAL_MOSTRADOR}</span>
          {pedido.folio ? (
            <span className="mostrador-recibo-folio">{pedido.folio}</span>
          ) : null}
        </div>
        <time className="mostrador-recibo-fecha" dateTime={pedido.created_at}>
          {formatearFechaHoraCocina(pedido.created_at)}
        </time>
      </header>

      <div className="mostrador-recibo-estado">
        <span className={`mostrador-recibo-estado-badge status-${statusVisual}`}>
          {estado || etiquetaStatusMostrador(statusVisual)}
        </span>
      </div>

      <div className="mostrador-recibo-lineas" role="list">
        {desglose.lineas.map((linea, index) => (
          <div key={index} className="mostrador-recibo-linea" role="listitem">
            {linea.textoLinea ? (
              <span className="mostrador-recibo-linea-completa">{linea.textoLinea}</span>
            ) : (
              <>
                <span className="mostrador-recibo-cantidad" aria-label={`Cantidad ${linea.cantidad}`}>
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

      <button
        type="button"
        className="vista-operativa-btn entregado-btn mostrador-recibo-entregado"
        disabled={actualizando}
        onClick={() => onEntregado(pedido)}
      >
        {actualizando ? 'Guardando...' : 'Entregado'}
      </button>
    </article>
  );
}
