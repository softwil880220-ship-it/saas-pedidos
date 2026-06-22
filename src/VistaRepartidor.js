import { useState } from 'react';
import './App.css';
import { useAuth } from './AuthContext';
import {
  construirUrlWhatsApp,
  DesgloseProductosPedido,
  esPedidoWhatsapp,
  siguienteStatus,
} from './pedidosShared';
import { supabase } from './supabase';
import { queryConNegocio } from './tenantHelpers';
import { usePedidosRealtime } from './usePedidosRealtime';

const filtrarPedidosRepartidor = (pedido) =>
  esPedidoWhatsapp(pedido) && pedido.status === 'enviado';

const compararPedidosRepartidor = (a, b) =>
  new Date(a.created_at || 0) - new Date(b.created_at || 0);

export default function VistaRepartidor() {
  const { negocioId } = useAuth();
  const { pedidos, setPedidos, cargando } = usePedidosRealtime({
    channelName: 'repartidor-pedidos',
    negocioId,
    filtrar: filtrarPedidosRepartidor,
    comparar: compararPedidosRepartidor,
  });
  const [actualizandoId, setActualizandoId] = useState(null);

  const marcarEntregado = async (pedido) => {
    const nuevoStatus = siguienteStatus(pedido.status, pedido.tipo_entrega);
    if (nuevoStatus === pedido.status) return;

    setActualizandoId(pedido.id);
    const { error } = await queryConNegocio(
      supabase.from('pedidos').update({ status: nuevoStatus }).eq('id', pedido.id),
      negocioId
    );

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
          {pedidos.map((pedido) => {
            const urlWhatsApp = construirUrlWhatsApp(pedido.telefono);

            return (
              <article key={pedido.id} className="vista-operativa-tarjeta">
                <h2 className="vista-operativa-cliente">{pedido.cliente}</h2>
                {pedido.telefono?.trim() && (
                  <p className="vista-operativa-telefono">{pedido.telefono.trim()}</p>
                )}
                <p className="vista-operativa-direccion">
                  {pedido.direccion?.trim() || 'Sin dirección registrada'}
                </p>
                <DesgloseProductosPedido pedido={pedido} mostrarTotal={false} />
                <div className="vista-repartidor-acciones">
                  <a
                    className={`vista-operativa-btn whatsapp-btn repartidor-whatsapp-btn${
                      urlWhatsApp ? '' : ' whatsapp-btn-deshabilitado'
                    }`}
                    href={urlWhatsApp || '#whatsapp'}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-disabled={!urlWhatsApp}
                    title={
                      urlWhatsApp
                        ? 'Abrir chat de WhatsApp con el cliente'
                        : 'Este pedido no tiene teléfono registrado'
                    }
                    onClick={(e) => {
                      if (!urlWhatsApp) e.preventDefault();
                    }}
                  >
                    <span className="whatsapp-btn-icono" aria-hidden="true">
                      💬
                    </span>
                    WhatsApp
                  </a>
                  <button
                    type="button"
                    className="vista-operativa-btn entregado-btn"
                    disabled={actualizandoId === pedido.id}
                    onClick={() => marcarEntregado(pedido)}
                  >
                    {actualizandoId === pedido.id ? 'Guardando...' : 'Entregado'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
