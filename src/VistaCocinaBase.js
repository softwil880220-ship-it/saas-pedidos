import { useState } from 'react';
import './App.css';
import {
  DesgloseProductosPedido,
  construirUpdateAlMarcarCocinaLista,
  enriquecerLineasDetalleCocina,
  pedidoVisibleEnCocina,
} from './pedidosShared';
import { supabase } from './supabase';
import { usePedidosRealtime, useProductosRealtime } from './usePedidosRealtime';

function formatearHora(createdAt) {
  if (!createdAt) return '—';
  return new Date(createdAt).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function VistaCocinaBase({ cocina, titulo, channelName, claseVista }) {
  const { productos } = useProductosRealtime({
    channelName: `${channelName}-productos`,
  });

  const filtrarPedidos = (pedido) =>
    pedidoVisibleEnCocina(
      enriquecerLineasDetalleCocina(pedido, productos),
      cocina
    );
  const compararPedidos = (a, b) =>
    new Date(a.created_at || 0) - new Date(b.created_at || 0);

  const { pedidos, setPedidos, cargando } = usePedidosRealtime({
    channelName,
    filtrar: filtrarPedidos,
    comparar: compararPedidos,
  });
  const [actualizandoId, setActualizandoId] = useState(null);

  const marcarListo = async (pedido) => {
    const update = construirUpdateAlMarcarCocinaLista(pedido, cocina);
    if (!update) return;

    setActualizandoId(pedido.id);
    const { error } = await supabase
      .from('pedidos')
      .update(update)
      .eq('id', pedido.id);

    if (!error) {
      setPedidos((prev) => prev.filter((item) => item.id !== pedido.id));
    }
    setActualizandoId(null);
  };

  return (
    <div className={`vista-operativa ${claseVista}`}>
      <header className="vista-operativa-header">
        <h1>{titulo}</h1>
        <p className="vista-operativa-subtitulo">
          Pedidos en preparación · actualización en tiempo real
        </p>
        <span className="vista-operativa-contador">{pedidos.length} en cola</span>
      </header>

      {cargando ? (
        <p className="vista-operativa-vacio">Cargando pedidos...</p>
      ) : pedidos.length === 0 ? (
        <p className="vista-operativa-vacio">No hay pedidos en {titulo.toLowerCase()}</p>
      ) : (
        <div className="vista-operativa-grid">
          {pedidos.map((pedido) => {
            const pedidoEnriquecido = enriquecerLineasDetalleCocina(pedido, productos);

            return (
            <article key={pedido.id} className="vista-operativa-tarjeta">
              <div className="vista-operativa-tarjeta-cabecera">
                <h2 className="vista-operativa-cliente">{pedido.cliente}</h2>
                <time className="vista-operativa-hora">{formatearHora(pedido.created_at)}</time>
              </div>
              <DesgloseProductosPedido
                pedido={pedidoEnriquecido}
                mostrarTotal
                filtrarCocina={cocina}
              />
              <button
                type="button"
                className="vista-operativa-btn listo-btn"
                disabled={actualizandoId === pedido.id}
                onClick={() => marcarListo(pedidoEnriquecido)}
              >
                {actualizandoId === pedido.id ? 'Guardando...' : 'Listo'}
              </button>
            </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
