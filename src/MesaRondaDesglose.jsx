import {
  etiquetaEstadoLineaRondaMesa,
  obtenerLineasRondaMesaConEstado,
} from './mesaRondaEstado';

export default function MesaRondaDesglose({ pedido, productos }) {
  const lineasConEstado = obtenerLineasRondaMesaConEstado(pedido, productos);

  if (lineasConEstado.length === 0) {
    return null;
  }

  return (
    <div className="mesa-rondas-enviadas-productos" role="list">
      {lineasConEstado.map(({ linea, estado }, index) => (
        <div
          key={index}
          className="mesa-rondas-enviadas-linea"
          role="listitem"
        >
          <span
            className="mesa-rondas-enviadas-cantidad"
            aria-label={`Cantidad: ${linea.cantidad}`}
          >
            {linea.cantidad}
          </span>
          <span className="mesa-rondas-enviadas-nombre">{linea.descripcion}</span>
          <span
            className={`mesa-rondas-enviadas-estado status-${estado}`}
            aria-label={`Estado: ${etiquetaEstadoLineaRondaMesa(estado)}`}
          >
            {etiquetaEstadoLineaRondaMesa(estado)}
          </span>
        </div>
      ))}
    </div>
  );
}
