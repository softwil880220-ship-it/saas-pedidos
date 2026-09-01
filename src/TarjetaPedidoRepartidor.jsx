import { formatearDireccionPedido } from './clientesHelpers';
import {
  esPedidoProgramado,
  formatearProgramadoParaRepartidor,
} from './pedidosProgramadosHelpers';
import {
  construirUrlWhatsApp,
  formatearFechaHoraCocina,
  formatearMoneda,
  normalizarTelefonoWhatsApp,
} from './pedidosShared';
import {
  formatearPrecioLineaRecibo,
  contarArticulosLineasDetalle,
  obtenerDesgloseLineasPedido,
} from './pedidoDesglose';
import { etiquetaFormaPagoRepartidor } from './repartidorHelpers';

function formatearHora(createdAt) {
  if (!createdAt) return '';
  return new Date(createdAt).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function construirUrlLlamada(telefono) {
  const numero = normalizarTelefonoWhatsApp(telefono);
  if (!numero) return null;
  return `tel:+${numero}`;
}

function etiquetaCantidadArticulos(cantidad) {
  return `${cantidad} artículo${cantidad === 1 ? '' : 's'}`;
}

function TarjetaPedidoRepartidorPorEntregar({
  pedido,
  productos,
  variantesCtx,
  actualizandoId,
  onMarcarEntregado,
}) {
  const urlWhatsApp = construirUrlWhatsApp(pedido.telefono);
  const urlLlamada = construirUrlLlamada(pedido.telefono);
  const desglose = obtenerDesgloseLineasPedido(pedido, productos, variantesCtx);
  const etiquetaFormaPago = etiquetaFormaPagoRepartidor(pedido.forma_pago);
  const cantidadArticulos = contarArticulosLineasDetalle(pedido.lineas_detalle, productos);

  return (
    <article className="vista-operativa-tarjeta">
      <div className="vista-operativa-tarjeta-cabecera">
        <h2 className="vista-operativa-cliente">{pedido.cliente}</h2>
        <div className="vista-repartidor-tarjeta-meta">
          {pedido.folio != null ? (
            <span className="vista-repartidor-tarjeta-folio">{pedido.folio}</span>
          ) : null}
          {pedido.created_at ? (
            <time className="vista-operativa-hora" dateTime={pedido.created_at}>
              {formatearHora(pedido.created_at)}
            </time>
          ) : null}
        </div>
      </div>
      {esPedidoProgramado(pedido) ? (
        <p className="vista-repartidor-entrega-prometida">
          {formatearProgramadoParaRepartidor(pedido.programado_para)}
        </p>
      ) : null}
      <p className="vista-operativa-direccion">{formatearDireccionPedido(pedido)}</p>

      {etiquetaFormaPago ? (
        <p className="vista-repartidor-forma-pago">Forma de pago: {etiquetaFormaPago}</p>
      ) : null}

      <p className="vista-repartidor-articulos">{etiquetaCantidadArticulos(cantidadArticulos)}</p>

      <div className="mostrador-recibo-lineas vista-repartidor-lineas-entregadas" role="list">
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

      <div className="vista-repartidor-total-pedido">
        <span>Total</span>
        <span>{formatearMoneda(desglose.total)}</span>
      </div>

      <div className="vista-repartidor-acciones">
        <div className="vista-repartidor-contacto-acciones">
          <a
            className={`vista-operativa-btn repartidor-llamar-btn${
              urlLlamada ? '' : ' repartidor-llamar-btn-deshabilitado'
            }`}
            href={urlLlamada || '#llamar'}
            aria-disabled={!urlLlamada}
            title={
              urlLlamada
                ? 'Llamar al cliente'
                : 'Este pedido no tiene teléfono registrado'
            }
            onClick={(evento) => {
              if (!urlLlamada) evento.preventDefault();
            }}
          >
            <span className="repartidor-llamar-btn-icono" aria-hidden="true">
              📞
            </span>
            Llamar
          </a>
          <a
            className={`vista-operativa-btn whatsapp-btn repartidor-whatsapp-btn${
              urlWhatsApp ? '' : ' whatsapp-btn-deshabilitado'
            }`}
            href={urlWhatsApp || '#whatsapp'}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!urlWhatsApp}
            title={
              urlWhatsApp
                ? 'Abrir chat de WhatsApp con el cliente'
                : 'Este pedido no tiene teléfono registrado'
            }
            onClick={(evento) => {
              if (!urlWhatsApp) evento.preventDefault();
            }}
          >
            <span className="whatsapp-btn-icono" aria-hidden="true">
              💬
            </span>
            WhatsApp
          </a>
        </div>
        <button
          type="button"
          className="vista-operativa-btn entregado-btn"
          disabled={actualizandoId === pedido.id}
          onClick={() => onMarcarEntregado(pedido)}
        >
          {actualizandoId === pedido.id ? 'Guardando...' : 'Entregado'}
        </button>
      </div>
    </article>
  );
}

function TarjetaPedidoRepartidorEntregado({ pedido, productos, variantesCtx }) {
  const desglose = obtenerDesgloseLineasPedido(pedido, productos, variantesCtx);
  const horaEntrega = pedido.entregado_en || pedido.updated_at || pedido.created_at;
  const etiquetaFormaPago = etiquetaFormaPagoRepartidor(pedido.forma_pago);
  const cantidadArticulos = contarArticulosLineasDetalle(pedido.lineas_detalle, productos);

  return (
    <article className="vista-operativa-tarjeta vista-repartidor-tarjeta-entregada">
      <div className="vista-operativa-tarjeta-cabecera">
        <h2 className="vista-operativa-cliente">{pedido.cliente}</h2>
        <div className="vista-repartidor-tarjeta-meta">
          {pedido.folio != null ? (
            <span className="vista-repartidor-tarjeta-folio">{pedido.folio}</span>
          ) : null}
          {horaEntrega ? (
            <time className="vista-operativa-hora" dateTime={horaEntrega}>
              {formatearFechaHoraCocina(horaEntrega)}
            </time>
          ) : null}
        </div>
      </div>

      {etiquetaFormaPago ? (
        <p className="vista-repartidor-forma-pago">Forma de pago: {etiquetaFormaPago}</p>
      ) : null}

      <p className="vista-repartidor-articulos">
        {etiquetaCantidadArticulos(cantidadArticulos)}
      </p>

      <div className="mostrador-recibo-lineas vista-repartidor-lineas-entregadas" role="list">
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

      <div className="vista-repartidor-total-pedido">
        <span>Total</span>
        <span>{formatearMoneda(desglose.total)}</span>
      </div>
    </article>
  );
}

export default function TarjetaPedidoRepartidor(props) {
  if (props.modo === 'entregado') {
    return <TarjetaPedidoRepartidorEntregado {...props} />;
  }

  return <TarjetaPedidoRepartidorPorEntregar {...props} />;
}
