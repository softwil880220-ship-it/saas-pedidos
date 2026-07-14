import { redondearMoneda } from './pedidoCarritoCalculos';
import { formatearMoneda } from './pedidosShared';
import {
  categoriasVariantesActivas,
  combinarVariantesLinea,
  crearVariantesLineaVacias,
  formatoResumenCategoria,
  parsearDetalleVariantes,
} from './variantesDinamicas';

function extraerNombreBase(descripcion, nombreLinea) {
  const nombre = String(nombreLinea ?? '').trim();
  if (nombre) {
    return nombre;
  }

  const texto = String(descripcion ?? '').trim();
  const indiceVariantes = texto.indexOf(' (');
  return indiceVariantes >= 0 ? texto.slice(0, indiceVariantes).trim() : texto;
}

function extraerEtiquetaVariantes(descripcion) {
  const texto = String(descripcion ?? '').trim();
  const coincidencia = texto.match(/\(([^)]+)\)\s*$/);
  if (!coincidencia) {
    return null;
  }

  return coincidencia[1].trim() || null;
}

function normalizarLineaDetalleRecibo(linea) {
  const cantidad = Math.max(1, parseInt(linea?.cantidad, 10) || 1);
  const extras = redondearMoneda(Number(linea?.extras) || 0);
  const precioUnitarioGuardado = Number(linea?.precioUnitario ?? linea?.precio_unitario);
  const precioBaseGuardado = Number(linea?.precioBase);
  const precioBase = Number.isFinite(precioBaseGuardado)
    ? redondearMoneda(precioBaseGuardado)
    : Number.isFinite(precioUnitarioGuardado)
      ? redondearMoneda(precioUnitarioGuardado - extras)
      : redondearMoneda((Number(linea?.subtotal) || 0) / cantidad - extras);

  const subtotal = redondearMoneda(
    Number(linea?.subtotal) || precioBase * cantidad + extras * cantidad
  );
  const subtotalBase = redondearMoneda(precioBase * cantidad);
  const subtotalExtras = redondearMoneda(subtotal - subtotalBase);
  const nombre = extraerNombreBase(linea?.descripcion, linea?.nombre);
  const etiquetaVariantes = extras > 0 ? extraerEtiquetaVariantes(linea?.descripcion) : null;

  return {
    productoId: linea?.productoId != null ? String(linea.productoId) : '',
    nombre,
    cantidad,
    precioBase,
    subtotalBase,
    subtotalExtras,
    etiquetaVariantes,
    tieneVariantes: extras > 0,
    descripcion: linea?.descripcion || '',
  };
}

function buscarItemVariante(catalogos, categoriaId, id) {
  return (catalogos?.[String(categoriaId)] || []).find(
    (item) => String(item.id) === String(id)
  );
}

function reconstruirVariantesDesdeDescripcion(descripcion, variantesCtx) {
  const categorias = variantesCtx?.categorias;
  if (!Array.isArray(categorias) || categorias.length === 0) {
    return {};
  }

  const etiqueta = extraerEtiquetaVariantes(descripcion);
  if (!etiqueta) {
    return crearVariantesLineaVacias(categorias);
  }

  const partes = etiqueta
    .split(';')
    .map((parte) => parte.trim())
    .filter(Boolean);

  return partes.reduce(
    (acumulado, parte) =>
      combinarVariantesLinea(
        variantesCtx,
        acumulado,
        parsearDetalleVariantes(parte, variantesCtx)
      ),
    crearVariantesLineaVacias(categorias)
  );
}

function etiquetaIngredienteExtra(categoria, item) {
  const formato = formatoResumenCategoria(categoria);

  if (formato.tipo === 'plus') {
    return `Ingrediente extra (+${item.nombre})`;
  }

  return `Ingrediente extra (${formato.clave}: ${item.nombre})`;
}

function filaIngredienteExtraCombinado(normalizada) {
  return {
    cantidad: normalizada.cantidad,
    nombre: `Ingrediente extra (${normalizada.etiquetaVariantes || 'Extra'})`,
    precioLinea: normalizada.subtotalExtras,
  };
}

function expandirLineaDetalleRecibo(lineaCruda, variantesCtx) {
  const normalizada = normalizarLineaDetalleRecibo(lineaCruda);
  const filas = [
    {
      cantidad: normalizada.cantidad,
      nombre: normalizada.nombre,
      precioLinea: normalizada.subtotalBase,
    },
  ];

  if (!normalizada.tieneVariantes || normalizada.subtotalExtras <= 0) {
    return filas;
  }

  if (!variantesCtx?.categorias?.length) {
    filas.push(filaIngredienteExtraCombinado(normalizada));
    return filas;
  }

  const lineaForm = {
    productoId: normalizada.productoId,
    cantidad: String(normalizada.cantidad),
    variantes: reconstruirVariantesDesdeDescripcion(
      normalizada.descripcion,
      variantesCtx
    ),
  };

  const extrasItems = [];

  categoriasVariantesActivas(variantesCtx.categorias).forEach((categoria) => {
    const categoriaId = String(categoria.id);

    (lineaForm.variantes[categoriaId] || []).forEach((id) => {
      const item = buscarItemVariante(variantesCtx.catalogos, categoriaId, id);
      const precioUnitario = Number(item?.precio);

      if (!item || !Number.isFinite(precioUnitario) || precioUnitario <= 0) {
        return;
      }

      extrasItems.push({
        cantidad: normalizada.cantidad,
        nombre: etiquetaIngredienteExtra(categoria, item),
        precioLinea: redondearMoneda(precioUnitario * normalizada.cantidad),
      });
    });
  });

  if (extrasItems.length === 0) {
    filas.push(filaIngredienteExtraCombinado(normalizada));
    return filas;
  }

  const sumaExtras = redondearMoneda(
    extrasItems.reduce((suma, item) => suma + item.precioLinea, 0)
  );

  if (Math.abs(sumaExtras - normalizada.subtotalExtras) > 0.01) {
    filas.push(filaIngredienteExtraCombinado(normalizada));
    return filas;
  }

  filas.push(...extrasItems);
  return filas;
}

export function obtenerDesgloseLineasPedido(pedido, productos, variantesCtx) {
  if (pedido?.lineas_detalle?.length) {
    const lineas = pedido.lineas_detalle.flatMap((linea) =>
      expandirLineaDetalleRecibo(linea, variantesCtx)
    );

    const total = redondearMoneda(
      lineas.reduce((suma, linea) => suma + (linea.precioLinea ?? 0), 0) ||
        Number(pedido.total) ||
        0
    );

    return { lineas, total };
  }

  const total = redondearMoneda(Number(pedido?.total) || 0);
  const producto = pedido?.producto?.trim();

  if (!producto) {
    return { lineas: [], total };
  }

  if (productos?.length && variantesCtx) {
    const partes = producto.split(', ').map((parte) => parte.trim()).filter(Boolean);
    const lineasExpandidas = partes.flatMap((parte, index) => {
      const productoCoincidente = productos.find((item) =>
        parte.toLowerCase().startsWith(String(item.nombre).toLowerCase())
      );

      if (!productoCoincidente) {
        return [
          {
            cantidad: 1,
            nombre: parte,
            precioLinea: index === 0 && total > 0 ? total : null,
          },
        ];
      }

      return expandirLineaDetalleRecibo(
        {
          productoId: productoCoincidente.id,
          nombre: productoCoincidente.nombre,
          descripcion: parte.includes('(') ? parte : productoCoincidente.nombre,
          cantidad: 1,
          precioBase: productoCoincidente.precio,
          extras: 0,
          subtotal: productoCoincidente.precio,
        },
        variantesCtx
      );
    });

    if (lineasExpandidas.length > 0) {
      return {
        lineas: lineasExpandidas,
        total,
      };
    }
  }

  return {
    lineas: [
      {
        cantidad: 1,
        nombre: producto,
        precioLinea: total > 0 ? total : null,
      },
    ],
    total,
  };
}

export function formatearPrecioLineaRecibo(precioLinea) {
  if (precioLinea == null) return '—';
  return formatearMoneda(precioLinea);
}
