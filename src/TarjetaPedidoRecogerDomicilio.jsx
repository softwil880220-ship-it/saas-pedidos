import { useState } from 'react';
import {
  formatearPrecioLineaRecibo,
  obtenerDesgloseLineasPedido,
} from './pedidoDesglose';
import SelectorRepartidorPedido from './SelectorRepartidorPedido.jsx';
import {
  REPARTIDOR_EXTERNO_ID,
  esStatusFinalPedidoRecogerDomicilio,
  formatearNombreClientePedidoRecoger,
  formatearTipoEntregaPedido,
  mostrarContactoWhatsAppPedidoRecogerDomicilio,
  pedidoEsperandoRepartidor,
  puedeRetrocederPedidoRecogerDomicilio,
  obtenerMensajeWhatsAppPedidoRecoger,
} from './recogerDomicilioHelpers';
import {
  STATUS_PENDIENTE_REPARTIDOR,
  construirUrlWhatsApp,
  enriquecerLineasDetalleCocina,
  etiquetaStatusPedido,
  formatearFechaHoraCocina,
  formatearMoneda,
  formatearProgresoCocinas,
  pedidoRequiereAlgunaCocina,
} from './pedidosShared';

function etiquetaFormaPago(valor) {
  const mapa = {
    efectivo: 'Efectivo',
    tarjeta: 'Tarjeta',
    transferencia: 'Transferencia',
    link_pago: 'Link de pago',
  };

  return mapa[valor] || null;
}

function etiquetaRepartidorPedido(pedido, repartidores) {
  const repartidorUsuarioId = pedido?.repartidor_usuario_id;
  if (repartidorUsuarioId) {
    const nombre = repartidores?.find((repartidor) => repartidor.id === repartidorUsuarioId)
      ?.nombre;
    return nombre ? `Repartidor: ${nombre}` : null;
  }

  if (pedido?.repartidor_externo === true) {
    return 'Repartidor: Repartidor externo';
  }

  return null;
}

function fechaReferenciaPedidoRecoger(pedido) {
  if (pedido?.status === 'entregado') {
    return pedido.updated_at || pedido.created_at;
  }

  return pedido.created_at;
}

export default function TarjetaPedidoRecogerDomicilio({
  pedido,
  productos,
  variantesCtx,
  repartidores,
  resaltado = false,
  otroEditando = false,
  estaEditando = false,
  bloqueadoPorJornada = false,
  claseBotonJornadaCerrada = '',
  asignandoRepartidor = false,
  onAvanzar,
  onRetroceder,
  onEditar,
  onEliminar,
  onAsignarRepartidor,
}) {
  const [repartidorSeleccionado, setRepartidorSeleccionado] = useState('');

  const pedidoEnriquecido = enriquecerLineasDetalleCocina(pedido, productos);
  const desglose = obtenerDesgloseLineasPedido(pedido, productos, variantesCtx);
  const esFinal = esStatusFinalPedidoRecogerDomicilio(pedido);
  const esperandoRepartidor = pedidoEsperandoRepartidor(pedido);
  const muestraRetroceder = puedeRetrocederPedidoRecogerDomicilio(pedido);
  const muestraContactar = mostrarContactoWhatsAppPedidoRecogerDomicilio(pedido);
  const urlWhatsApp = construirUrlWhatsApp(
    pedido.telefono,
    obtenerMensajeWhatsAppPedidoRecoger(pedido)
  );
  const fechaReferencia = fechaReferenciaPedidoRecoger(pedido);
  const etiquetaRepartidor = etiquetaRepartidorPedido(pedido, repartidores);

  const badgeClass =
    pedido.status === 'por-aceptar'
      ? 'status-por-aceptar'
      : pedido.status === STATUS_PENDIENTE_REPARTIDOR
        ? 'status-pendiente-repartidor'
        : `status-${pedido.status}`;

  const confirmarAsignacion = () => {
    if (!repartidorSeleccionado) return;

    onAsignarRepartidor({
      pedidoId: pedido.id,
      repartidorUsuarioId:
        repartidorSeleccionado === REPARTIDOR_EXTERNO_ID ? null : repartidorSeleccionado,
      repartidorExterno: repartidorSeleccionado === REPARTIDOR_EXTERNO_ID,
    });
  };

  return (
    <article
      id={`pedido-card-${pedido.id}`}
      className={`mostrador-recibo recoger-domicilio-recibo${
        estaEditando ? ' recoger-domicilio-recibo-editando' : ''
      }${resaltado ? ' recoger-domicilio-recibo-resaltada' : ''}`}
    >
      <header className="mostrador-recibo-cabecera">
        <div className="mostrador-recibo-cabecera-principal">
          <span className="mostrador-recibo-canal">
            {formatearNombreClientePedidoRecoger(pedido)}
          </span>
          {pedido.folio != null ? (
            <span className="mostrador-recibo-folio">{pedido.folio}</span>
          ) : null}
        </div>
        <time className="mostrador-recibo-fecha" dateTime={fechaReferencia}>
          {formatearFechaHoraCocina(fechaReferencia)}
        </time>
      </header>

      <div className="mostrador-recibo-estado">
        <span className={`mostrador-recibo-estado-badge ${badgeClass}`}>
          {etiquetaStatusPedido(pedido.status)}
        </span>
      </div>

      <p className="recoger-domicilio-recibo-meta">{formatearTipoEntregaPedido(pedido.tipo_entrega)}</p>

      {etiquetaFormaPago(pedido.forma_pago) ? (
        <p className="recoger-domicilio-recibo-meta">
          Forma de pago: {etiquetaFormaPago(pedido.forma_pago)}
        </p>
      ) : null}

      {etiquetaRepartidor ? (
        <p className="recoger-domicilio-recibo-meta">{etiquetaRepartidor}</p>
      ) : null}

      <div className="mostrador-recibo-lineas" role="list">
        {desglose.lineas.length === 0 ? (
          pedido.producto ? (
            <div className="mostrador-recibo-linea" role="listitem">
              <span className="mostrador-recibo-linea-completa">{pedido.producto}</span>
            </div>
          ) : null
        ) : (
          desglose.lineas.map((linea, index) => (
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
          ))
        )}
      </div>

      <div className="mostrador-recibo-total">
        <span>Total</span>
        <span>{formatearMoneda(desglose.total)}</span>
      </div>

      {pedido.status === 'en-cocina' && pedidoRequiereAlgunaCocina(pedidoEnriquecido) ? (
        <p className="recoger-domicilio-recibo-progreso">
          {formatearProgresoCocinas(pedidoEnriquecido)}
        </p>
      ) : null}

      {esperandoRepartidor ? (
        <div className="pedido-asignacion-repartidor">
          <SelectorRepartidorPedido
            id={`repartidor-${pedido.id}`}
            repartidores={repartidores}
            value={repartidorSeleccionado}
            onChange={setRepartidorSeleccionado}
            disabled={asignandoRepartidor || bloqueadoPorJornada}
          />
          <button
            type="button"
            className={`avanzar-btn${claseBotonJornadaCerrada}`}
            disabled={
              otroEditando || !repartidorSeleccionado || asignandoRepartidor || bloqueadoPorJornada
            }
            onClick={confirmarAsignacion}
          >
            {asignandoRepartidor ? 'Asignando…' : 'Asignar y enviar'}
          </button>
        </div>
      ) : null}

      <div className="tarjeta-acciones tarjeta-acciones-doble recoger-domicilio-recibo-acciones">
        <div
          className={`tarjeta-acciones-fila${
            Number(muestraRetroceder) + Number(!esperandoRepartidor) + Number(muestraContactar) ===
            3
              ? ' tarjeta-acciones-fila-triple'
              : ''
          }`}
        >
          {muestraRetroceder ? (
            <button
              type="button"
              className={`retroceder-btn${claseBotonJornadaCerrada}`}
              disabled={otroEditando || bloqueadoPorJornada}
              onClick={() => onRetroceder(pedido.id)}
            >
              Retroceder
            </button>
          ) : null}

          {!esperandoRepartidor ? (
            <button
              type="button"
              className={`avanzar-btn${
                claseBotonJornadaCerrada || esFinal ? ' btn-accion-jornada-cerrada' : ''
              }`}
              disabled={otroEditando || esFinal || bloqueadoPorJornada}
              onClick={() => onAvanzar(pedido.id)}
            >
              Avanzar
            </button>
          ) : null}

          {muestraContactar ? (
            <a
              className={`whatsapp-btn${urlWhatsApp ? '' : ' whatsapp-btn-deshabilitado'}`}
              href={urlWhatsApp || '#contactar'}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!urlWhatsApp}
              title={
                urlWhatsApp
                  ? 'Contactar por WhatsApp'
                  : 'Agrega un teléfono al pedido para contactar'
              }
              onClick={(evento) => {
                if (!urlWhatsApp) evento.preventDefault();
              }}
            >
              Contactar
            </a>
          ) : null}
        </div>

        <div className="tarjeta-acciones-fila">
          <button
            type="button"
            className={`editar-btn${claseBotonJornadaCerrada}`}
            disabled={otroEditando || bloqueadoPorJornada}
            onClick={() => onEditar(pedido)}
          >
            Editar
          </button>
          <button
            type="button"
            className={`eliminar-btn${claseBotonJornadaCerrada}`}
            disabled={otroEditando || bloqueadoPorJornada}
            onClick={() => onEliminar(pedido)}
          >
            Eliminar
          </button>
        </div>
      </div>
    </article>
  );
}
