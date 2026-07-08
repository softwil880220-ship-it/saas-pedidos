import { useCallback, useEffect, useState } from 'react';
import './App.css';
import { useAuth } from './AuthContext';
import {
  DesgloseProductosPedido,
  construirUpdateAlMarcarCocinaLista,
  enriquecerLineasDetalleCocina,
  esPedidoWhatsapp,
  etiquetaCanalEntregaCocina,
  formatearFechaHoraCocina,
  pedidoVisibleEnCocina,
  resolverNombreCapturaPedido,
} from './pedidosShared';
import { supabase } from './supabase';
import { queryConNegocio } from './tenantHelpers';
import { usePedidosRealtime, useProductosRealtime } from './usePedidosRealtime';

export default function VistaCocinaBase({ cocina, titulo, channelName, claseVista }) {
  const { negocioId } = useAuth();
  const { productos } = useProductosRealtime({
    channelName: `${channelName}-productos`,
    negocioId,
  });
  const [nombresCapturaPorId, setNombresCapturaPorId] = useState({});

  const filtrarPedidos = useCallback(
    (pedido) =>
      pedidoVisibleEnCocina(
        enriquecerLineasDetalleCocina(pedido, productos),
        cocina,
        productos
      ),
    [cocina, productos]
  );
  const compararPedidos = useCallback(
    (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0),
    []
  );

  const { pedidos, setPedidos, cargando } = usePedidosRealtime({
    channelName,
    negocioId,
    filtrar: filtrarPedidos,
    comparar: compararPedidos,
  });
  const [actualizandoId, setActualizandoId] = useState(null);

  useEffect(() => {
    if (!negocioId) {
      setNombresCapturaPorId({});
      return;
    }

    let activo = true;

    const cargarNombresCaptura = async () => {
      const { data, error } = await queryConNegocio(
        supabase.from('usuarios_negocio').select('id, nombre').eq('activo', true),
        negocioId
      );

      if (!activo || error || !data) {
        return;
      }

      setNombresCapturaPorId(
        Object.fromEntries(data.map((usuario) => [String(usuario.id), usuario.nombre]))
      );
    };

    void cargarNombresCaptura();

    return () => {
      activo = false;
    };
  }, [negocioId]);

  const marcarListo = async (pedido) => {
    const update = construirUpdateAlMarcarCocinaLista(pedido, cocina);
    if (!update) return;

    setActualizandoId(pedido.id);
    const { error } = await queryConNegocio(
      supabase.from('pedidos').update(update).eq('id', pedido.id),
      negocioId
    );

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
            const nombreCaptura = resolverNombreCapturaPedido(pedido, nombresCapturaPorId);
            const esWhatsapp = esPedidoWhatsapp(pedido);

            return (
              <article key={pedido.id} className="vista-operativa-tarjeta">
                <div className="vista-operativa-tarjeta-cabecera">
                  <div className="vista-operativa-tarjeta-titulo">
                    <h2 className="vista-operativa-cliente">{pedido.cliente}</h2>
                    {esWhatsapp ? (
                      <span className="vista-operativa-canal">
                        {etiquetaCanalEntregaCocina(pedido.tipo_entrega)}
                      </span>
                    ) : null}
                  </div>
                  <div className="vista-operativa-tarjeta-meta">
                    {pedido.folio != null ? (
                      <span className="vista-operativa-folio">{pedido.folio}</span>
                    ) : null}
                    {pedido.tipo === 'mesa' && pedido.referencia ? (
                      <span className="vista-operativa-ronda">{pedido.referencia}</span>
                    ) : null}
                    <time className="vista-operativa-fecha-hora" dateTime={pedido.created_at}>
                      {formatearFechaHoraCocina(pedido.created_at)}
                    </time>
                  </div>
                </div>

                {nombreCaptura ? (
                  <p className="vista-operativa-captura">
                    Capturado por: <span>{nombreCaptura}</span>
                  </p>
                ) : null}

                <DesgloseProductosPedido
                  pedido={pedidoEnriquecido}
                  mostrarTotal={false}
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
