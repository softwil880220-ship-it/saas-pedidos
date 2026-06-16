import { useState } from 'react';
import './App.css';
import {
  DesgloseProductosPedido,
  esPedidoWhatsapp,
  siguienteStatus,
} from './pedidosShared';
import { supabase } from './supabase';
import { usePedidosRealtime } from './usePedidosRealtime';

const filtrarPedidosRepartidor = (pedido) =>
  esPedidoWhatsapp(pedido) && pedido.status === 'enviado';

const compararPedidosRepartidor = (a, b) =>
  new Date(a.created_at || 0) - new Date(b.created_at || 0);

export default function VistaRepartidor() {
  const { pedidos, setPedidos, cargando } = usePedidosRealtime({
    channelName: 'repartidor-pedidos',
    filtrar: filtrarPedidosRepartidor,
    comparar: compararPedidosRepartidor,
  });
  const [actualizandoId, setActualizandoId] = useState(null);

  const marcarEntregado = async (pedido) => {
    const nuevoStatus = siguienteStatus(pedido.status, pedido.tipo_entrega);
    if (nuevoStatus === pedido.status) return;

    setActualizandoId(pedido.id);
    const { error } = await supabase
      .from('pedidos')
      .update({ status: nuevoStatus })
      .eq('id', pedido.id);

    if (!error) {
      setPedidos((prev) => prev.filter((item) => item.id !== pedido.id));
    }
    setActualizandoId(null);
  };

  return (
    <div className="vista-operativa vista-repartidor">
      <header className="vista-operativa-header">
        <h1>Repartidor</h1>
        <p className="vista-operativa-subtitulo">
          Pedidos en camino · actualización en tiempo real
        </p>
        <span className="vista-operativa-contador">{pedidos.length} pendientes</span>
      </header>

      {cargando ? (
        <p className="vista-operativa-vacio">Cargando pedidos...</p>
      ) : pedidos.length === 0 ? (
        <p className="vista-operativa-vacio">No hay pedidos enviados</p>
      ) : (
        <div className="vista-operativa-grid">
          {pedidos.map((pedido) => (
            <article key={pedido.id} className="vista-operativa-tarjeta">
              <h2 className="vista-operativa-cliente">{pedido.cliente}</h2>
              <p className="vista-operativa-direccion">
                {pedido.direccion?.trim() || 'Sin dirección registrada'}
              </p>
              <DesgloseProductosPedido pedido={pedido} mostrarTotal={false} />
              <button
                type="button"
                className="vista-operativa-btn entregado-btn"
                disabled={actualizandoId === pedido.id}
                onClick={() => marcarEntregado(pedido)}
              >
                {actualizandoId === pedido.id ? 'Guardando...' : 'Entregado'}
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
