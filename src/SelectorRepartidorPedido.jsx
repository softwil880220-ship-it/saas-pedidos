import { REPARTIDOR_EXTERNO_ID } from './recogerDomicilioHelpers';

export default function SelectorRepartidorPedido({
  repartidores,
  value,
  onChange,
  disabled = false,
  id = 'selector-repartidor-pedido',
}) {
  return (
    <div className="selector-repartidor-pedido">
      <label htmlFor={id}>Repartidor</label>
      <select
        id={id}
        value={value}
        onChange={(evento) => onChange(evento.target.value)}
        disabled={disabled}
      >
        <option value="">Seleccionar repartidor…</option>
        {repartidores.map((repartidor) => (
          <option key={repartidor.id} value={repartidor.id}>
            {repartidor.nombre}
          </option>
        ))}
        <option value={REPARTIDOR_EXTERNO_ID}>Repartidor externo</option>
      </select>
    </div>
  );
}
