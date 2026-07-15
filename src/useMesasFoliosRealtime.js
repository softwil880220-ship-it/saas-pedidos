import { useEffect } from 'react';
import { supabase } from './supabase';
import {
  obtenerFolioIdDesdePayloadRealtime,
  sincronizarFilaDesdeRealtime,
} from './mesasFoliosStorage';

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
            const eventType = String(payload.eventType ?? payload.type ?? '').toUpperCase();
            const registro =
              payload.new && Object.keys(payload.new).length > 0 ? payload.new : null;
            const anterior =
              payload.old && Object.keys(payload.old).length > 0 ? payload.old : null;
            sincronizarFilaDesdeRealtime(payload);
            onCambio?.({
              folioId: obtenerFolioIdDesdePayloadRealtime(payload),
              eventType,
              estadoNuevo: registro?.estado ?? null,
              estadoAnterior: anterior?.estado ?? null,
            });
          }
        );
      });

      channel.subscribe();
    };

    conectar();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && activo) {
        onCambio?.({ folioId: null, eventType: null });
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
