import { useMemo, useState } from 'react';
import {
  MIN_BUSQUEDA_RECOGER_DOMICILIO,
  pedidoCoincideBusquedaRecogerDomicilio,
  pedidoRecogerDomicilioEnJornada,
  tabRecogerDomicilioParaPedido,
} from './recogerDomicilioHelpers';
import { formatearNombreClientePedidoRecoger } from './recogerDomicilioHelpers';

export default function BuscadorPedidosRecogerDomicilio({
  pedidos,
  jornadaAbierta,
  onSeleccionarPedido,
}) {
  const [query, setQuery] = useState('');

  const resultados = useMemo(() => {
    const termino = query.trim();
    if (termino.length < MIN_BUSQUEDA_RECOGER_DOMICILIO) return [];

    return (pedidos || [])
      .filter(
        (pedido) =>
          pedidoRecogerDomicilioEnJornada(pedido, jornadaAbierta) &&
          pedidoCoincideBusquedaRecogerDomicilio(pedido, termino)
      )
      .slice(0, 12);
  }, [pedidos, jornadaAbierta, query]);

  const terminoValido = query.trim().length >= MIN_BUSQUEDA_RECOGER_DOMICILIO;

  return (
    <section className="recoger-domicilio-buscador" aria-label="Buscar pedidos">
      <label className="recoger-domicilio-buscador-label" htmlFor="buscar-pedido-recoger-domicilio">
        Buscar pedido por nombre o teléfono
      </label>
      <input
        id="buscar-pedido-recoger-domicilio"
        type="search"
        value={query}
        placeholder={`Mínimo ${MIN_BUSQUEDA_RECOGER_DOMICILIO} caracteres`}
        onChange={(evento) => setQuery(evento.target.value)}
      />

      {terminoValido && resultados.length === 0 ? (
        <p className="recoger-domicilio-buscador-vacio" role="status">
          No se encontraron pedidos en la jornada activa.
        </p>
      ) : null}

      {resultados.length > 0 ? (
        <ul className="recoger-domicilio-buscador-resultados">
          {resultados.map((pedido) => (
            <li key={pedido.id}>
              <button
                type="button"
                className="recoger-domicilio-buscador-resultado"
                onClick={() =>
                  onSeleccionarPedido({
                    pedidoId: pedido.id,
                    tab: tabRecogerDomicilioParaPedido(pedido),
                  })
                }
              >
                <span>{formatearNombreClientePedidoRecoger(pedido)}</span>
                {pedido.telefono ? <span>{pedido.telefono}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
