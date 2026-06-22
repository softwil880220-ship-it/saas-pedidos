import { useEffect, useState } from 'react';
import { calcularFrecuenciaCategoriasDesdePedidos } from './categoriaFrecuenciaPedidos';
import { supabase } from './supabase';
import { queryConNegocio } from './tenantHelpers';

export function useFrecuenciaCategoriasPedidos(negocioId, productos) {
  const [frecuenciaCategorias, setFrecuenciaCategorias] = useState(() => new Map());
  const [frecuenciaLista, setFrecuenciaLista] = useState(false);

  useEffect(() => {
    if (!negocioId || productos.length === 0) {
      setFrecuenciaCategorias(new Map());
      setFrecuenciaLista(false);
      return undefined;
    }

    let activo = true;
    setFrecuenciaLista(false);

    const cargarFrecuencia = async () => {
      const { data, error } = await queryConNegocio(
        supabase.from('pedidos').select('lineas_detalle'),
        negocioId
      );

      if (!activo) return;

      if (error || !data) {
        setFrecuenciaCategorias(new Map());
      } else {
        setFrecuenciaCategorias(calcularFrecuenciaCategoriasDesdePedidos(data, productos));
      }

      setFrecuenciaLista(true);
    };

    cargarFrecuencia();

    return () => {
      activo = false;
    };
  }, [negocioId, productos]);

  return { frecuenciaCategorias, frecuenciaLista };
}
