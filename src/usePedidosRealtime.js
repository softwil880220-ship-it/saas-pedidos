import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

function ordenarPedidosDesc(pedidos) {
  return [...pedidos].sort(
    (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
  );
}

export function sincronizarPedidosConEvento(prev, payload, filtrar, comparar) {
  const { eventType, new: nuevo, old: anterior } = payload;

  const ordenar = (lista) => {
    if (comparar) return [...lista].sort(comparar);
    return ordenarPedidosDesc(lista);
  };

  const cumple = (pedido) => (pedido ? !filtrar || filtrar(pedido) : false);

  if (eventType === 'DELETE') {
    const id = anterior?.id;
    if (!id) return prev;
    return prev.filter((pedido) => pedido.id !== id);
  }

  if (!nuevo) return prev;

  const id = nuevo.id;
  const index = prev.findIndex((pedido) => pedido.id === id);
  const enLista = index !== -1;

  if (eventType === 'INSERT' || eventType === 'UPDATE') {
    if (cumple(nuevo)) {
      if (enLista) {
        const next = [...prev];
        next[index] = nuevo;
        return ordenar(next);
      }
      return ordenar([...prev, nuevo]);
    }

    if (enLista) {
      return prev.filter((pedido) => pedido.id !== id);
    }
  }

  return prev;
}

export function usePedidosRealtime(options = {}) {
  const { channelName = 'pedidos', filtrar = null, comparar = null } = options;
  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(true);

  const aplicarFiltroYOrden = useCallback(
    (lista) => {
      const filtrada = filtrar ? lista.filter(filtrar) : lista;
      if (comparar) return [...filtrada].sort(comparar);
      return ordenarPedidosDesc(filtrada);
    },
    [filtrar, comparar]
  );

  useEffect(() => {
    let activo = true;

    const cargarPedidos = async () => {
      const { data, error } = await supabase
        .from('pedidos')
        .select('*')
        .order('created_at', { ascending: false });

      if (activo && !error && data) {
        setPedidos(aplicarFiltroYOrden(data));
      }
      if (activo) setCargando(false);
    };

    cargarPedidos();

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pedidos' },
        (payload) => {
          setPedidos((prev) =>
            sincronizarPedidosConEvento(prev, payload, filtrar, comparar)
          );
        }
      )
      .subscribe();

    return () => {
      activo = false;
      supabase.removeChannel(channel);
    };
  }, [channelName, filtrar, comparar, aplicarFiltroYOrden]);

  return { pedidos, setPedidos, cargando };
}
