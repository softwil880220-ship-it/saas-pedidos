import { useCallback, useEffect, useState } from 'react';
import './App.css';
import {
  DesgloseProductosPedido,
  esPedidoWhatsapp,
  siguienteStatus,
} from './pedidosShared';
import { supabase } from './supabase';

function formatearHora(createdAt) {
  if (!createdAt) return '—';
  return new Date(createdAt).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function VistaCocina() {
  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [actualizandoId, setActualizandoId] = useState(null);

  const cargarPedidos = useCallback(async () => {
    const { data, error } = await supabase
      .from('pedidos')
      .select('*')
      .eq('status', 'en-cocina')
      .order('created_at', { ascending: true });

    if (!error && data) {
      setPedidos(data.filter((pedido) => esPedidoWhatsapp(pedido)));
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    cargarPedidos();
    const intervalo = setInterval(cargarPedidos, 30000);
    return () => clearInterval(intervalo);
  }, [cargarPedidos]);

  const marcarListo = async (pedido) => {
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
    <div className="vista-operativa vista-cocina">
      <header className="vista-operativa-header">
        <h1>Cocina</h1>
        <p className="vista-operativa-subtitulo">
          Pedidos en preparación · se actualiza cada 30 s
        </p>
        <span className="vista-operativa-contador">{pedidos.length} en cola</span>
      </header>

      {cargando ? (
        <p className="vista-operativa-vacio">Cargando pedidos...</p>
      ) : pedidos.length === 0 ? (
        <p className="vista-operativa-vacio">No hay pedidos en cocina</p>
      ) : (
        <div className="vista-operativa-grid">
          {pedidos.map((pedido) => (
            <article key={pedido.id} className="vista-operativa-tarjeta">
              <div className="vista-operativa-tarjeta-cabecera">
                <h2 className="vista-operativa-cliente">{pedido.cliente}</h2>
                <time className="vista-operativa-hora">{formatearHora(pedido.created_at)}</time>
              </div>
              <DesgloseProductosPedido pedido={pedido} mostrarTotal />
              <button
                type="button"
                className="vista-operativa-btn listo-btn"
                disabled={actualizandoId === pedido.id}
                onClick={() => marcarListo(pedido)}
              >
                {actualizandoId === pedido.id ? 'Guardando...' : 'Listo'}
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
