import { useState } from 'react';
import {
  DesgloseProductosPedido,
  extraerNumeroRondaMesa,
  formatearFechaHoraCocina,
} from './pedidosShared';
import { useRondasMesaEnviadas } from './useRondasMesaEnviadas';

function etiquetaResumenRondas(cantidad) {
  if (cantidad === 1) {
    return '1 ronda enviada';
  }

  return `${cantidad} rondas enviadas`;
}

export default function MesaRondasEnviadas({
  negocioId,
  numeroMesa,
  abiertaEn,
  visible,
}) {
  const [expandido, setExpandido] = useState(false);
  const { rondas, cargando, resolverNombreCaptura } = useRondasMesaEnviadas({
    negocioId,
    numeroMesa,
    abiertaEn,
    activo: visible && Boolean(abiertaEn),
  });

  if (!visible) {
    return null;
  }

  if (!cargando && rondas.length === 0) {
    return null;
  }

  const cantidad = rondas.length;

  return (
    <section className="mesa-rondas-enviadas" aria-label="Rondas enviadas a cocina">
      <button
        type="button"
        className="mesa-rondas-enviadas-resumen"
        aria-expanded={expandido}
        onClick={() => setExpandido((prev) => !prev)}
      >
        <span>
          {cargando && cantidad === 0
            ? 'Cargando rondas enviadas...'
            : etiquetaResumenRondas(cantidad)}
        </span>
        <span className="mesa-rondas-enviadas-chevron" aria-hidden="true">
          {expandido ? '▴' : '▾'}
        </span>
      </button>

      {expandido ? (
        <div className="mesa-rondas-enviadas-detalle">
          {rondas.map((ronda, indice) => {
            const numeroRonda =
              extraerNumeroRondaMesa(ronda.referencia) ?? indice + 1;
            const nombreCaptura = resolverNombreCaptura(ronda);

            return (
              <article key={ronda.id} className="mesa-rondas-enviadas-item">
                <header className="mesa-rondas-enviadas-item-cabecera">
                  <h4 className="mesa-rondas-enviadas-item-titulo">
                    Ronda {numeroRonda}
                  </h4>
                  <time
                    className="mesa-rondas-enviadas-item-hora"
                    dateTime={ronda.created_at}
                  >
                    {formatearFechaHoraCocina(ronda.created_at)}
                  </time>
                </header>

                {nombreCaptura ? (
                  <p className="mesa-rondas-enviadas-item-captura">
                    Capturado por: <span>{nombreCaptura}</span>
                  </p>
                ) : null}

                <DesgloseProductosPedido
                  pedido={ronda}
                  mostrarTotal={false}
                />
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
