import { REPARTIDOR_EXTERNO_ID } from './recogerDomicilioHelpers';
import { CLAVE_REPARTIDOR_SIN_ASIGNAR } from './reportesHelpers';

export const MODO_SELECTOR_REPARTIDOR_ASIGNACION = 'asignacion';
export const MODO_SELECTOR_REPARTIDOR_REPORTE = 'reporte';

export default function SelectorRepartidorPedido({
  repartidores,
  value,
  onChange,
  disabled = false,
  id = 'selector-repartidor-pedido',
  modo = MODO_SELECTOR_REPARTIDOR_ASIGNACION,
}) {
  const esModoReporte = modo === MODO_SELECTOR_REPARTIDOR_REPORTE;

  return (
    <div className="selector-repartidor-pedido">
      <label htmlFor={id}>Repartidor</label>
      <select
        id={id}
        value={value}
        onChange={(evento) => onChange(evento.target.value)}
        disabled={disabled}
      >
        <option value="">
          {esModoReporte ? 'Todos los repartidores' : 'Seleccionar repartidor…'}
        </option>
        {repartidores.map((repartidor) => (
          <option key={repartidor.id} value={repartidor.id}>
            {repartidor.nombre}
          </option>
        ))}
        {esModoReporte ? (
          <>
            <option value={REPARTIDOR_EXTERNO_ID}>Repartidor externo</option>
            <option value={CLAVE_REPARTIDOR_SIN_ASIGNAR}>Sin asignar</option>
          </>
        ) : (
          <option value={REPARTIDOR_EXTERNO_ID}>Repartidor externo</option>
        )}
      </select>
    </div>
  );
}
