import { useEffect } from 'react';
import { supabase } from './supabase';
import { sincronizarFilaDesdeRealtime } from './mesasFoliosStorage';

const REALTIME_EVENTOS = ['INSERT', 'UPDATE', 'DELETE'];

export function useMesasFoliosRealtime({ negocioId, onCambio }) {
  useEffect(() => {
    if (!negocioId) return undefined;

    let activo = true;
    let channel = null;

    const conectar = () => {
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }

      channel = supabase.channel(`mesas-folios-${negocioId}`);

      REALTIME_EVENTOS.forEach((event) => {
        channel.on(
          'postgres_changes',
          {
            event,
            schema: 'public',
            table: 'mesas_folios',
            filter: `negocio_id=eq.${negocioId}`,
          },
          (payload) => {
            if (!activo) return;
            sincronizarFilaDesdeRealtime(payload);
            onCambio?.();
          }
        );
      });

      channel.subscribe();
    };

    conectar();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && activo) {
        onCambio?.();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      activo = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [negocioId, onCambio]);
}
