export const MODO_SELECTOR_EMPLEADO_REPORTE = 'reporte';

export default function SelectorEmpleadoReporte({
  empleados,
  value,
  onChange,
  disabled = false,
  id = 'selector-empleado-reporte',
  cargando = false,
}) {
  const deshabilitado = disabled || cargando;

  return (
    <div className="selector-repartidor-pedido">
      <label htmlFor={id}>Empleado</label>
      <select
        id={id}
        value={value}
        onChange={(evento) => onChange(evento.target.value)}
        disabled={deshabilitado}
      >
        <option value="">
          {cargando ? 'Cargando empleados…' : 'Todos los empleados'}
        </option>
        {empleados.map((empleado) => (
          <option key={empleado.id} value={empleado.id}>
            {empleado.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}
