import { useCallback, useEffect, useState } from 'react';
import './App.css';
import {
  DesgloseProductosPedido,
  esPedidoWhatsapp,
  siguienteStatus,
} from './pedidosShared';
import { supabase } from './supabase';

export default function VistaRepartidor() {
  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [actualizandoId, setActualizandoId] = useState(null);

  const cargarPedidos = useCallback(async () => {
    const { data, error } = await supabase
      .from('pedidos')
      .select('*')
      .eq('status', 'enviado')
      .order('created_at', { ascending: true });

    if (!error && data) {
      setPedidos(data.filter((pedido) => esPedidoWhatsapp(pedido)));
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    cargarPedidos();
  }, [cargarPedidos]);

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
        <p className="vista-operativa-subtitulo">Pedidos en camino</p>
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
