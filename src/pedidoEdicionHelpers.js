import { buscarProductoPorId } from './pedidoCarritoCalculos';
import { CLIENTE_MOSTRADOR } from './pedidoCarritoStorage';
import {
  TIPOS_ENTREGA,
  enriquecerLineasDetalleCocina,
  mergeStatusCocinasEnEdicion,
  normalizarLineasDetallePedido,
  obtenerStatusGlobalTrasCocinas,
  todasCocinasRequeridasListas,
} from './pedidosShared';
import {
  cantidadInicialLinea,
  esProductoPorPeso,
  parseGramosLinea,
} from './productoUnidadVenta';
import {
  combinarVariantesLinea,
  crearVariantesLineaVacias,
  formatearLineaResumen,
  parsearDetalleVariantes,
} from './variantesDinamicas';

export function crearLineaPedidoVacia(id, variantesCtx) {
  return {
    id,
    productoId: '',
    cantidad: '1',
    variantes: variantesCtx ? crearVariantesLineaVacias(variantesCtx.categorias) : {},
  };
}

export { normalizarLineasDetallePedido };

function productoIdDesdeLineaDetalle(linea, listaProductos) {
  if (linea?.productoId != null && linea.productoId !== '') {
    return String(linea.productoId);
  }

  if (linea?.nombre) {
    const producto = listaProductos.find((item) => item.nombre === linea.nombre);
    if (producto) return String(producto.id);
  }

  return '';
}

function parsearLineaPedidoDesdeTexto(parte, listaProductos, variantesCtx, id = 1) {
  let textoBase = parte;
  let variantes = crearVariantesLineaVacias(variantesCtx.categorias);

  const matchVariantes = parte.match(/^(.+?)\s*\((.+)\)$/);
  if (matchVariantes) {
    textoBase = matchVariantes[1].trim();
    const detalles = matchVariantes[2].split('; ').map((d) => d.trim());
    const variantesParseadas = detalles.map((detalle) =>
      parsearDetalleVariantes(detalle, variantesCtx)
    );
    variantes = combinarVariantesLinea(variantesCtx, ...variantesParseadas);
  }

  const match = textoBase.match(/^(.+?) x(\d+)$/);
  let nombre;
  let cantidad;

  if (match) {
    nombre = match[1];
    cantidad = match[2];
  } else {
    nombre = textoBase;
    cantidad = '1';
  }

  const producto = listaProductos.find((p) => p.nombre === nombre);

  return {
    id,
    productoId: producto ? String(producto.id) : '',
    cantidad,
    variantes,
  };
}

function variantesFormularioDesdeLineaDetalle(linea, listaProductos, variantesCtx) {
  if (!linea?.descripcion?.trim()) {
    return crearVariantesLineaVacias(variantesCtx.categorias);
  }

  const parsed = parsearLineaPedidoDesdeTexto(
    linea.descripcion,
    listaProductos,
    variantesCtx
  );

  return parsed?.variantes || crearVariantesLineaVacias(variantesCtx.categorias);
}

function cantidadFormularioDesdeLineaDetalle(linea, productoId, listaProductos) {
  const producto = buscarProductoPorId(listaProductos, productoId);

  if (esProductoPorPeso(linea) || esProductoPorPeso(producto)) {
    const gramos = parseGramosLinea(linea?.cantidad);
    return gramos > 0 ? String(gramos) : cantidadInicialLinea(producto);
  }

  return String(Math.max(1, parseInt(linea.cantidad, 10) || 1));
}

export function lineasFormularioDesdePedido(pedido, listaProductos, variantesCtx) {
  const lineasDetalle = normalizarLineasDetallePedido(pedido);

  if (lineasDetalle.length > 0) {
    return lineasDetalle.map((linea, index) => {
      const productoId = productoIdDesdeLineaDetalle(linea, listaProductos);

      return {
        id: index + 1,
        productoId,
        cantidad: cantidadFormularioDesdeLineaDetalle(linea, productoId, listaProductos),
        variantes: variantesFormularioDesdeLineaDetalle(
          linea,
          listaProductos,
          variantesCtx
        ),
      };
    });
  }

  return [crearLineaPedidoVacia(1, variantesCtx)];
}

export function resumenProductosDesdeLineas(lineas, listaProductos, variantesCtx) {
  return lineas
    .map((linea) => {
      const producto = buscarProductoPorId(listaProductos, linea.productoId);
      if (!producto) return null;
      return formatearLineaResumen(linea, producto, variantesCtx);
    })
    .filter(Boolean)
    .join(', ');
}

export function construirSnapshotCarritoDesdePedido(pedido, productos, variantesCtx) {
  const lineas = lineasFormularioDesdePedido(pedido, productos, variantesCtx);

  return {
    form: {
      cliente: pedido?.cliente || '',
      telefono: pedido?.telefono || '',
      tipoEntrega: pedido?.tipo_entrega || TIPOS_ENTREGA.SUCURSAL,
      direccion: pedido?.direccion || '',
      formaPago: pedido?.forma_pago || 'efectivo',
      referencia: pedido?.referencia || '',
      status: pedido?.status || 'en-cocina',
      lineas,
    },
    pagoRecibido: '',
    nextLineaId: lineas.length + 1,
  };
}

function formatearClienteMostrador(referencia) {
  const nombre = referencia?.trim();
  return nombre || CLIENTE_MOSTRADOR;
}

function resolverStatusCocinasTrasEdicion(pedidoOriginal, pedidoEnriquecido) {
  const statusActual = pedidoOriginal?.status;

  if (!['en-cocina', 'en-preparacion'].includes(statusActual)) {
    return {
      status: statusActual,
      status_cocina1: pedidoOriginal?.status_cocina1 ?? null,
      status_cocina2: pedidoOriginal?.status_cocina2 ?? null,
    };
  }

  const merge = mergeStatusCocinasEnEdicion(pedidoOriginal, pedidoEnriquecido);

  if (!merge.requiereAlgunaCocina) {
    return {
      status: obtenerStatusGlobalTrasCocinas(
        pedidoOriginal?.tipo_entrega,
        pedidoOriginal?.tipo
      ),
      status_cocina1: null,
      status_cocina2: null,
    };
  }

  const statusCocinas = {
    status_cocina1: merge.status_cocina1,
    status_cocina2: merge.status_cocina2,
  };

  const pedidoProyectado = {
    ...pedidoEnriquecido,
    status: statusActual,
    ...statusCocinas,
  };

  let status = statusActual;

  if (todasCocinasRequeridasListas(pedidoProyectado)) {
    status = obtenerStatusGlobalTrasCocinas(
      pedidoOriginal?.tipo_entrega,
      pedidoOriginal?.tipo
    );
  }

  return {
    status,
    ...statusCocinas,
  };
}

export function construirPayloadEdicionMostrador({
  pedidoOriginal,
  detallePedido,
  resumen,
  form,
  productos,
}) {
  const pedidoConDetalle = {
    producto: resumen,
    lineas_detalle: Array.isArray(detallePedido?.lineas) ? detallePedido.lineas : [],
    total: detallePedido?.total ?? 0,
  };

  const pedidoEnriquecido = enriquecerLineasDetalleCocina(pedidoConDetalle, productos);
  const { status, status_cocina1, status_cocina2 } = resolverStatusCocinasTrasEdicion(
    pedidoOriginal,
    pedidoEnriquecido
  );

  return {
    cliente: formatearClienteMostrador(form.referencia),
    producto: resumen,
    lineas_detalle: pedidoEnriquecido.lineas_detalle,
    total: detallePedido.total,
    referencia: form.referencia?.trim() || null,
    forma_pago: form.formaPago || 'efectivo',
    status,
    status_cocina1,
    status_cocina2,
  };
}

export function construirPayloadEdicionRondaMesa({
  pedidoOriginal,
  detallePedido,
  resumen,
  productos,
}) {
  const pedidoConDetalle = {
    producto: resumen,
    lineas_detalle: Array.isArray(detallePedido?.lineas) ? detallePedido.lineas : [],
    total: detallePedido?.total ?? 0,
  };

  const pedidoEnriquecido = enriquecerLineasDetalleCocina(pedidoConDetalle, productos);
  const { status, status_cocina1, status_cocina2 } = resolverStatusCocinasTrasEdicion(
    pedidoOriginal,
    pedidoEnriquecido
  );

  return {
    producto: resumen,
    lineas_detalle: pedidoEnriquecido.lineas_detalle,
    total: detallePedido.total,
    status,
    status_cocina1,
    status_cocina2,
  };
}

export function tituloAutorizacionPinPedido(accion, pedido) {
  const esVenta = pedido?.tipo === 'presencial';
  const esRonda = pedido?.tipo === 'mesa';

  if (accion === 'editar') {
    if (esVenta) return 'Autoriza la edición de la venta';
    if (esRonda) return 'Autoriza la edición de la ronda';
    return 'Autoriza la edición del pedido';
  }

  if (esVenta) return 'Autoriza la eliminación de la venta';
  if (esRonda) return 'Autoriza la eliminación de la ronda';
  return 'Autoriza la eliminación del pedido';
}
