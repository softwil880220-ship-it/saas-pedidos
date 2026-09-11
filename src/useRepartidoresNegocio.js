import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { queryConNegocio } from './tenantHelpers';

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

    const { data, error: errorQuery } = await queryConNegocio(
      supabase
        .from('usuarios_negocio')
        .select('id, nombre')
        .eq('activo', true)
        .eq('rol', 'repartidor')
        .order('nombre', { ascending: true }),
      negocioId
    );

    if (errorQuery) {
      setError(errorQuery.message);
      setRepartidores([]);
    } else {
      setRepartidores(Array.isArray(data) ? data : []);
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
