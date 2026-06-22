import { useEffect, useState } from 'react';
import { calcularFrecuenciaCategoriasDesdePedidos } from './categoriaFrecuenciaPedidos';
import { supabase } from './supabase';
import { queryConNegocio } from './tenantHelpers';

export function useFrecuenciaCategoriasPedidos(negocioId, productos) {
  const [frecuenciaCategorias, setFrecuenciaCategorias] = useState(() => new Map());

  useEffect(() => {
    if (!negocioId) {
      setFrecuenciaCategorias(new Map());
      return undefined;
    }

    let activo = true;

    const cargarFrecuencia = async () => {
      const { data, error } = await queryConNegocio(
        supabase.from('pedidos').select('lineas_detalle'),
        negocioId
      );

      if (!activo) return;

      if (error || !data) {
        setFrecuenciaCategorias(new Map());
        return;
      }

      setFrecuenciaCategorias(calcularFrecuenciaCategoriasDesdePedidos(data, productos));
    };

    cargarFrecuencia();

    return () => {
      activo = false;
    };
  }, [negocioId, productos]);

  return frecuenciaCategorias;
}
