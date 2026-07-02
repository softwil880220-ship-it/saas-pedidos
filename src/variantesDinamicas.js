export const TAB_CATEGORIAS_VARIANTES = 'categorias-variantes';

export function categoriasVariantesActivas(categorias) {
  return [...(categorias || [])]
    .filter((categoria) => categoria.activo !== false)
    .sort(
      (a, b) =>
        (a.orden ?? 0) - (b.orden ?? 0) ||
        String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es')
    );
}

export function crearCatalogosVariantesVacios(categorias) {
  return categoriasVariantesActivas(categorias).reduce((acc, categoria) => {
    acc[String(categoria.id)] = [];
    return acc;
  }, {});
}

export function crearVariantesActivasFormVacias(categorias) {
  return categoriasVariantesActivas(categorias).reduce((acc, categoria) => {
    acc[String(categoria.id)] = { categoria: false, items: [] };
    return acc;
  }, {});
}

export function crearVariantesLineaVacias(categorias) {
  return categoriasVariantesActivas(categorias).reduce((acc, categoria) => {
    acc[String(categoria.id)] = [];
    return acc;
  }, {});
}

export function clonarVariantesLinea(variantes, categorias) {
  const clon = crearVariantesLineaVacias(categorias);

  if (!variantes || typeof variantes !== 'object') {
    return clon;
  }

  Object.entries(variantes).forEach(([key, ids]) => {
    clon[key] = Array.isArray(ids) ? ids.map(String) : [];
  });

  return clon;
}

export function obtenerCategoriaVariante(categorias, categoriaId) {
  return (categorias || []).find(
    (categoria) => String(categoria.id) === String(categoriaId)
  );
}

export function esTabCategoriaVariante(tab, categorias) {
  if (tab === TAB_CATEGORIAS_VARIANTES) return true;
  return (categorias || []).some((categoria) => String(categoria.id) === String(tab));
}

export function itemsActivosCategoria(catalogos, categoriaId) {
  return (catalogos?.[String(categoriaId)] || []).filter(
    (item) => item.activo !== false
  );
}

export function ordenarItemsVariantes(items) {
  return [...(items || [])].sort((a, b) =>
    String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es')
  );
}

export function catalogosVariantesOrdenadosDesde(catalogos, categorias, negocioId) {
  return categoriasVariantesActivas(categorias).reduce((acc, categoria) => {
    const categoriaId = String(categoria.id);
    acc[categoriaId] = ordenarItemsVariantes(
      (catalogos?.[categoriaId] || []).filter(
        (item) => !negocioId || item?.negocio_id == null || item.negocio_id === negocioId
      )
    );
    return acc;
  }, {});
}

export function formatoResumenCategoria(categoria) {
  const nombre = String(categoria?.nombre || '')
    .trim()
    .toLowerCase();

  if (nombre.includes('topping')) {
    return { tipo: 'plus' };
  }

  const clave = nombre.endsWith('s') ? nombre.slice(0, -1) : nombre;
  return { tipo: 'clave', clave: clave || nombre };
}

function idsVariantesCategoria(ctx, categoriaId) {
  return itemsActivosCategoria(ctx.catalogos, categoriaId).map((item) =>
    String(item.id)
  );
}

function variantesActivasTodasPorCategoria(ctx) {
  return categoriasVariantesActivas(ctx.categorias).reduce((acc, categoria) => {
    const categoriaId = String(categoria.id);
    const ids = idsVariantesCategoria(ctx, categoriaId);
    if (ids.length > 0) acc[categoriaId] = ids;
    return acc;
  }, {});
}

function mapaExplicitoProducto(productoId, ctx) {
  return ctx.productoItems?.[String(productoId)] || {};
}

export function productoVariantesConfiguradas(producto) {
  return producto?.variantes_configuradas === true;
}

export function mapaItemsPermitidosProducto(producto, ctx) {
  if (productoVariantesConfiguradas(producto)) {
    return mapaExplicitoProducto(producto?.id, ctx);
  }

  return variantesActivasTodasPorCategoria(ctx);
}

export function parsearVariantesActivasProducto(producto, ctx) {
  return mapaItemsPermitidosProducto(producto, ctx);
}

export function variantesActivasFormDesdeProducto(producto, ctx) {
  const mapa = productoVariantesConfiguradas(producto)
    ? mapaExplicitoProducto(producto?.id, ctx)
    : {};

  return categoriasVariantesActivas(ctx.categorias).reduce((acc, categoria) => {
    const categoriaId = String(categoria.id);
    const items = mapa[categoriaId] || [];
    acc[categoriaId] = {
      categoria: items.length > 0,
      items: [...items],
    };
    return acc;
  }, crearVariantesActivasFormVacias(ctx.categorias));
}

export function itemIdsDesdeFormActivas(formActivas, ctx) {
  const ids = [];

  categoriasVariantesActivas(ctx.categorias).forEach((categoria) => {
    const categoriaId = String(categoria.id);
    const entry = formActivas?.[categoriaId];
    if (!entry?.categoria) return;

    (entry.items || []).forEach((itemId) => {
      const id = String(itemId);
      if (id) ids.push(id);
    });
  });

  return ids;
}

export function filtrarItemsVariantesProducto(producto, categoriaId, ctx) {
  const mapa = parsearVariantesActivasProducto(producto, ctx);
  const idsPermitidos = new Set((mapa[String(categoriaId)] || []).map(String));

  return ordenarItemsVariantes(itemsActivosCategoria(ctx.catalogos, categoriaId)).filter(
    (item) => idsPermitidos.has(String(item.id))
  );
}

export function construirProductoItemsMap(links, catalogos) {
  const mapa = {};

  (links || []).forEach((link) => {
    const productoId = String(link.producto_id);
    const itemId = String(link.item_variante_id);
    let categoriaId = link.categoria_id ? String(link.categoria_id) : null;

    if (!categoriaId) {
      for (const [catId, items] of Object.entries(catalogos || {})) {
        if ((items || []).some((item) => String(item.id) === itemId)) {
          categoriaId = String(catId);
          break;
        }
      }
    }

    if (!categoriaId) return;

    if (!mapa[productoId]) mapa[productoId] = {};
    if (!mapa[productoId][categoriaId]) mapa[productoId][categoriaId] = [];
    if (!mapa[productoId][categoriaId].includes(itemId)) {
      mapa[productoId][categoriaId].push(itemId);
    }
  });

  return mapa;
}

export function agruparItemsPorCategoria(items) {
  return (items || []).reduce((acc, item) => {
    const categoriaId = String(item.categoria_id);
    if (!acc[categoriaId]) acc[categoriaId] = [];
    acc[categoriaId].push(item);
    return acc;
  }, {});
}

function buscarPorId(lista, id) {
  if (id === '' || id === null || id === undefined) {
    return null;
  }

  return (lista || []).find((item) => String(item.id) === String(id)) || null;
}

export function calcularExtrasLinea(linea, ctx) {
  let extras = 0;

  categoriasVariantesActivas(ctx.categorias).forEach((categoria) => {
    const categoriaId = String(categoria.id);
    (linea.variantes?.[categoriaId] || []).forEach((id) => {
      const item = buscarPorId(ctx.catalogos?.[categoriaId], id);
      const precio = Number(item?.precio);
      if (Number.isFinite(precio) && precio > 0) {
        extras += precio;
      }
    });
  });

  return extras;
}

function nombresVariantesLinea(linea, categoriaId, ctx, idsPermitidos = null) {
  return (linea.variantes?.[String(categoriaId)] || [])
    .filter((id) => !idsPermitidos || idsPermitidos.has(String(id)))
    .map((id) => buscarPorId(ctx.catalogos?.[String(categoriaId)], id)?.nombre)
    .filter(Boolean);
}

export function formatearDetalleVariantesLinea(linea, ctx, idsPermitidosPorCategoria = null) {
  const detalles = [];

  categoriasVariantesActivas(ctx.categorias).forEach((categoria) => {
    const categoriaId = String(categoria.id);
    const idsPermitidos = idsPermitidosPorCategoria?.[categoriaId]
      ? new Set(idsPermitidosPorCategoria[categoriaId].map(String))
      : null;
    const nombres = nombresVariantesLinea(linea, categoriaId, ctx, idsPermitidos);
    if (!nombres.length) return;

    const formato = formatoResumenCategoria(categoria);
    if (formato.tipo === 'plus') {
      detalles.push(`+${nombres.join(', ')}`);
    } else {
      detalles.push(`${formato.clave}: ${nombres.join(', ')}`);
    }
  });

  return detalles;
}

export function formatearLineaResumen(linea, producto, ctx) {
  const cantidad = parseInt(linea.cantidad, 10);
  let texto = cantidad > 1 ? `${producto.nombre} x${cantidad}` : producto.nombre;
  const mapa = parsearVariantesActivasProducto(producto, ctx);
  const detalles = categoriasVariantesActivas(ctx.categorias).flatMap((categoria) => {
    const categoriaId = String(categoria.id);
    const idsPermitidos = new Set((mapa[categoriaId] || []).map(String));
    if (idsPermitidos.size === 0) return [];

    const nombres = nombresVariantesLinea(linea, categoriaId, ctx, idsPermitidos);
    if (!nombres.length) return [];

    const formato = formatoResumenCategoria(categoria);
    if (formato.tipo === 'plus') {
      return [`+${nombres.join(', ')}`];
    }
    return [`${formato.clave}: ${nombres.join(', ')}`];
  });

  if (detalles.length) {
    texto += ` (${detalles.join('; ')})`;
  }

  return texto;
}

function idsDesdeNombresVariantes(nombres, lista) {
  return nombres
    .map((nombre) => {
      const item = (lista || []).find((entry) => entry.nombre === nombre);
      return item ? String(item.id) : null;
    })
    .filter(Boolean);
}

export function parsearDetalleVariantes(detalle, ctx) {
  const variantes = crearVariantesLineaVacias(ctx.categorias);

  if (detalle.startsWith('+')) {
    const categoriaTopping = categoriasVariantesActivas(ctx.categorias).find(
      (categoria) => formatoResumenCategoria(categoria).tipo === 'plus'
    );

    if (categoriaTopping) {
      variantes[String(categoriaTopping.id)] = idsDesdeNombresVariantes(
        detalle
          .slice(1)
          .split(', ')
          .map((t) => t.trim())
          .filter(Boolean),
        ctx.catalogos?.[String(categoriaTopping.id)]
      );
    }

    return variantes;
  }

  categoriasVariantesActivas(ctx.categorias).forEach((categoria) => {
    const categoriaId = String(categoria.id);
    const formato = formatoResumenCategoria(categoria);
    if (formato.tipo === 'plus') return;

    const prefijos = [
      `${formato.clave}: `,
      `${String(categoria.nombre || '').toLowerCase()}: `,
    ];

    prefijos.forEach((prefijo) => {
      if (!detalle.startsWith(prefijo)) return;

      variantes[categoriaId] = idsDesdeNombresVariantes(
        detalle
          .slice(prefijo.length)
          .split(', ')
          .map((t) => t.trim())
          .filter(Boolean),
        ctx.catalogos?.[categoriaId]
      );
    });
  });

  return variantes;
}

export function combinarVariantesLinea(ctx, ...listas) {
  const combinadas = crearVariantesLineaVacias(ctx.categorias);

  categoriasVariantesActivas(ctx.categorias).forEach((categoria) => {
    const categoriaId = String(categoria.id);
    const ids = new Set();

    listas.forEach((variantes) => {
      (variantes?.[categoriaId] || []).forEach((id) => ids.add(String(id)));
    });

    combinadas[categoriaId] = Array.from(ids);
  });

  Object.keys(combinadas).forEach((categoriaId) => {
    listas.forEach((variantes) => {
      (variantes?.[categoriaId] || []).forEach((id) => {
        if (!combinadas[categoriaId].includes(String(id))) {
          combinadas[categoriaId].push(String(id));
        }
      });
    });
  });

  return combinadas;
}
