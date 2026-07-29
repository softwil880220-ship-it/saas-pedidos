import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { queryConNegocio } from './tenantHelpers';
import {
  agruparItemsPorCategoria,
  construirProductoItemsMap,
} from './variantesDinamicas';

export default function useVariantesCtx(negocioId, productos = []) {
  const [categoriasVariantes, setCategoriasVariantes] = useState([]);
  const [catalogosVariantes, setCatalogosVariantes] = useState({});
  const [productoItemsVariantes, setProductoItemsVariantes] = useState({});

  const variantesCtx = useMemo(
    () => ({
      categorias: categoriasVariantes,
      catalogos: catalogosVariantes,
      productoItems: productoItemsVariantes,
    }),
    [categoriasVariantes, catalogosVariantes, productoItemsVariantes]
  );

  const cargarProductoItemsVariantes = useCallback(
    async (catalogos, productoIds) => {
      if (!negocioId || !productoIds?.length) {
        setProductoItemsVariantes({});
        return;
      }

      const { data, error } = await supabase
        .from('producto_categorias_variantes')
        .select('producto_id, item_variante_id, items_variantes(categoria_id)')
        .in('producto_id', productoIds);

      if (error) {
        setProductoItemsVariantes({});
        return;
      }

      const links = (data || []).map((row) => ({
        producto_id: row.producto_id,
        item_variante_id: row.item_variante_id,
        categoria_id: row.items_variantes?.categoria_id,
      }));

      setProductoItemsVariantes(construirProductoItemsMap(links, catalogos));
    },
    [negocioId]
  );

  const cargarCatalogosVariantes = useCallback(async () => {
    if (!negocioId) {
      setCategoriasVariantes([]);
      setCatalogosVariantes({});
      setProductoItemsVariantes({});
      return;
    }

    const { data: categorias, error: errorCategorias } = await queryConNegocio(
      supabase.from('categorias_variantes').select('*'),
      negocioId
    )
      .order('orden', { ascending: true })
      .order('nombre', { ascending: true });

    const categoriasLista = !errorCategorias && categorias ? categorias : [];

    const { data: items, error: errorItems } = await supabase
      .from('items_variantes')
      .select('*, categorias_variantes!inner(id, negocio_id, nombre, orden, activo)')
      .eq('categorias_variantes.negocio_id', negocioId)
      .order('nombre', { ascending: true });

    const itemsLista = !errorItems && items ? items : [];
    const catalogos = agruparItemsPorCategoria(itemsLista);

    setCategoriasVariantes(categoriasLista);
    setCatalogosVariantes(catalogos);
    await cargarProductoItemsVariantes(
      catalogos,
      productos.map((producto) => producto.id)
    );
  }, [negocioId, productos, cargarProductoItemsVariantes]);

  const recargarCatalogos = useCallback(async () => {
    await cargarCatalogosVariantes();
  }, [cargarCatalogosVariantes]);

  useEffect(() => {
    void recargarCatalogos();
  }, [negocioId, recargarCatalogos]);

  useEffect(() => {
    if (!negocioId || productos.length === 0) {
      if (!negocioId) {
        setProductoItemsVariantes({});
      }
      return;
    }

    void cargarProductoItemsVariantes(
      catalogosVariantes,
      productos.map((producto) => producto.id)
    );
  }, [negocioId, productos, catalogosVariantes, cargarProductoItemsVariantes]);

  return {
    variantesCtx,
    categoriasVariantes,
    catalogosVariantes,
    productoItemsVariantes,
    setCategoriasVariantes,
    setCatalogosVariantes,
    setProductoItemsVariantes,
    recargarCatalogos,
  };
}
