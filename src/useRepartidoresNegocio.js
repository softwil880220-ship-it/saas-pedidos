import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

export default function useRepartidoresNegocio(negocioId) {
  const [repartidores, setRepartidores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const recargar = useCallback(async () => {
    if (!negocioId) {
      setRepartidores([]);
      setCargando(false);
      return;
    }

    setCargando(true);
    setError(null);

    const { data, error: errorInvoke } = await supabase.functions.invoke('panel-cajeros', {
      body: {
        action: 'list',
        negocio_id: negocioId,
      },
    });

    if (errorInvoke) {
      setError(errorInvoke.message);
      setRepartidores([]);
    } else if (data?.success === false) {
      setError(data.error);
      setRepartidores([]);
    } else {
      const lista = Array.isArray(data?.data) ? data.data : [];
      setRepartidores(
        lista.filter((usuario) => usuario.rol === 'repartidor' && usuario.activo !== false)
      );
    }

    setCargando(false);
  }, [negocioId]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  return {
    repartidores,
    cargando,
    error,
    recargar,
  };
}
