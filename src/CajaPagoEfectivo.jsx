import { formatearMoneda } from './pedidosShared';

export const FORMA_PAGO_EFECTIVO = 'efectivo';

export function esFormaPagoEfectivo(formaPago) {
  return (formaPago || FORMA_PAGO_EFECTIVO) === FORMA_PAGO_EFECTIVO;
}

export default function CajaPagoEfectivo({
  formaPago,
  pagoRecibido,
  onPagoRecibidoChange,
  pagoValido,
  pagoInsuficiente,
  cambio,
  inputId = 'pago-recibido',
}) {
  if (!esFormaPagoEfectivo(formaPago)) {
    return null;
  }

  return (
    <div className="caja-pago">
      <div className="formulario-campo caja-pago-campo">
        <label htmlFor={inputId}>Pago recibido</label>
        <input
          id={inputId}
          type="number"
          min="0"
          step="0.01"
          value={pagoRecibido}
          onChange={(e) => onPagoRecibidoChange(e.target.value)}
          placeholder="0.00"
        />
      </div>
      {pagoValido &&
        (pagoInsuficiente ? (
          <p className="caja-pago-alerta caja-pago-insuficiente">Pago insuficiente</p>
        ) : (
          <p className="caja-pago-alerta caja-pago-cambio">
            Cambio: {formatearMoneda(cambio)}
          </p>
        ))}
    </div>
  );
}
