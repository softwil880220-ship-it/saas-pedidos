import { useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './App.css';
import { supabase } from './supabase';
import { usePedidosRealtime, useProductosRealtime } from './usePedidosRealtime';
import {
  COCINAS,
  COCINAS_OPCIONES,
  construirPayloadAvancePedido,
  construirPayloadRetrocesoPedido,
  determinarStatusInicialPresencial,
  enriquecerLineasDetalleCocina,
  etiquetaCocinaProducto,
  formatearProgresoCocinas,
  mergeStatusCocinasEnEdicion,
  normalizarCocinaProducto,
  obtenerStatusGlobalTrasCocinas,
  payloadStatusCocinasParaStatusGlobal,
  pedidoRequiereAlgunaCocina,
  prepararStatusCocinasAlEntrar,
  todasCocinasRequeridasListas,
} from './pedidosShared';
import VistaCocina from './VistaCocina';
import VistaCocina2 from './VistaCocina2';
import VistaRepartidor from './VistaRepartidor';

const STATUS_FLOW_DOMICILIO = ['por-aceptar', 'en-cocina', 'enviado', 'entregado'];
const STATUS_FLOW_SUCURSAL = [
  'por-aceptar',
  'en-cocina',
  'listo-para-recoger',
  'entregado',
];

const STATUS_LABELS = {
  'por-aceptar': 'Por aceptar',
  'en-cocina': 'En cocina',
  enviado: 'Enviado',
  entregado: 'Entregado',
  'listo-para-recoger': 'Listo para recoger',
};

const TIPOS_ENTREGA = {
  DOMICILIO: 'domicilio',
  SUCURSAL: 'sucursal',
};

const TIPOS_ENTREGA_OPCIONES = [
  { value: TIPOS_ENTREGA.DOMICILIO, label: 'A domicilio', icono: '🛵' },
  { value: TIPOS_ENTREGA.SUCURSAL, label: 'Recoger en sucursal', icono: '🏪' },
];

const SECCIONES_ENTREGA_DASHBOARD = [
  {
    key: TIPOS_ENTREGA.DOMICILIO,
    titulo: '🛵 A domicilio',
    flujo: STATUS_FLOW_DOMICILIO,
  },
  {
    key: TIPOS_ENTREGA.SUCURSAL,
    titulo: '🏪 Para recoger',
    flujo: STATUS_FLOW_SUCURSAL,
  },
];

function crearFiltrosPorFlujo(flujo) {
  return [
    { value: 'todos', label: 'Todos' },
    ...flujo.map((status) => ({ value: status, label: STATUS_LABELS[status] })),
  ];
}

const FILTROS_DOMICILIO = crearFiltrosPorFlujo(STATUS_FLOW_DOMICILIO);
const FILTROS_SUCURSAL = crearFiltrosPorFlujo(STATUS_FLOW_SUCURSAL);

const SECCIONES = [
  { value: 'pedidos', label: 'Pedidos' },
  { value: 'catalogo', label: 'Catálogo de productos' },
];

const MODOS = [
  { value: 'presencial', label: 'Modo Caja' },
  { value: 'whatsapp', label: 'Modo WhatsApp' },
];

const VARIANTES_CATEGORIAS = [
  { key: 'toppings', tabla: 'toppings', label: 'Toppings', resumenFormato: 'plus' },
  { key: 'salsas', tabla: 'salsas', label: 'Salsas', resumenClave: 'salsas' },
  { key: 'mayonesas', tabla: 'mayonesas', label: 'Mayonesa', resumenClave: 'mayonesa' },
  { key: 'untables', tabla: 'untables', label: 'Untables', resumenClave: 'untables' },
  { key: 'quesos', tabla: 'quesos', label: 'Queso', resumenClave: 'queso' },
  { key: 'cremas', tabla: 'cremas', label: 'Crema', resumenClave: 'crema' },
  { key: 'chiles', tabla: 'chiles', label: 'Chile', resumenClave: 'chile' },
];

const RESUMEN_VARIANTES_ORDEN = [
  'quesos',
  'cremas',
  'chiles',
  'mayonesas',
  'untables',
  'toppings',
  'salsas',
];

function crearVariantesActivasFormVacias() {
  return RESUMEN_VARIANTES_ORDEN.reduce((acc, key) => {
    acc[key] = { categoria: false, items: [] };
    return acc;
  }, {});
}

function idsVariantesCategoria(catalogosVariantes, key) {
  return (catalogosVariantes[key] || []).map((item) => String(item.id));
}

function variantesActivasTodasPorCategoria(catalogosVariantes) {
  return RESUMEN_VARIANTES_ORDEN.reduce((acc, key) => {
    const ids = idsVariantesCategoria(catalogosVariantes, key);
    if (ids.length > 0) acc[key] = ids;
    return acc;
  }, {});
}

function parsearVariantesActivasProducto(producto, catalogosVariantes) {
  const raw = producto?.variantes_activas;

  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const result = {};
    RESUMEN_VARIANTES_ORDEN.forEach((key) => {
      const ids = raw[key];
      if (Array.isArray(ids) && ids.length > 0) {
        result[key] = ids.map(String);
      }
    });
    return result;
  }

  if (Array.isArray(raw)) {
    if (raw.length === 0) return {};
    return raw.reduce((acc, key) => {
      if (!RESUMEN_VARIANTES_ORDEN.includes(key)) return acc;
      const ids = idsVariantesCategoria(catalogosVariantes, key);
      if (ids.length > 0) acc[key] = ids;
      return acc;
    }, {});
  }

  return variantesActivasTodasPorCategoria(catalogosVariantes);
}

function variantesActivasFormDesdeProducto(producto, catalogosVariantes) {
  const mapa = parsearVariantesActivasProducto(producto, catalogosVariantes);
  return RESUMEN_VARIANTES_ORDEN.reduce((acc, key) => {
    const items = mapa[key] || [];
    acc[key] = {
      categoria: items.length > 0,
      items: [...items],
    };
    return acc;
  }, {});
}

function variantesActivasJsonDesdeForm(formActivas) {
  const result = {};
  RESUMEN_VARIANTES_ORDEN.forEach((key) => {
    const entry = formActivas?.[key];
    if (!entry?.categoria) return;
    const items = (entry.items || []).map(String).filter(Boolean);
    if (items.length > 0) result[key] = items;
  });
  return result;
}

function filtrarItemsVariantesProducto(producto, key, catalogosVariantes) {
  const mapa = parsearVariantesActivasProducto(producto, catalogosVariantes);
  const idsPermitidos = new Set((mapa[key] || []).map(String));
  return ordenarPorNombre(catalogosVariantes[key] || []).filter((item) =>
    idsPermitidos.has(String(item.id))
  );
}

const CATALOGO_TABS = [
  { value: 'productos', label: 'Productos' },
  ...VARIANTES_CATEGORIAS.map(({ key, label }) => ({ value: key, label })),
];

function crearCatalogosVariantesVacios() {
  return VARIANTES_CATEGORIAS.reduce((acc, { key }) => {
    acc[key] = [];
    return acc;
  }, {});
}

function crearVariantesLineaVacias() {
  return VARIANTES_CATEGORIAS.reduce((acc, { key }) => {
    acc[key] = [];
    return acc;
  }, {});
}

function esCategoriaVariante(value) {
  return VARIANTES_CATEGORIAS.some(({ key }) => key === value);
}

function obtenerConfigVariante(key) {
  return VARIANTES_CATEGORIAS.find((c) => c.key === key);
}

const CLIENTE_PUBLICO = 'Público general';

function normalizarTipoEntrega(tipoEntrega) {
  return tipoEntrega === TIPOS_ENTREGA.SUCURSAL
    ? TIPOS_ENTREGA.SUCURSAL
    : TIPOS_ENTREGA.DOMICILIO;
}

function obtenerFlujoStatus(tipoEntrega) {
  return normalizarTipoEntrega(tipoEntrega) === TIPOS_ENTREGA.SUCURSAL
    ? STATUS_FLOW_SUCURSAL
    : STATUS_FLOW_DOMICILIO;
}

function formatearTipoEntrega(tipoEntrega) {
  const opcion = TIPOS_ENTREGA_OPCIONES.find(
    (item) => item.value === normalizarTipoEntrega(tipoEntrega)
  );
  return opcion ? `${opcion.icono} ${opcion.label}` : '🛵 A domicilio';
}

function siguienteStatus(status, tipoEntrega = TIPOS_ENTREGA.DOMICILIO) {
  const flujo = obtenerFlujoStatus(tipoEntrega);
  const indice = flujo.indexOf(status);
  if (indice === -1 || indice === flujo.length - 1) return status;
  return flujo[indice + 1];
}

function anteriorStatus(status, tipoEntrega = TIPOS_ENTREGA.DOMICILIO) {
  const flujo = obtenerFlujoStatus(tipoEntrega);
  const indice = flujo.indexOf(status);
  if (indice <= 0) return status;
  return flujo[indice - 1];
}

function esStatusFinal(status, tipoEntrega = TIPOS_ENTREGA.DOMICILIO) {
  const flujo = obtenerFlujoStatus(tipoEntrega);
  return status === flujo[flujo.length - 1];
}

function puedeRetrocederPedido(status, tipoEntrega = TIPOS_ENTREGA.DOMICILIO) {
  if (normalizarTipoEntrega(tipoEntrega) === TIPOS_ENTREGA.SUCURSAL) {
    return (
      status === 'en-cocina' ||
      status === 'listo-para-recoger' ||
      status === 'entregado'
    );
  }
  return status === 'en-cocina' || status === 'enviado';
}

function mostrarContactoWhatsAppPedido(status, tipoEntrega = TIPOS_ENTREGA.DOMICILIO) {
  if (normalizarTipoEntrega(tipoEntrega) === TIPOS_ENTREGA.SUCURSAL) {
    return status === 'por-aceptar' || status === 'listo-para-recoger';
  }
  return status === 'por-aceptar' || status === 'enviado';
}

function crearLineaPedido(id) {
  return {
    id,
    productoId: '',
    cantidad: '1',
    variantes: crearVariantesLineaVacias(),
  };
}

function buscarPorId(lista, id) {
  if (id === '' || id === null || id === undefined) {
    return null;
  }

  return lista.find((item) => String(item.id) === String(id)) || null;
}

function buscarProductoPorId(listaProductos, productoId) {
  return buscarPorId(listaProductos, productoId);
}

function formatearEtiquetaProducto(producto) {
  return `${producto.nombre} — $${Number(producto.precio).toFixed(2)}`;
}

function precioVarianteExtra(item) {
  const precio = Number(item?.precio);
  return Number.isFinite(precio) && precio > 0 ? precio : 0;
}

function parsePrecioCatalogo(valor) {
  const precio = Number(valor);
  return Number.isFinite(precio) ? redondearMoneda(precio) : 0;
}

function redondearMoneda(valor) {
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}

function calcularExtrasLinea(linea, catalogosVariantes) {
  let extras = 0;

  RESUMEN_VARIANTES_ORDEN.forEach((key) => {
    (linea.variantes?.[key] || []).forEach((id) => {
      const item = buscarPorId(catalogosVariantes[key], id);
      if (item) extras += precioVarianteExtra(item);
    });
  });

  return extras;
}

function toggleIdEnLinea(ids, id) {
  const lista = ids || [];
  const idStr = String(id);
  if (lista.some((item) => String(item) === idStr)) {
    return lista.filter((item) => String(item) !== idStr);
  }
  return [...lista, idStr];
}

function nombresVariantesLinea(linea, key, catalogosVariantes, idsPermitidos = null) {
  return (linea.variantes?.[key] || [])
    .filter((id) => !idsPermitidos || idsPermitidos.has(String(id)))
    .map((id) => buscarPorId(catalogosVariantes[key], id)?.nombre)
    .filter(Boolean);
}

function formatearDetalleVariantesLinea(linea, catalogosVariantes, idsPermitidos = null) {
  const detalles = [];

  RESUMEN_VARIANTES_ORDEN.forEach((key) => {
    const config = obtenerConfigVariante(key);
    if (!config) return;

    const nombres = nombresVariantesLinea(linea, key, catalogosVariantes, idsPermitidos);
    if (!nombres.length) return;

    if (config.resumenFormato === 'plus') {
      detalles.push(`+${nombres.join(', ')}`);
    } else {
      detalles.push(`${config.resumenClave}: ${nombres.join(', ')}`);
    }
  });

  return detalles;
}

function formatearLineaResumen(linea, producto, catalogosVariantes) {
  const cantidad = parseInt(linea.cantidad, 10);
  let texto = cantidad > 1 ? `${producto.nombre} x${cantidad}` : producto.nombre;
  const mapa = parsearVariantesActivasProducto(producto, catalogosVariantes);
  const detalles = RESUMEN_VARIANTES_ORDEN.flatMap((key) => {
    const config = obtenerConfigVariante(key);
    const idsPermitidos = new Set((mapa[key] || []).map(String));
    if (!config || idsPermitidos.size === 0) return [];

    const nombres = nombresVariantesLinea(linea, key, catalogosVariantes, idsPermitidos);
    if (!nombres.length) return [];

    if (config.resumenFormato === 'plus') {
      return [`+${nombres.join(', ')}`];
    }
    return [`${config.resumenClave}: ${nombres.join(', ')}`];
  });

  if (detalles.length) {
    texto += ` (${detalles.join('; ')})`;
  }

  return texto;
}

function VariantesPedido({ linea, producto, catalogosVariantes, onToggleVariante }) {
  if (!producto) return null;

  const mapa = parsearVariantesActivasProducto(producto, catalogosVariantes);
  const categorias = RESUMEN_VARIANTES_ORDEN.filter((key) => (mapa[key] || []).length > 0);
  if (categorias.length === 0) return null;

  const grupos = categorias
    .map((key) => {
      const config = obtenerConfigVariante(key);
      if (!config) return null;

      const items = filtrarItemsVariantesProducto(producto, key, catalogosVariantes);
      if (items.length === 0) return null;

      return { key, label: config.label, items };
    })
    .filter(Boolean);

  if (grupos.length === 0) return null;

  return (
    <div className="linea-variantes">
      {grupos.map(({ key, label, items }) => (
        <div key={key} className="linea-variantes-grupo">
          <span className="linea-variantes-titulo">{label} (múltiple)</span>
          <div className="linea-variantes-opciones">
            {items.map((item) => (
              <label key={item.id} className="variante-opcion">
                <input
                  type="checkbox"
                  checked={(linea.variantes?.[key] || []).some(
                    (id) => String(id) === String(item.id)
                  )}
                  onChange={() => onToggleVariante(linea.id, key, item.id)}
                />
                <span>
                  {item.nombre}
                  {Number(item.precio) > 0
                    ? ` (+$${Number(item.precio).toFixed(2)})`
                    : ''}
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function empiezaConNumero(texto) {
  return /^\d/.test(texto.trim());
}

function ordenarPorNombre(lista) {
  return [...lista].sort((a, b) => {
    const nombreA = a.nombre.trim();
    const nombreB = b.nombre.trim();
    const numA = empiezaConNumero(nombreA);
    const numB = empiezaConNumero(nombreB);

    if (numA !== numB) {
      return numA ? 1 : -1;
    }

    return nombreA.localeCompare(nombreB, 'es', {
      sensitivity: 'base',
      numeric: true,
    });
  });
}

function ordenarProductos(lista) {
  return ordenarPorNombre(lista);
}

function calcularDetalleLineaPedido(linea, listaProductos, catalogosVariantes) {
  const producto = buscarProductoPorId(listaProductos, linea.productoId);
  if (!producto) return null;

  const cantidad = Math.max(1, parseInt(linea.cantidad, 10) || 1);
  const precioBase = parsePrecioCatalogo(producto.precio);
  const extras = redondearMoneda(calcularExtrasLinea(linea, catalogosVariantes));
  const precioUnitario = redondearMoneda(precioBase + extras);
  const subtotal = redondearMoneda(precioUnitario * cantidad);
  const descripcion = formatearDescripcionLinea(linea, producto, catalogosVariantes);

  return {
    productoId: String(producto.id),
    nombre: producto.nombre,
    cantidad,
    precioBase,
    extras,
    precioUnitario,
    subtotal,
    descripcion,
    cocina: normalizarCocinaProducto(producto.cocina),
  };
}

function calcularDetalleLineasPedido(lineas, listaProductos, catalogosVariantes) {
  const lineasDetalle = lineas
    .map((linea) => calcularDetalleLineaPedido(linea, listaProductos, catalogosVariantes))
    .filter(Boolean);

  const total = redondearMoneda(
    lineasDetalle.reduce((suma, linea) => suma + linea.subtotal, 0)
  );

  return { lineas: lineasDetalle, total };
}

function calcularSubtotal(linea, listaProductos, catalogosVariantes) {
  return calcularDetalleLineaPedido(linea, listaProductos, catalogosVariantes)?.subtotal ?? 0;
}

function calcularPrecioUnitarioLinea(linea, listaProductos, catalogosVariantes) {
  return (
    calcularDetalleLineaPedido(linea, listaProductos, catalogosVariantes)?.precioUnitario ?? 0
  );
}

function formatearDescripcionLinea(linea, producto, catalogosVariantes) {
  const detalles = formatearDetalleVariantesLinea(linea, catalogosVariantes);
  if (detalles.length === 0) return producto.nombre;
  return `${producto.nombre} (${detalles.join('; ')})`;
}

function construirLineaDesglosePedido(linea, listaProductos, catalogosVariantes) {
  const producto = buscarProductoPorId(listaProductos, linea.productoId);
  if (!producto) return null;

  const cantidad = parseInt(linea.cantidad, 10) || 1;
  const descripcion = formatearDescripcionLinea(linea, producto, catalogosVariantes);
  const precioUnitario = calcularPrecioUnitarioLinea(linea, listaProductos, catalogosVariantes);

  return { cantidad, descripcion, precioUnitario };
}

function extraerCantidadDesdeTexto(texto) {
  const matchPrecio = texto.match(/\sx(\d+)\s*—/);
  if (matchPrecio) return parseInt(matchPrecio[1], 10) || 1;

  const matchFinal = texto.match(/\sx(\d+)$/);
  if (matchFinal) return parseInt(matchFinal[1], 10) || 1;

  const matchResumen = texto.match(/^(.+?)\sx(\d+)(?:\s|$)/);
  if (matchResumen) return parseInt(matchResumen[2], 10) || 1;

  return 1;
}

function limpiarTextoDesgloseFallback(texto) {
  return texto
    .replace(/\sx\d+\s*—\s*\$[\d.]+$/, '')
    .replace(/\sx\d+$/, '')
    .trim();
}

function obtenerDesglosePedido(pedido, listaProductos, catalogosVariantes) {
  if (pedido?.lineas_detalle?.length) {
    const lineas = pedido.lineas_detalle.map((linea) => ({
      cantidad: linea.cantidad,
      descripcion: linea.descripcion,
      precioUnitario: linea.precioUnitario,
    }));
    const total = redondearMoneda(
      pedido.lineas_detalle.reduce((suma, linea) => suma + Number(linea.subtotal || 0), 0)
    );

    return { lineas, total };
  }

  const total = redondearMoneda(Number(pedido.total) || 0);

  if (!pedido?.producto?.trim()) {
    return { lineas: [], total };
  }

  const lineas = parsearLineasDesdeResumen(
    pedido.producto,
    listaProductos,
    catalogosVariantes
  );
  const partesRaw = pedido.producto.split(', ').map((s) => s.trim()).filter(Boolean);

  const filas = lineas
    .map((linea, index) => {
      const formateada = construirLineaDesglosePedido(linea, listaProductos, catalogosVariantes);
      if (formateada) return formateada;

      const raw = partesRaw[index];
      if (!raw) return null;

      return {
        cantidad: extraerCantidadDesdeTexto(raw),
        descripcion: limpiarTextoDesgloseFallback(raw),
        precioUnitario: null,
      };
    })
    .filter(Boolean);

  if (filas.length === 0) {
    return {
      lineas: [{ cantidad: 1, descripcion: pedido.producto, precioUnitario: null }],
      total,
    };
  }

  return { lineas: filas, total };
}

function DesglosePedido({ pedido, productos, catalogosVariantes }) {
  const desglose = obtenerDesglosePedido(pedido, productos, catalogosVariantes);

  if (desglose.lineas.length === 0) return null;

  return (
    <div className="pedido-desglose">
      {desglose.lineas.map((linea, index) => (
        <div key={index} className="pedido-desglose-linea">
          <span
            className="pedido-desglose-cantidad"
            aria-label={`Cantidad: ${linea.cantidad}`}
            title={`${linea.cantidad} unidad${linea.cantidad === 1 ? '' : 'es'}`}
          >
            {linea.cantidad}
          </span>
          <div className="pedido-desglose-detalle">
            <span className="pedido-desglose-nombre">{linea.descripcion}</span>
            {linea.precioUnitario != null && (
              <span className="pedido-desglose-precio">
                {' '}
                — ${linea.precioUnitario.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      ))}
      <p className="pedido-desglose-total">Total: ${desglose.total.toFixed(2)}</p>
    </div>
  );
}

function calcularTotalLineas(lineas, listaProductos, catalogosVariantes) {
  return calcularDetalleLineasPedido(lineas, listaProductos, catalogosVariantes).total;
}

function resumenProductos(lineas, listaProductos, catalogosVariantes) {
  return lineas
    .map((linea) => {
      const producto = buscarProductoPorId(listaProductos, linea.productoId);
      if (!producto) return null;
      return formatearLineaResumen(linea, producto, catalogosVariantes);
    })
    .filter(Boolean)
    .join(', ');
}

function idsDesdeNombresVariantes(nombres, lista) {
  return nombres
    .map((nombre) => {
      const item = lista.find((entry) => entry.nombre === nombre);
      return item ? String(item.id) : null;
    })
    .filter(Boolean);
}

function parsearDetalleVariantes(detalle, catalogosVariantes) {
  const variantes = crearVariantesLineaVacias();

  if (detalle.startsWith('+')) {
    variantes.toppings = idsDesdeNombresVariantes(
      detalle
        .slice(1)
        .split(', ')
        .map((t) => t.trim())
        .filter(Boolean),
      catalogosVariantes.toppings
    );
    return variantes;
  }

  VARIANTES_CATEGORIAS.forEach(({ key, resumenClave }) => {
    if (!resumenClave) return;

    const prefijos = [`${resumenClave}: `];
    if (key === 'salsas') {
      prefijos.push('salsa: ');
    }

    prefijos.forEach((prefijo) => {
      if (!detalle.startsWith(prefijo)) return;

      variantes[key] = idsDesdeNombresVariantes(
        detalle
          .slice(prefijo.length)
          .split(', ')
          .map((t) => t.trim())
          .filter(Boolean),
        catalogosVariantes[key]
      );
    });
  });

  return variantes;
}

function combinarVariantesLinea(...listas) {
  const combinadas = crearVariantesLineaVacias();

  VARIANTES_CATEGORIAS.forEach(({ key }) => {
    const ids = new Set();
    listas.forEach((variantes) => {
      (variantes?.[key] || []).forEach((id) => ids.add(String(id)));
    });
    combinadas[key] = Array.from(ids);
  });

  return combinadas;
}

function normalizarLineasDetallePedido(pedido) {
  const raw = pedido?.lineas_detalle;

  if (Array.isArray(raw)) {
    return raw;
  }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

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

function variantesFormularioDesdeLineaDetalle(linea, listaProductos, catalogosVariantes) {
  if (!linea?.descripcion?.trim()) {
    return crearVariantesLineaVacias();
  }

  const parsed = parsearLineaPedidoDesdeTexto(
    linea.descripcion,
    listaProductos,
    catalogosVariantes
  );

  return parsed?.variantes || crearVariantesLineaVacias();
}

function lineasFormularioDesdePedido(pedido, listaProductos, catalogosVariantes) {
  const lineasDetalle = normalizarLineasDetallePedido(pedido);

  if (lineasDetalle.length > 0) {
    return lineasDetalle.map((linea, index) => ({
      id: index + 1,
      productoId: productoIdDesdeLineaDetalle(linea, listaProductos),
      cantidad: String(Math.max(1, parseInt(linea.cantidad, 10) || 1)),
      variantes: variantesFormularioDesdeLineaDetalle(
        linea,
        listaProductos,
        catalogosVariantes
      ),
    }));
  }

  return [crearLineaPedido(1)];
}

function parsearLineaPedidoDesdeTexto(parte, listaProductos, catalogosVariantes, id = 1) {
  let textoBase = parte;
  let variantes = crearVariantesLineaVacias();

  const matchVariantes = parte.match(/^(.+?)\s*\((.+)\)$/);
  if (matchVariantes) {
    textoBase = matchVariantes[1].trim();
    const detalles = matchVariantes[2].split('; ').map((d) => d.trim());
    const variantesParseadas = detalles.map((detalle) =>
      parsearDetalleVariantes(detalle, catalogosVariantes)
    );
    variantes = combinarVariantesLinea(...variantesParseadas);
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

function parsearLineasDesdeResumen(textoProducto, listaProductos, catalogosVariantes) {
  if (!textoProducto?.trim()) {
    return [crearLineaPedido(1)];
  }

  const partes = textoProducto.split(', ').map((s) => s.trim()).filter(Boolean);
  let id = 1;

  return partes.map((parte) => parsearLineaPedidoDesdeTexto(
    parte,
    listaProductos,
    catalogosVariantes,
    id++
  ));
}

function esPedidoWhatsapp(pedido) {
  return !pedido.tipo || pedido.tipo === 'whatsapp';
}

const MENSAJES_WHATSAPP = {
  'por-aceptar': (nombre) =>
    `Hola ${nombre}, recibimos tu pedido. En breve te confirmamos ✅`,
  'en-cocina': (nombre) => `Hola ${nombre}, tu pedido está en preparación 👨‍🍳`,
  enviado: (nombre) => `Hola ${nombre}, tu pedido ya va en camino 🛵`,
  entregado: (nombre) => `Hola ${nombre}, tu pedido fue entregado. ¡Gracias! 🙏`,
  'listo-para-recoger': (nombre) =>
    `Hola ${nombre}, tu pedido está listo para recoger en sucursal 🏪`,
};

function obtenerMensajeWhatsAppPedido(pedido) {
  const nombre = pedido.cliente?.trim() || 'cliente';
  const status = pedido.status || 'por-aceptar';
  const plantilla = MENSAJES_WHATSAPP[status] || MENSAJES_WHATSAPP['por-aceptar'];
  return plantilla(nombre);
}

function normalizarTelefonoWhatsApp(telefono) {
  if (!telefono) return '';
  const digits = String(telefono).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `52${digits}`;
  return digits;
}

function construirUrlWhatsApp(telefono, mensaje) {
  const numero = normalizarTelefonoWhatsApp(telefono);
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}

function formatearClaveFecha(fecha) {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, '0');
  const day = String(fecha.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function obtenerFechaHoy() {
  return formatearClaveFecha(new Date());
}

function formatearFechaCortaFiltro(claveFecha) {
  const [year, month, day] = claveFecha.split('-').map(Number);
  const fecha = new Date(year, month - 1, day);
  const texto = fecha.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
  });

  return texto.replace(/\.$/, '');
}

function formatearFechaCompleta(fecha = new Date()) {
  const diaSemana = fecha.toLocaleDateString('es-MX', { weekday: 'long' });
  const dia = fecha.getDate();
  const mes = fecha.toLocaleDateString('es-MX', { month: 'long' });
  const anio = fecha.getFullYear();
  const diaCapitalizado = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
  const hora = fecha.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return `${diaCapitalizado} ${dia} de ${mes} de ${anio} • ${hora}`;
}

function esMismoDia(fechaA, fechaB) {
  return formatearClaveFecha(fechaA) === formatearClaveFecha(fechaB);
}

function formatearHora(fecha) {
  return fecha.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatearHoraPedido(createdAt) {
  if (!createdAt) return '';

  const fecha = new Date(createdAt);
  const ahora = new Date();
  const ayer = new Date(ahora);
  ayer.setDate(ayer.getDate() - 1);
  const hora = formatearHora(fecha);

  if (esMismoDia(fecha, ahora)) return `hoy ${hora}`;
  if (esMismoDia(fecha, ayer)) return `ayer ${hora}`;

  const fechaCorta = fecha.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
  });

  return `${fechaCorta} ${hora}`;
}

function formatearEtiquetaGrupo(fecha) {
  const ahora = new Date();
  const ayer = new Date(ahora);
  ayer.setDate(ayer.getDate() - 1);

  if (esMismoDia(fecha, ahora)) return 'Hoy';
  if (esMismoDia(fecha, ayer)) return 'Ayer';

  return fecha.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function agruparPedidosPorFecha(listaPedidos) {
  const grupos = new Map();

  listaPedidos.forEach((pedido) => {
    const fecha = pedido.created_at ? new Date(pedido.created_at) : new Date(0);
    const clave = formatearClaveFecha(fecha);

    if (!grupos.has(clave)) {
      grupos.set(clave, { clave, fecha, pedidos: [] });
    }

    grupos.get(clave).pedidos.push(pedido);
  });

  return Array.from(grupos.values())
    .sort((a, b) => b.fecha - a.fecha)
    .map((grupo) => ({
      ...grupo,
      etiqueta: formatearEtiquetaGrupo(grupo.fecha),
      pedidos: grupo.pedidos.sort(
        (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
      ),
    }));
}

function pedidosPorTipoEntrega(pedidos, tipoEntrega) {
  return pedidos.filter(
    (pedido) => normalizarTipoEntrega(pedido.tipo_entrega) === tipoEntrega
  );
}

function aplicarFiltroStatus(pedidos, filtro) {
  if (filtro === 'todos') return pedidos;
  return pedidos.filter((pedido) => pedido.status === filtro);
}

function totalVentasPedidos(pedidos) {
  return pedidos.reduce((suma, pedido) => suma + Number(pedido.total), 0);
}

function contadoresPorFlujo(pedidos, flujo) {
  return flujo.map((status) => ({
    status,
    label: STATUS_LABELS[status],
    count: pedidos.filter((pedido) => pedido.status === status).length,
  }));
}

function Dashboard() {
  const [seccion, setSeccion] = useState('pedidos');
  const [modo, setModo] = useState('whatsapp');
  const [filtroDomicilio, setFiltroDomicilio] = useState('todos');
  const [filtroSucursal, setFiltroSucursal] = useState('todos');
  const [filtroFecha, setFiltroFecha] = useState(obtenerFechaHoy);
  const { pedidos, setPedidos } = usePedidosRealtime({
    channelName: 'dashboard-pedidos',
  });
  const { productos, setProductos } = useProductosRealtime({
    channelName: 'dashboard-productos',
  });
  const [catalogosVariantes, setCatalogosVariantes] = useState(
    crearCatalogosVariantesVacios
  );
  const [catalogoTab, setCatalogoTab] = useState('productos');
  const productosOrdenados = useMemo(
    () => ordenarProductos(productos),
    [productos]
  );
  const catalogosVariantesOrdenados = useMemo(
    () =>
      VARIANTES_CATEGORIAS.reduce((acc, { key }) => {
        acc[key] = ordenarPorNombre(catalogosVariantes[key] || []);
        return acc;
      }, {}),
    [catalogosVariantes]
  );
  const [resumenVenta, setResumenVenta] = useState(null);
  const nextLineaId = useRef(2);
  const nextEditLineaId = useRef(2);
  const [form, setForm] = useState({
    cliente: '',
    telefono: '',
    tipoEntrega: TIPOS_ENTREGA.DOMICILIO,
    direccion: '',
    lineas: [crearLineaPedido(1)],
    status: 'por-aceptar',
  });
  const [productoForm, setProductoForm] = useState({
    nombre: '',
    precio: '',
    categoria: '',
    cocina: COCINAS.COCINA1,
    variantesActivas: crearVariantesActivasFormVacias(),
  });
  const [varianteForm, setVarianteForm] = useState({ nombre: '', precio: '0' });
  const [editandoVariante, setEditandoVariante] = useState(null);
  const [editandoProductoId, setEditandoProductoId] = useState(null);
  const [editandoPedidoId, setEditandoPedidoId] = useState(null);
  const [pedidoEditForm, setPedidoEditForm] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [guardandoProducto, setGuardandoProducto] = useState(false);
  const [guardandoVariante, setGuardandoVariante] = useState(false);
  const [guardandoEdicionPedido, setGuardandoEdicionPedido] = useState(false);
  const [pagoRecibido, setPagoRecibido] = useState('');
  const [fechaActual, setFechaActual] = useState(() => Date.now());

  const cargarCatalogosVariantes = async () => {
    const resultados = await Promise.all(
      VARIANTES_CATEGORIAS.map(async ({ key, tabla }) => {
        const { data, error } = await supabase
          .from(tabla)
          .select('*')
          .order('id', { ascending: true });

        return { key, data: !error && data ? data : [] };
      })
    );

    setCatalogosVariantes((prev) => {
      const next = { ...prev };
      resultados.forEach(({ key, data }) => {
        next[key] = data;
      });
      return next;
    });
  };

  const cargarCatalogos = async () => {
    await cargarCatalogosVariantes();
  };

  const resetFormulariosCatalogo = () => {
    setEditandoProductoId(null);
    setEditandoVariante(null);
    setProductoForm({
      nombre: '',
      precio: '',
      categoria: '',
      cocina: COCINAS.COCINA1,
      variantesActivas: crearVariantesActivasFormVacias(),
    });
    setVarianteForm({ nombre: '', precio: '0' });
  };

  useEffect(() => {
    cargarCatalogos();
  }, []);

  useEffect(() => {
    if (seccion === 'pedidos' || seccion === 'catalogo') {
      cargarCatalogos();
    }
  }, [seccion]);

  useEffect(() => {
    if (seccion !== 'catalogo') {
      resetFormulariosCatalogo();
      setCatalogoTab('productos');
    }
  }, [seccion]);

  useEffect(() => {
    if (!resumenVenta || modo !== 'presencial') return;

    const timer = setTimeout(() => {
      setResumenVenta(null);
      nextLineaId.current = 2;
      setPagoRecibido('');
      setForm({
        cliente: CLIENTE_PUBLICO,
        telefono: '',
        tipoEntrega: TIPOS_ENTREGA.DOMICILIO,
        direccion: '',
        lineas: [crearLineaPedido(1)],
        status: 'por-aceptar',
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, [resumenVenta, modo]);

  useEffect(() => {
    const actualizarReloj = () => {
      setFechaActual(Date.now());
    };

    actualizarReloj();

    const intervalId = setInterval(actualizarReloj, 60000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      if (name === 'tipoEntrega') {
        const flujo = obtenerFlujoStatus(value);
        const status = flujo.includes(prev.status) ? prev.status : 'por-aceptar';
        const esDomicilio = value === TIPOS_ENTREGA.DOMICILIO;
        return {
          ...prev,
          tipoEntrega: value,
          status,
          direccion: esDomicilio ? prev.direccion : '',
        };
      }
      return { ...prev, [name]: value };
    });
  };

  const actualizarLinea = (lineaId, campo, valor) => {
    setForm((prev) => ({
      ...prev,
      lineas: prev.lineas.map((linea) => {
        if (linea.id !== lineaId) return linea;
        if (campo === 'productoId') {
          return {
            ...linea,
            productoId: String(valor),
            variantes: crearVariantesLineaVacias(),
          };
        }
        return { ...linea, [campo]: valor };
      }),
    }));
  };

  const cambiarVarianteLinea = (lineaId, categoria, itemId) => {
    setForm((prev) => ({
      ...prev,
      lineas: prev.lineas.map((linea) =>
        linea.id === lineaId
          ? {
              ...linea,
              variantes: {
                ...linea.variantes,
                [categoria]: toggleIdEnLinea(linea.variantes?.[categoria], itemId),
              },
            }
          : linea
      ),
    }));
  };

  const agregarLinea = () => {
    setForm((prev) => ({
      ...prev,
      lineas: [...prev.lineas, crearLineaPedido(nextLineaId.current++)],
    }));
  };

  const eliminarLinea = (lineaId) => {
    setForm((prev) => {
      if (prev.lineas.length <= 1) return prev;
      return {
        ...prev,
        lineas: prev.lineas.filter((linea) => linea.id !== lineaId),
      };
    });
  };

  const resetFormPedido = (modoActual = modo) => {
    nextLineaId.current = 2;
    setPagoRecibido('');
    setForm({
      cliente: modoActual === 'presencial' ? CLIENTE_PUBLICO : '',
      telefono: '',
      tipoEntrega: TIPOS_ENTREGA.DOMICILIO,
      direccion: '',
      lineas: [crearLineaPedido(1)],
      status: 'por-aceptar',
    });
  };

  const cambiarModo = (nuevoModo) => {
    setModo(nuevoModo);
    setFiltroDomicilio('todos');
    setFiltroSucursal('todos');
    setFiltroFecha(obtenerFechaHoy());
    setResumenVenta(null);
    setEditandoPedidoId(null);
    setPedidoEditForm(null);
    resetFormPedido(nuevoModo);
  };

  const totalPedido = calcularTotalLineas(form.lineas, productos, catalogosVariantes);
  const montoPago = parseFloat(pagoRecibido);
  const pagoValido = pagoRecibido !== '' && !Number.isNaN(montoPago);
  const cambio = pagoValido ? montoPago - totalPedido : null;
  const pagoInsuficiente = pagoValido && cambio < 0;

  const handleProductoFormChange = (e) => {
    const { name, value } = e.target;
    setProductoForm((prev) => ({ ...prev, [name]: value }));
  };

  const toggleCategoriaVarianteProducto = (key) => {
    setProductoForm((prev) => {
      const actual = prev.variantesActivas[key] || { categoria: false, items: [] };
      const categoria = !actual.categoria;
      return {
        ...prev,
        variantesActivas: {
          ...prev.variantesActivas,
          [key]: { categoria, items: categoria ? actual.items : [] },
        },
      };
    });
  };

  const toggleItemVarianteProducto = (key, itemId) => {
    setProductoForm((prev) => {
      const actual = prev.variantesActivas[key] || { categoria: false, items: [] };
      const items = toggleIdEnLinea(actual.items, itemId);
      return {
        ...prev,
        variantesActivas: {
          ...prev.variantesActivas,
          [key]: {
            categoria: items.length > 0 || actual.categoria,
            items,
          },
        },
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGuardando(true);

    const detallePedido = calcularDetalleLineasPedido(
      form.lineas,
      productos,
      catalogosVariantes
    );

    if (detallePedido.lineas.length === 0 || detallePedido.total <= 0) {
      setGuardando(false);
      return;
    }

    const resumen = resumenProductos(form.lineas, productos, catalogosVariantes);
    const esPresencial = modo === 'presencial';
    const pedidoPreview = {
      lineas_detalle: detallePedido.lineas,
      producto: resumen,
    };
    const statusPresencial = esPresencial
      ? determinarStatusInicialPresencial(pedidoPreview)
      : null;

    const payload = {
      cliente: esPresencial ? CLIENTE_PUBLICO : form.cliente.trim(),
      telefono: esPresencial ? null : form.telefono.trim() || null,
      producto: resumen,
      lineas_detalle: Array.isArray(detallePedido.lineas) ? detallePedido.lineas : [],
      total: detallePedido.total,
      status: esPresencial ? statusPresencial.status : form.status,
      tipo: esPresencial ? 'presencial' : 'whatsapp',
      tipo_entrega: esPresencial
        ? TIPOS_ENTREGA.DOMICILIO
        : normalizarTipoEntrega(form.tipoEntrega),
      direccion:
        esPresencial || form.tipoEntrega !== TIPOS_ENTREGA.DOMICILIO
          ? null
          : form.direccion.trim() || null,
      ...(esPresencial
        ? {
            status_cocina1: statusPresencial.status_cocina1,
            status_cocina2: statusPresencial.status_cocina2,
          }
        : {}),
    };

    const { data, error } = await supabase
      .from('pedidos')
      .insert(payload)
      .select()
      .single();

    setGuardando(false);

    if (!error && data) {
      setPedidos((prev) =>
        [...prev, data].sort(
          (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
        )
      );

      if (esPresencial) {
        setResumenVenta({
          producto: resumen,
          total: detallePedido.total,
        });
      } else {
        resetFormPedido();
      }
    }
  };

  const resetProductoForm = () => {
    setEditandoProductoId(null);
    setProductoForm({
      nombre: '',
      precio: '',
      categoria: '',
      cocina: COCINAS.COCINA1,
      variantesActivas: crearVariantesActivasFormVacias(),
    });
  };

  const resetVarianteForm = () => {
    setEditandoVariante(null);
    setVarianteForm({ nombre: '', precio: '0' });
  };

  const iniciarEdicionProducto = (producto) => {
    setEditandoProductoId(producto.id);
    setProductoForm({
      nombre: producto.nombre,
      precio: String(producto.precio),
      categoria: producto.categoria || '',
      cocina: normalizarCocinaProducto(producto.cocina),
      variantesActivas: variantesActivasFormDesdeProducto(producto, catalogosVariantes),
    });
  };

  const iniciarEdicionVariante = (categoria, item) => {
    setEditandoVariante({ categoria, id: item.id });
    setVarianteForm({
      nombre: item.nombre,
      precio: String(item.precio),
    });
  };

  const handleVarianteFormChange = (e) => {
    const { name, value } = e.target;
    setVarianteForm((prev) => ({ ...prev, [name]: value }));
  };

  const quitarVarianteDeLineas = (categoria, id, lineas) =>
    lineas.map((linea) => ({
      ...linea,
      variantes: {
        ...linea.variantes,
        [categoria]: (linea.variantes?.[categoria] || []).filter(
          (varianteId) => String(varianteId) !== String(id)
        ),
      },
    }));

  const handleProductoSubmit = async (e) => {
    e.preventDefault();
    setGuardandoProducto(true);

    const payload = {
      nombre: productoForm.nombre.trim(),
      precio: parseFloat(productoForm.precio),
      categoria: productoForm.categoria.trim() || null,
      cocina: normalizarCocinaProducto(productoForm.cocina),
      variantes_activas: variantesActivasJsonDesdeForm(productoForm.variantesActivas),
    };

    if (editandoProductoId) {
      const { data, error } = await supabase
        .from('productos')
        .update(payload)
        .eq('id', editandoProductoId)
        .select()
        .single();

      setGuardandoProducto(false);

      if (!error && data) {
        setProductos((prev) =>
          prev
            .map((p) => (String(p.id) === String(data.id) ? data : p))
            .sort((a, b) => a.id - b.id)
        );
        resetProductoForm();
      }
      return;
    }

    const { data, error } = await supabase
      .from('productos')
      .insert(payload)
      .select()
      .single();

    setGuardandoProducto(false);

    if (!error && data) {
      setProductos((prev) =>
        [...prev, data].sort((a, b) => a.id - b.id)
      );
      resetProductoForm();
    }
  };

  const handleVarianteSubmit = async (e, categoria) => {
    e.preventDefault();
    const config = obtenerConfigVariante(categoria);
    if (!config) return;

    setGuardandoVariante(true);

    const payload = {
      nombre: varianteForm.nombre.trim(),
      precio: parseFloat(varianteForm.precio) || 0,
    };

    const editandoId =
      editandoVariante?.categoria === categoria ? editandoVariante.id : null;

    if (editandoId) {
      const { data, error } = await supabase
        .from(config.tabla)
        .update(payload)
        .eq('id', editandoId)
        .select()
        .single();

      setGuardandoVariante(false);

      if (!error && data) {
        setCatalogosVariantes((prev) => ({
          ...prev,
          [categoria]: prev[categoria]
            .map((item) => (String(item.id) === String(data.id) ? data : item))
            .sort((a, b) => a.id - b.id),
        }));
        resetVarianteForm();
      }
      return;
    }

    const { data, error } = await supabase
      .from(config.tabla)
      .insert(payload)
      .select()
      .single();

    setGuardandoVariante(false);

    if (!error && data) {
      setCatalogosVariantes((prev) => ({
        ...prev,
        [categoria]: [...prev[categoria], data].sort((a, b) => a.id - b.id),
      }));
      resetVarianteForm();
    }
  };

  const eliminarProducto = async (id) => {
    const { error } = await supabase.from('productos').delete().eq('id', id);

    if (!error) {
      setProductos((prev) => prev.filter((p) => p.id !== id));
      if (editandoProductoId === id) {
        resetProductoForm();
      }
      setForm((prev) => ({
        ...prev,
        lineas: prev.lineas.map((linea) =>
          String(linea.productoId) === String(id)
            ? { ...linea, productoId: '' }
            : linea
        ),
      }));
    }
  };

  const eliminarVariante = async (categoria, id) => {
    const config = obtenerConfigVariante(categoria);
    if (!config) return;

    const { error } = await supabase.from(config.tabla).delete().eq('id', id);

    if (!error) {
      setCatalogosVariantes((prev) => ({
        ...prev,
        [categoria]: prev[categoria].filter((item) => item.id !== id),
      }));

      if (editandoVariante?.categoria === categoria && editandoVariante.id === id) {
        resetVarianteForm();
      }

      setForm((prev) => ({
        ...prev,
        lineas: quitarVarianteDeLineas(categoria, id, prev.lineas),
      }));

      setPedidoEditForm((prev) =>
        prev
          ? {
              ...prev,
              lineas: quitarVarianteDeLineas(categoria, id, prev.lineas),
            }
          : prev
      );
    }
  };

  const pedidosModoActual = pedidos.filter((pedido) =>
    modo === 'presencial'
      ? pedido.tipo === 'presencial'
      : esPedidoWhatsapp(pedido)
  );

  const hoyClave = obtenerFechaHoy();
  const pedidosHoyModo = pedidosModoActual.filter(
    (pedido) =>
      pedido.created_at &&
      formatearClaveFecha(new Date(pedido.created_at)) === hoyClave
  );

  const pedidosHoyTodos = pedidos.filter(
    (pedido) =>
      pedido.created_at &&
      formatearClaveFecha(new Date(pedido.created_at)) === hoyClave
  );
  const pedidosHoyCaja = pedidosHoyTodos.filter((pedido) => pedido.tipo === 'presencial');
  const pedidosHoyWhatsApp = pedidosHoyTodos.filter((pedido) => esPedidoWhatsapp(pedido));
  const pedidosHoyDomicilio = pedidosPorTipoEntrega(
    pedidosHoyWhatsApp,
    TIPOS_ENTREGA.DOMICILIO
  );
  const pedidosHoySucursal = pedidosPorTipoEntrega(
    pedidosHoyWhatsApp,
    TIPOS_ENTREGA.SUCURSAL
  );

  const totalVentasHoyCaja = totalVentasPedidos(pedidosHoyCaja);
  const totalVentasHoyWhatsApp = totalVentasPedidos(pedidosHoyWhatsApp);
  const totalVentasHoyTotal = totalVentasHoyCaja + totalVentasHoyWhatsApp;
  const totalVentasHoyDomicilio = totalVentasPedidos(pedidosHoyDomicilio);
  const totalVentasHoySucursal = totalVentasPedidos(pedidosHoySucursal);

  const pedidosPorFecha = pedidosModoActual.filter(
    (pedido) =>
      pedido.created_at &&
      formatearClaveFecha(new Date(pedido.created_at)) === filtroFecha
  );

  const pedidosPorFechaDomicilio = pedidosPorTipoEntrega(
    pedidosPorFecha,
    TIPOS_ENTREGA.DOMICILIO
  );
  const pedidosPorFechaSucursal = pedidosPorTipoEntrega(
    pedidosPorFecha,
    TIPOS_ENTREGA.SUCURSAL
  );

  const pedidosFiltradosDomicilio = aplicarFiltroStatus(
    pedidosPorFechaDomicilio,
    filtroDomicilio
  );
  const pedidosFiltradosSucursal = aplicarFiltroStatus(
    pedidosPorFechaSucursal,
    filtroSucursal
  );

  const pedidosFiltradosPresencial = pedidosPorFecha;
  const pedidosAgrupadosPresencial = agruparPedidosPorFecha(pedidosFiltradosPresencial);
  const pedidosAgrupadosDomicilio = agruparPedidosPorFecha(pedidosFiltradosDomicilio);
  const pedidosAgrupadosSucursal = agruparPedidosPorFecha(pedidosFiltradosSucursal);

  const totalVentasFechaFiltro = pedidosPorFecha.reduce(
    (suma, pedido) => suma + Number(pedido.total),
    0
  );

  const esFiltroHoy = filtroFecha === hoyClave;
  const totalVentasFechaDomicilio = totalVentasPedidos(pedidosPorFechaDomicilio);
  const totalVentasFechaSucursal = totalVentasPedidos(pedidosPorFechaSucursal);
  const contadoresDomicilioFecha = contadoresPorFlujo(
    pedidosPorFechaDomicilio,
    STATUS_FLOW_DOMICILIO
  );
  const contadoresSucursalFecha = contadoresPorFlujo(
    pedidosPorFechaSucursal,
    STATUS_FLOW_SUCURSAL
  );

  const esModoPresencial = modo === 'presencial';

  const avanzarPedido = async (id) => {
    const pedido = pedidos.find((p) => p.id === id);
    if (!pedido) return;

    const pedidoConCocina = enriquecerLineasDetalleCocina(pedido, productos);
    const payload = construirPayloadAvancePedido(pedidoConCocina);
    if (!payload) return;

    if (pedidoConCocina.lineas_detalle !== pedido.lineas_detalle) {
      payload.lineas_detalle = pedidoConCocina.lineas_detalle;
    }

    const { error } = await supabase
      .from('pedidos')
      .update(payload)
      .eq('id', id);

    if (!error) {
      setPedidos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...payload } : p))
      );
    }
  };

  const retrocederPedido = async (id) => {
    const pedido = pedidos.find((p) => p.id === id);
    if (!pedido || !puedeRetrocederPedido(pedido.status, pedido.tipo_entrega)) return;

    const pedidoConCocina = enriquecerLineasDetalleCocina(pedido, productos);
    const payload = construirPayloadRetrocesoPedido(pedidoConCocina);
    if (!payload) return;

    if (pedidoConCocina.lineas_detalle !== pedido.lineas_detalle) {
      payload.lineas_detalle = pedidoConCocina.lineas_detalle;
    }

    const { error } = await supabase
      .from('pedidos')
      .update(payload)
      .eq('id', id);

    if (!error) {
      setPedidos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...payload } : p))
      );
    }
  };

  const eliminarPedido = async (id) => {
    const { error } = await supabase.from('pedidos').delete().eq('id', id);

    if (!error) {
      setPedidos((prev) => prev.filter((p) => p.id !== id));
      if (editandoPedidoId === id) {
        cancelarEdicionPedido();
      }
    }
  };

  const cancelarEdicionPedido = () => {
    setEditandoPedidoId(null);
    setPedidoEditForm(null);
  };

  const iniciarEdicionPedido = async (pedido) => {
    let pedidoFuente = pedido;

    const { data, error } = await supabase
      .from('pedidos')
      .select('*')
      .eq('id', pedido.id)
      .single();

    if (!error && data) {
      pedidoFuente = data;
      setPedidos((prev) =>
        prev.map((item) => (item.id === data.id ? { ...item, ...data } : item))
      );
    }

    const lineas = lineasFormularioDesdePedido(
      pedidoFuente,
      productos,
      catalogosVariantes
    );
    nextEditLineaId.current = lineas.length + 1;
    setEditandoPedidoId(pedido.id);
    setPedidoEditForm({
      cliente: pedidoFuente.cliente,
      telefono: pedidoFuente.telefono || '',
      tipoEntrega: normalizarTipoEntrega(pedidoFuente.tipo_entrega),
      direccion: pedidoFuente.direccion || '',
      status: pedidoFuente.status || 'por-aceptar',
      lineas,
    });
  };

  const handlePedidoEditChange = (e) => {
    const { name, value } = e.target;
    setPedidoEditForm((prev) => {
      if (!prev) return prev;
      if (name === 'tipoEntrega') {
        const flujo = obtenerFlujoStatus(value);
        const status = flujo.includes(prev.status) ? prev.status : 'por-aceptar';
        const esDomicilio = value === TIPOS_ENTREGA.DOMICILIO;
        return {
          ...prev,
          tipoEntrega: value,
          status,
          direccion: esDomicilio ? prev.direccion : '',
        };
      }
      return { ...prev, [name]: value };
    });
  };

  const actualizarLineaEdicion = (lineaId, campo, valor) => {
    setPedidoEditForm((prev) => ({
      ...prev,
      lineas: prev.lineas.map((linea) => {
        if (linea.id !== lineaId) return linea;
        if (campo === 'productoId') {
          return {
            ...linea,
            productoId: String(valor),
            variantes: crearVariantesLineaVacias(),
          };
        }
        return { ...linea, [campo]: valor };
      }),
    }));
  };

  const cambiarVarianteLineaEdicion = (lineaId, categoria, itemId) => {
    setPedidoEditForm((prev) => ({
      ...prev,
      lineas: prev.lineas.map((linea) =>
        linea.id === lineaId
          ? {
              ...linea,
              variantes: {
                ...linea.variantes,
                [categoria]: toggleIdEnLinea(linea.variantes?.[categoria], itemId),
              },
            }
          : linea
      ),
    }));
  };

  const agregarLineaEdicion = () => {
    setPedidoEditForm((prev) => ({
      ...prev,
      lineas: [...prev.lineas, crearLineaPedido(nextEditLineaId.current++)],
    }));
  };

  const eliminarLineaEdicion = (lineaId) => {
    setPedidoEditForm((prev) => {
      if (prev.lineas.length <= 1) return prev;
      return {
        ...prev,
        lineas: prev.lineas.filter((linea) => linea.id !== lineaId),
      };
    });
  };

  const guardarEdicionPedido = async (pedido) => {
    if (!pedidoEditForm) return;

    const detallePedido = calcularDetalleLineasPedido(
      pedidoEditForm.lineas,
      productos,
      catalogosVariantes
    );

    if (detallePedido.lineas.length === 0 || detallePedido.total <= 0) return;

    const resumen = resumenProductos(
      pedidoEditForm.lineas,
      productos,
      catalogosVariantes
    );
    const esPresencial = pedido.tipo === 'presencial';

    setGuardandoEdicionPedido(true);

    const pedidoConDetalle = {
      ...pedido,
      producto: resumen,
      lineas_detalle: Array.isArray(detallePedido.lineas) ? detallePedido.lineas : [],
      total: detallePedido.total,
    };

    let statusEdicion = pedidoEditForm.status;
    let statusCocinas = {};

    if (!esPresencial) {
      if (statusEdicion === 'en-cocina') {
        if (pedido.status === 'en-cocina') {
          const merge = mergeStatusCocinasEnEdicion(pedido, pedidoConDetalle);
          if (!merge.requiereAlgunaCocina) {
            statusEdicion = obtenerStatusGlobalTrasCocinas(pedidoEditForm.tipoEntrega);
            statusCocinas = { status_cocina1: null, status_cocina2: null };
          } else {
            statusCocinas = {
              status_cocina1: merge.status_cocina1,
              status_cocina2: merge.status_cocina2,
            };
            const pedidoProyectado = {
              ...pedidoConDetalle,
              status: 'en-cocina',
              ...statusCocinas,
            };
            if (todasCocinasRequeridasListas(pedidoProyectado)) {
              statusEdicion = obtenerStatusGlobalTrasCocinas(pedidoEditForm.tipoEntrega);
            }
          }
        } else {
          const cocinas = prepararStatusCocinasAlEntrar(pedidoConDetalle);
          if (!cocinas.requiereAlgunaCocina) {
            statusEdicion = obtenerStatusGlobalTrasCocinas(pedidoEditForm.tipoEntrega);
            statusCocinas = { status_cocina1: null, status_cocina2: null };
          } else {
            statusCocinas = {
              status_cocina1: cocinas.status_cocina1,
              status_cocina2: cocinas.status_cocina2,
            };
          }
        }
      } else {
        statusCocinas = payloadStatusCocinasParaStatusGlobal(
          pedidoConDetalle,
          statusEdicion
        );
      }
    }

    const payload = {
      producto: resumen,
      lineas_detalle: Array.isArray(detallePedido.lineas) ? detallePedido.lineas : [],
      total: detallePedido.total,
      ...(esPresencial
        ? {
            cliente: CLIENTE_PUBLICO,
            status: 'entregado',
            tipo_entrega: TIPOS_ENTREGA.DOMICILIO,
          }
        : {
            cliente: pedidoEditForm.cliente.trim(),
            telefono: pedidoEditForm.telefono?.trim() || null,
            tipo_entrega: normalizarTipoEntrega(pedidoEditForm.tipoEntrega),
            direccion:
              pedidoEditForm.tipoEntrega === TIPOS_ENTREGA.DOMICILIO
                ? pedidoEditForm.direccion?.trim() || null
                : null,
            status: statusEdicion,
            ...statusCocinas,
          }),
    };

    const { data, error } = await supabase
      .from('pedidos')
      .update(payload)
      .eq('id', pedido.id)
      .select()
      .single();

    setGuardandoEdicionPedido(false);

    if (!error && data) {
      setPedidos((prev) => prev.map((p) => (p.id === data.id ? data : p)));
      cancelarEdicionPedido();
    }
  };

  const renderPedidoEnEdicion = (pedido, totalEdicion) => {
    if (!pedidoEditForm || editandoPedidoId !== pedido.id) return null;

    const esPresencialPedido = pedido.tipo === 'presencial';

    return (
                            <article
                              key={pedido.id}
                              className="pedido-tarjeta pedido-tarjeta-editando"
                            >
                              <div className="pedido-tarjeta-cabecera">
                                <h2 className="pedido-cliente">Editar pedido</h2>
                                <time
                                  className="pedido-hora"
                                  dateTime={pedido.created_at}
                                >
                                  {formatearHoraPedido(pedido.created_at)}
                                </time>
                              </div>

                              <div className="pedido-edit-form">
                                <div className="formulario-campo">
                                  <label htmlFor={`edit-cliente-${pedido.id}`}>
                                    Cliente
                                  </label>
                                  <input
                                    id={`edit-cliente-${pedido.id}`}
                                    name="cliente"
                                    type="text"
                                    value={
                                      esPresencialPedido
                                        ? CLIENTE_PUBLICO
                                        : pedidoEditForm.cliente
                                    }
                                    onChange={handlePedidoEditChange}
                                    readOnly={esPresencialPedido}
                                    required
                                  />
                                </div>

                                {!esPresencialPedido && (
                                  <div className="formulario-campo">
                                    <label htmlFor={`edit-telefono-${pedido.id}`}>
                                      Teléfono
                                    </label>
                                    <input
                                      id={`edit-telefono-${pedido.id}`}
                                      name="telefono"
                                      type="tel"
                                      inputMode="tel"
                                      autoComplete="tel"
                                      placeholder="10 dígitos o con lada"
                                      value={pedidoEditForm.telefono}
                                      onChange={handlePedidoEditChange}
                                    />
                                  </div>
                                )}

                                {!esPresencialPedido && (
                                  <div className="formulario-campo">
                                    <label htmlFor={`edit-tipo-entrega-${pedido.id}`}>
                                      Tipo de entrega
                                    </label>
                                    <select
                                      id={`edit-tipo-entrega-${pedido.id}`}
                                      name="tipoEntrega"
                                      value={pedidoEditForm.tipoEntrega}
                                      onChange={handlePedidoEditChange}
                                    >
                                      {TIPOS_ENTREGA_OPCIONES.map((opcion) => (
                                        <option key={opcion.value} value={opcion.value}>
                                          {opcion.icono} {opcion.label}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}

                                {!esPresencialPedido &&
                                  pedidoEditForm.tipoEntrega === TIPOS_ENTREGA.DOMICILIO && (
                                    <div className="formulario-campo formulario-campo-direccion">
                                      <label htmlFor={`edit-direccion-${pedido.id}`}>
                                        Dirección de entrega
                                      </label>
                                      <input
                                        id={`edit-direccion-${pedido.id}`}
                                        name="direccion"
                                        type="text"
                                        placeholder="Calle, número, colonia, referencias..."
                                        value={pedidoEditForm.direccion}
                                        onChange={handlePedidoEditChange}
                                      />
                                    </div>
                                  )}

                                {!esPresencialPedido && (
                                  <div className="formulario-campo">
                                    <label htmlFor={`edit-status-${pedido.id}`}>
                                      Status
                                    </label>
                                    <select
                                      id={`edit-status-${pedido.id}`}
                                      name="status"
                                      value={pedidoEditForm.status}
                                      onChange={handlePedidoEditChange}
                                    >
                                      {obtenerFlujoStatus(pedidoEditForm.tipoEntrega).map(
                                        (status) => (
                                          <option key={status} value={status}>
                                            {STATUS_LABELS[status]}
                                          </option>
                                        )
                                      )}
                                    </select>
                                  </div>
                                )}

                                <div className="pedido-edit-lineas">
                                  {pedidoEditForm.lineas.map((linea, indice) => {
                                    const productoSeleccionado = buscarProductoPorId(
                                      productos,
                                      linea.productoId
                                    );
                                    const subtotal = calcularSubtotal(
                      linea,
                      productos,
                      catalogosVariantes
                    );

                                    return (
                                      <div
                                        key={linea.id}
                                        className="pedido-edit-linea-contenedor"
                                      >
                                        <div className="pedido-edit-linea">
                                          <div className="formulario-campo">
                                            <label
                                              htmlFor={`edit-producto-${pedido.id}-${linea.id}`}
                                            >
                                              Producto #{indice + 1}
                                            </label>
                                            <select
                                              id={`edit-producto-${pedido.id}-${linea.id}`}
                                              value={String(linea.productoId)}
                                              onChange={(e) =>
                                                actualizarLineaEdicion(
                                                  linea.id,
                                                  'productoId',
                                                  e.target.value
                                                )
                                              }
                                              required
                                            >
                                              <option value="">
                                                Seleccionar producto...
                                              </option>
                                              {productosOrdenados.map((producto) => (
                                                <option
                                                  key={producto.id}
                                                  value={String(producto.id)}
                                                >
                                                  {producto.nombre}
                                                  {producto.categoria
                                                    ? ` (${producto.categoria})`
                                                    : ''}
                                                </option>
                                              ))}
                                            </select>
                                          </div>
                                          <div className="formulario-campo">
                                            <label
                                              htmlFor={`edit-cantidad-${pedido.id}-${linea.id}`}
                                            >
                                              Cantidad
                                            </label>
                                            <input
                                              id={`edit-cantidad-${pedido.id}-${linea.id}`}
                                              type="number"
                                              min="1"
                                              step="1"
                                              value={linea.cantidad}
                                              onChange={(e) =>
                                                actualizarLineaEdicion(
                                                  linea.id,
                                                  'cantidad',
                                                  e.target.value
                                                )
                                              }
                                              required
                                            />
                                          </div>
                                          <div className="formulario-campo">
                                            <label>Subtotal</label>
                                            <input
                                              type="text"
                                              value={
                                                subtotal > 0
                                                  ? `$${subtotal.toFixed(2)}`
                                                  : ''
                                              }
                                              readOnly
                                            />
                                          </div>
                                          <button
                                            type="button"
                                            className="eliminar-linea-btn"
                                            onClick={() =>
                                              eliminarLineaEdicion(linea.id)
                                            }
                                            disabled={
                                              pedidoEditForm.lineas.length <= 1
                                            }
                                            aria-label={`Eliminar producto ${indice + 1}`}
                                          >
                                            ✕
                                          </button>
                                        </div>
                                        {esPedidoWhatsapp(pedido) && productoSeleccionado && (
                                          <VariantesPedido
                                            key={`variantes-edit-${linea.id}-${linea.productoId}`}
                                            linea={linea}
                                            producto={productoSeleccionado}
                                            catalogosVariantes={catalogosVariantes}
                                            onToggleVariante={cambiarVarianteLineaEdicion}
                                          />
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>

                                <button
                                  type="button"
                                  className="agregar-linea-btn"
                                  onClick={agregarLineaEdicion}
                                  disabled={productos.length === 0}
                                >
                                  + Agregar producto
                                </button>

                                <div className="pedido-edit-total">
                                  <span className="pedido-total-label">Total</span>
                                  <span className="pedido-total-valor">
                                    ${totalEdicion.toFixed(2)}
                                  </span>
                                </div>

                                <div className="tarjeta-acciones pedido-edit-acciones">
                                  <button
                                    type="button"
                                    className="guardar-btn"
                                    disabled={
                                      guardandoEdicionPedido ||
                                      totalEdicion <= 0
                                    }
                                    onClick={() => guardarEdicionPedido(pedido)}
                                  >
                                    {guardandoEdicionPedido
                                      ? 'Guardando...'
                                      : 'Guardar cambios'}
                                  </button>
                                  <button
                                    type="button"
                                    className="cancelar-btn"
                                    onClick={cancelarEdicionPedido}
                                    disabled={guardandoEdicionPedido}
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            </article>
    );
  };

  const renderPedidosLista = (pedidosAgrupados, filtroActivo, totalPedidosTipo) => {
    if (totalPedidosTipo === 0) {
      return (
        <p className="dashboard-vacio seccion-entrega-vacio">
          No hay pedidos en la fecha seleccionada.
        </p>
      );
    }

    const totalVisible = pedidosAgrupados.reduce(
      (suma, grupo) => suma + grupo.pedidos.length,
      0
    );

    if (totalVisible === 0) {
      return (
        <p className="dashboard-vacio seccion-entrega-vacio">
          {filtroActivo !== 'todos'
            ? 'No hay pedidos con este status en la fecha seleccionada.'
            : 'No hay pedidos en la fecha seleccionada.'}
        </p>
      );
    }

    return pedidosAgrupados.map(({ clave, etiqueta, pedidos: pedidosGrupo }) => {
                  const esGrupoHistorico = clave !== hoyClave;
                  const subtotalGrupo = pedidosGrupo.reduce(
                    (suma, pedido) => suma + Number(pedido.total),
                    0
                  );

                  return (
                  <div key={clave} className="pedidos-grupo">
                    <h3 className="pedidos-grupo-titulo">{etiqueta}</h3>
                    {esGrupoHistorico ? (
                      <>
                        <div className="pedidos-reporte">
                          <div className="pedidos-reporte-header">
                            <span>Hora</span>
                            <span>Cliente</span>
                            <span>Productos</span>
                            <span>Total</span>
                            <span>Acciones</span>
                          </div>
                          {pedidosGrupo.map((pedido) => {
                            const otroEditando =
                              editandoPedidoId !== null && editandoPedidoId !== pedido.id;
                            const totalEdicionHistorico = pedidoEditForm
                              ? calcularTotalLineas(
                                  pedidoEditForm.lineas,
                                  productos,
                                  catalogosVariantes
                                )
                              : 0;

                            if (editandoPedidoId === pedido.id && pedidoEditForm) {
                              return (
                                <div
                                  key={pedido.id}
                                  className="pedidos-reporte-editando"
                                >
                                  {renderPedidoEnEdicion(pedido, totalEdicionHistorico)}
                                </div>
                              );
                            }

                            return (
                              <div key={pedido.id} className="pedidos-reporte-fila">
                                <span className="reporte-hora">
                                  {pedido.created_at
                                    ? formatearHora(new Date(pedido.created_at))
                                    : '—'}
                                </span>
                                <span className="reporte-cliente">{pedido.cliente}</span>
                                <span className="reporte-productos">
                                  {pedido.producto || '—'}
                                </span>
                                <span className="reporte-total">
                                  ${Number(pedido.total).toFixed(2)}
                                </span>
                                <span className="reporte-acciones">
                                  <button
                                    type="button"
                                    className="editar-btn"
                                    disabled={otroEditando}
                                    onClick={() => iniciarEdicionPedido(pedido)}
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    className="eliminar-btn"
                                    disabled={otroEditando}
                                    onClick={() => eliminarPedido(pedido.id)}
                                  >
                                    Eliminar
                                  </button>
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        <p className="pedidos-reporte-subtotal">
                          Subtotal del día: ${subtotalGrupo.toFixed(2)}
                        </p>
                      </>
                    ) : (
                    <div className="pedidos-grid">
                      {pedidosGrupo.map((pedido) => {
                        const esFinal = esStatusFinal(
                          pedido.status,
                          pedido.tipo_entrega
                        );
                        const esPresencialPedido = pedido.tipo === 'presencial';
                        const estaEditando = editandoPedidoId === pedido.id;
                        const otroEditando =
                          editandoPedidoId !== null && !estaEditando;
                        const totalEdicion = pedidoEditForm
                          ? calcularTotalLineas(
                              pedidoEditForm.lineas,
                              productos,
                              catalogosVariantes
                            )
                          : 0;

                        if (estaEditando && pedidoEditForm) {
                          return renderPedidoEnEdicion(pedido, totalEdicion);
                        }

                        return (
                          <article key={pedido.id} className="pedido-tarjeta">
                            <div className="pedido-tarjeta-cabecera">
                              <h2 className="pedido-cliente">{pedido.cliente}</h2>
                              <time
                                className="pedido-hora"
                                dateTime={pedido.created_at}
                              >
                                {formatearHoraPedido(pedido.created_at)}
                              </time>
                            </div>
                            <DesglosePedido
                              pedido={pedido}
                              productos={productos}
                              catalogosVariantes={catalogosVariantes}
                            />
                            {!esModoPresencial && (
                              <p className="pedido-tipo-entrega">
                                {formatearTipoEntrega(pedido.tipo_entrega)}
                              </p>
                            )}
                            {esModoPresencial ? (
                              <>
                                <span className="status-badge status-entregado">
                                  Venta completada
                                </span>
                                <div className="tarjeta-acciones">
                                  <button
                                    type="button"
                                    className="editar-btn"
                                    disabled={otroEditando}
                                    onClick={() => iniciarEdicionPedido(pedido)}
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    className="eliminar-btn"
                                    disabled={otroEditando}
                                    onClick={() => eliminarPedido(pedido.id)}
                                  >
                                    Eliminar
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                <span className={`status-badge status-${pedido.status}`}>
                                  {STATUS_LABELS[pedido.status]}
                                </span>
                                {pedido.status === 'en-cocina' &&
                                  pedidoRequiereAlgunaCocina(pedido) && (
                                    <p className="pedido-progreso-cocinas">
                                      {formatearProgresoCocinas(pedido)}
                                    </p>
                                  )}
                                <div className="tarjeta-acciones tarjeta-acciones-doble">
                                  {(() => {
                                    const muestraRetroceder = puedeRetrocederPedido(
                                      pedido.status,
                                      pedido.tipo_entrega
                                    );
                                    const muestraContactar = mostrarContactoWhatsAppPedido(
                                      pedido.status,
                                      pedido.tipo_entrega
                                    );
                                    const botonesFila1 =
                                      Number(muestraRetroceder) +
                                      1 +
                                      Number(muestraContactar);
                                    const fila1Class =
                                      botonesFila1 === 3
                                        ? ' tarjeta-acciones-fila-triple'
                                        : '';

                                    return (
                                      <div className={`tarjeta-acciones-fila${fila1Class}`}>
                                        {muestraRetroceder && (
                                          <button
                                            type="button"
                                            className="retroceder-btn"
                                            disabled={otroEditando}
                                            onClick={() => retrocederPedido(pedido.id)}
                                          >
                                            Retroceder
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          className="avanzar-btn"
                                          disabled={
                                            esFinal ||
                                            otroEditando ||
                                            pedido.status === 'en-cocina'
                                          }
                                          onClick={() => avanzarPedido(pedido.id)}
                                        >
                                          Avanzar
                                        </button>
                                        {muestraContactar && (() => {
                                          const urlWhatsApp = construirUrlWhatsApp(
                                            pedido.telefono,
                                            obtenerMensajeWhatsAppPedido(pedido)
                                          );

                                          return (
                                            <a
                                              className={`whatsapp-btn${
                                                urlWhatsApp ? '' : ' whatsapp-btn-deshabilitado'
                                              }`}
                                              href={urlWhatsApp || '#contactar'}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              aria-disabled={!urlWhatsApp}
                                              title={
                                                urlWhatsApp
                                                  ? 'Contactar por WhatsApp'
                                                  : 'Agrega un teléfono al pedido para contactar'
                                              }
                                              onClick={(e) => {
                                                if (!urlWhatsApp) e.preventDefault();
                                              }}
                                            >
                                              <svg
                                                className="whatsapp-btn-icono"
                                                viewBox="0 0 24 24"
                                                aria-hidden="true"
                                                focusable="false"
                                              >
                                                <path
                                                  fill="currentColor"
                                                  d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
                                                />
                                              </svg>
                                              Contactar
                                            </a>
                                          );
                                        })()}
                                      </div>
                                    );
                                  })()}
                                  <div className="tarjeta-acciones-fila">
                                    <button
                                      type="button"
                                      className="editar-btn"
                                      disabled={otroEditando}
                                      onClick={() => iniciarEdicionPedido(pedido)}
                                    >
                                      Editar
                                    </button>
                                    <button
                                      type="button"
                                      className="eliminar-btn"
                                      disabled={otroEditando}
                                      onClick={() => eliminarPedido(pedido.id)}
                                    >
                                      Eliminar
                                    </button>
                                  </div>
                                </div>
                              </>
                            )}
                          </article>
                        );
                      })}
                    </div>
                    )}
                  </div>
                  );
                });
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-top">
          <h1>
            {esModoPresencial ? 'Modo Caja — Venta presencial' : 'Modo WhatsApp — Pedidos'}
          </h1>
        </div>
        <div className="header-stats">
          <div className="header-stat header-stat-principal">
            <span className="header-stat-label">Ventas totales hoy</span>
            <span className="header-stat-fecha">
              {formatearFechaCompleta(new Date(fechaActual))}
            </span>
            <span className="header-stat-value header-stat-value-total">
              ${totalVentasHoyTotal.toFixed(2)}
            </span>
            <p className="header-stat-desglose">
              Caja: ${totalVentasHoyCaja.toFixed(2)} | WhatsApp: $
              {totalVentasHoyWhatsApp.toFixed(2)}
            </p>
            <p className="header-stat-desglose header-stat-desglose-whatsapp">
              🛵 Domicilio: ${totalVentasHoyDomicilio.toFixed(2)} | 🏪 Para recoger: $
              {totalVentasHoySucursal.toFixed(2)}
            </p>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        <nav className="dashboard-nav">
          {SECCIONES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={`nav-btn${seccion === value ? ' activo' : ''}`}
              onClick={() => setSeccion(value)}
            >
              {label}
            </button>
          ))}
        </nav>

        {seccion === 'pedidos' && (
          <>
            <nav className="modo-nav">
              {MODOS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={`modo-btn${modo === value ? ' activo' : ''}`}
                  onClick={() => cambiarModo(value)}
                >
                  {label}
                </button>
              ))}
            </nav>

            {resumenVenta && esModoPresencial && (
              <section className="venta-resumen">
                <h3 className="venta-resumen-titulo">Venta registrada</h3>
                <p className="venta-resumen-cliente">Cliente: {CLIENTE_PUBLICO}</p>
                <p className="venta-resumen-productos">{resumenVenta.producto}</p>
                <p className="venta-resumen-total">
                  Total: ${resumenVenta.total.toFixed(2)}
                </p>
                <button
                  type="button"
                  className="guardar-btn"
                  onClick={() => {
                    setResumenVenta(null);
                    resetFormPedido('presencial');
                  }}
                >
                  Nueva venta
                </button>
              </section>
            )}

            <section className="pedido-formulario">
              <h2 className="formulario-titulo">
                {esModoPresencial ? 'Nueva venta' : 'Nuevo pedido'}
              </h2>
              <form className="formulario-pedido" onSubmit={handleSubmit}>
                <div className="formulario formulario-cabecera">
                  <div className="formulario-campo">
                    <label htmlFor="cliente">Cliente</label>
                    <input
                      id="cliente"
                      name="cliente"
                      type="text"
                      value={esModoPresencial ? CLIENTE_PUBLICO : form.cliente}
                      onChange={handleFormChange}
                      readOnly={esModoPresencial}
                      required
                    />
                  </div>
                  {!esModoPresencial && (
                    <div className="formulario-campo">
                      <label htmlFor="telefono">Teléfono</label>
                      <input
                        id="telefono"
                        name="telefono"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="10 dígitos o con lada"
                        value={form.telefono}
                        onChange={handleFormChange}
                      />
                    </div>
                  )}
                  {!esModoPresencial && (
                    <div className="formulario-campo">
                      <label htmlFor="tipoEntrega">Tipo de entrega</label>
                      <select
                        id="tipoEntrega"
                        name="tipoEntrega"
                        value={form.tipoEntrega}
                        onChange={handleFormChange}
                      >
                        {TIPOS_ENTREGA_OPCIONES.map((opcion) => (
                          <option key={opcion.value} value={opcion.value}>
                            {opcion.icono} {opcion.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {!esModoPresencial &&
                    form.tipoEntrega === TIPOS_ENTREGA.DOMICILIO && (
                      <div className="formulario-campo formulario-campo-direccion">
                        <label htmlFor="direccion">Dirección de entrega</label>
                        <input
                          id="direccion"
                          name="direccion"
                          type="text"
                          placeholder="Calle, número, colonia, referencias..."
                          value={form.direccion}
                          onChange={handleFormChange}
                        />
                      </div>
                    )}
                  {!esModoPresencial && (
                    <div className="formulario-campo">
                      <label htmlFor="status">Status</label>
                      <select
                        id="status"
                        name="status"
                        value={form.status}
                        onChange={handleFormChange}
                      >
                        {obtenerFlujoStatus(form.tipoEntrega).map((status) => (
                          <option key={status} value={status}>
                            {STATUS_LABELS[status]}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="pedido-lineas">
                  <div className="pedido-lineas-encabezado">
                    <span>Productos del pedido</span>
                  </div>
                  {form.lineas.map((linea, indice) => {
                    const productoSeleccionado = buscarProductoPorId(
                      productos,
                      linea.productoId
                    );
                    const subtotal = calcularSubtotal(
                      linea,
                      productos,
                      catalogosVariantes
                    );

                    return (
                      <div key={linea.id} className="pedido-linea-contenedor">
                        <div className="pedido-linea">
                          <div className="pedido-linea-numero">#{indice + 1}</div>
                          <div className="formulario-campo pedido-linea-producto">
                            <label htmlFor={`producto-${linea.id}`}>Producto</label>
                            <select
                              id={`producto-${linea.id}`}
                              value={String(linea.productoId)}
                              onChange={(e) =>
                                actualizarLinea(linea.id, 'productoId', e.target.value)
                              }
                              required
                            >
                              <option value="">Seleccionar producto...</option>
                              {productosOrdenados.map((producto) => (
                                <option key={producto.id} value={String(producto.id)}>
                                  {formatearEtiquetaProducto(producto)}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="formulario-campo pedido-linea-cantidad">
                            <label htmlFor={`cantidad-${linea.id}`}>Cantidad</label>
                            <input
                              id={`cantidad-${linea.id}`}
                              type="number"
                              min="1"
                              step="1"
                              value={linea.cantidad}
                              onChange={(e) =>
                                actualizarLinea(linea.id, 'cantidad', e.target.value)
                              }
                              required
                            />
                          </div>
                          <div className="formulario-campo pedido-linea-subtotal">
                            <label htmlFor={`subtotal-${linea.id}`}>Subtotal</label>
                            <input
                              id={`subtotal-${linea.id}`}
                              type="text"
                              value={subtotal > 0 ? `$${subtotal.toFixed(2)}` : ''}
                              readOnly
                            />
                          </div>
                          <button
                            type="button"
                            className="eliminar-linea-btn"
                            onClick={() => eliminarLinea(linea.id)}
                            disabled={form.lineas.length <= 1}
                            aria-label={`Eliminar producto ${indice + 1}`}
                          >
                            ✕
                          </button>
                        </div>
                        {!esModoPresencial && productoSeleccionado && (
                          <VariantesPedido
                            key={`variantes-${linea.id}-${linea.productoId}`}
                            linea={linea}
                            producto={productoSeleccionado}
                            catalogosVariantes={catalogosVariantes}
                            onToggleVariante={cambiarVarianteLinea}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="pedido-acciones">
                  <button
                    type="button"
                    className="agregar-linea-btn"
                    onClick={agregarLinea}
                    disabled={productos.length === 0}
                  >
                    + Agregar producto
                  </button>
                  <div className="pedido-total-pedido">
                    <span className="pedido-total-label">Total del pedido</span>
                    <span className="pedido-total-valor">${totalPedido.toFixed(2)}</span>
                  </div>
                  {esModoPresencial && (
                    <div className="caja-pago">
                      <div className="formulario-campo caja-pago-campo">
                        <label htmlFor="pago-recibido">Pago recibido</label>
                        <input
                          id="pago-recibido"
                          type="number"
                          min="0"
                          step="0.01"
                          value={pagoRecibido}
                          onChange={(e) => setPagoRecibido(e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      {pagoValido &&
                        (pagoInsuficiente ? (
                          <p className="caja-pago-alerta caja-pago-insuficiente">
                            Pago insuficiente
                          </p>
                        ) : (
                          <p className="caja-pago-alerta caja-pago-cambio">
                            Cambio: ${cambio.toFixed(2)}
                          </p>
                        ))}
                    </div>
                  )}
                  <button
                    type="submit"
                    className="guardar-btn"
                    disabled={guardando || productos.length === 0 || totalPedido <= 0}
                  >
                    {guardando
                      ? 'Guardando...'
                      : esModoPresencial
                        ? 'Registrar venta'
                        : 'Guardar pedido'}
                  </button>
                </div>
              </form>
              {productos.length === 0 && (
                <p className="formulario-aviso">
                  Agrega productos en la sección Catálogo de productos para crear pedidos.
                </p>
              )}
            </section>

            <section className="dashboard-filtros dashboard-filtros-fecha">
              <div className="filtro-fecha-campo">
                <label htmlFor="filtro-fecha">Ver pedidos del</label>
                <input
                  id="filtro-fecha"
                  type="date"
                  className="filtro-fecha-input"
                  value={filtroFecha}
                  max={hoyClave}
                  onChange={(e) => setFiltroFecha(e.target.value)}
                />
              </div>
              <button
                type="button"
                className={`filtro-btn${filtroFecha === hoyClave ? ' activo' : ''}`}
                onClick={() => setFiltroFecha(hoyClave)}
              >
                Hoy
              </button>
              {!esFiltroHoy && (
                <p className="filtro-fecha-total">
                  Total del {formatearFechaCortaFiltro(filtroFecha)}: $
                  {totalVentasFechaFiltro.toFixed(2)}
                </p>
              )}
            </section>

            {esModoPresencial ? (
              <section className="dashboard-lista">
                {pedidosModoActual.length === 0 ? (
                  <p className="dashboard-vacio">No hay ventas registradas aún</p>
                ) : (
                  renderPedidosLista(
                    pedidosAgrupadosPresencial,
                    'todos',
                    pedidosPorFecha.length
                  )
                )}
              </section>
            ) : (
              <>
                {SECCIONES_ENTREGA_DASHBOARD.map((seccionEntrega) => {
                  const esDomicilio =
                    seccionEntrega.key === TIPOS_ENTREGA.DOMICILIO;
                  const pedidosTipo = esDomicilio
                    ? pedidosPorFechaDomicilio
                    : pedidosPorFechaSucursal;
                  const pedidosAgrupadosSeccion = esDomicilio
                    ? pedidosAgrupadosDomicilio
                    : pedidosAgrupadosSucursal;
                  const filtroSeccion = esDomicilio
                    ? filtroDomicilio
                    : filtroSucursal;
                  const setFiltroSeccion = esDomicilio
                    ? setFiltroDomicilio
                    : setFiltroSucursal;
                  const filtrosSeccion = esDomicilio
                    ? FILTROS_DOMICILIO
                    : FILTROS_SUCURSAL;
                  const contadoresSeccion = esDomicilio
                    ? contadoresDomicilioFecha
                    : contadoresSucursalFecha;
                  const totalSeccion = esDomicilio
                    ? totalVentasFechaDomicilio
                    : totalVentasFechaSucursal;

                  return (
                    <section
                      key={seccionEntrega.key}
                      className={`dashboard-seccion-entrega dashboard-seccion-entrega-${seccionEntrega.key}`}
                    >
                      <div className="seccion-entrega-cabecera">
                        <h2 className="seccion-entrega-titulo">{seccionEntrega.titulo}</h2>
                        <div className="seccion-entrega-resumen">
                          <span className="seccion-entrega-total">
                            Total: ${totalSeccion.toFixed(2)}
                          </span>
                          <span className="seccion-entrega-pedidos">
                            {pedidosTipo.length} pedido
                            {pedidosTipo.length === 1 ? '' : 's'}
                          </span>
                        </div>
                      </div>
                      <div className="seccion-entrega-contadores">
                        {contadoresSeccion.map(({ status, label, count }) => (
                          <div
                            key={status}
                            className={`seccion-entrega-contador status-${status}`}
                          >
                            <span className="seccion-entrega-contador-count">{count}</span>
                            <span className="seccion-entrega-contador-label">{label}</span>
                          </div>
                        ))}
                      </div>
                      <div className="dashboard-filtros seccion-entrega-filtros">
                        {filtrosSeccion.map(({ value, label }) => (
                          <button
                            key={value}
                            type="button"
                            className={`filtro-btn filtro-btn-${value}${filtroSeccion === value ? ' activo' : ''}`}
                            onClick={() => setFiltroSeccion(value)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <div className="dashboard-lista seccion-entrega-lista">
                        {renderPedidosLista(
                          pedidosAgrupadosSeccion,
                          filtroSeccion,
                          pedidosTipo.length
                        )}
                      </div>
                    </section>
                  );
                })}
              </>
            )}
          </>
        )}

        {seccion === 'catalogo' && (
          <>
            <nav className="catalogo-nav">
              {CATALOGO_TABS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={`catalogo-tab${catalogoTab === value ? ' activo' : ''}`}
                  onClick={() => {
                    setCatalogoTab(value);
                    resetProductoForm();
                    resetVarianteForm();
                  }}
                >
                  {label}
                </button>
              ))}
            </nav>

            {catalogoTab === 'productos' && (
              <>
                <section className="pedido-formulario">
                  <>
                    <h2 className="formulario-titulo">
                      {editandoProductoId ? 'Editar producto' : 'Agregar producto'}
                    </h2>
                    <form className="formulario" onSubmit={handleProductoSubmit}>
                        <div className="formulario-campo">
                          <label htmlFor="nombre">Nombre</label>
                          <input
                            id="nombre"
                            name="nombre"
                            type="text"
                            value={productoForm.nombre}
                            onChange={handleProductoFormChange}
                            required
                          />
                        </div>
                        <div className="formulario-campo">
                          <label htmlFor="precio">Precio</label>
                          <input
                            id="precio"
                            name="precio"
                            type="number"
                            min="0"
                            step="0.01"
                            value={productoForm.precio}
                            onChange={handleProductoFormChange}
                            required
                          />
                        </div>
                        <div className="formulario-campo">
                          <label htmlFor="categoria">Categoría</label>
                          <input
                            id="categoria"
                            name="categoria"
                            type="text"
                            value={productoForm.categoria}
                            onChange={handleProductoFormChange}
                          />
                        </div>
                        <div className="formulario-campo">
                          <label htmlFor="cocina">Cocina</label>
                          <select
                            id="cocina"
                            name="cocina"
                            value={productoForm.cocina}
                            onChange={handleProductoFormChange}
                          >
                            {COCINAS_OPCIONES.map((opcion) => (
                              <option key={opcion.value} value={opcion.value}>
                                {opcion.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <fieldset className="producto-variantes-activas">
                          <legend className="producto-variantes-activas-titulo">
                            Variantes disponibles para este producto
                          </legend>
                          <p className="producto-variantes-activas-descripcion">
                            Activa cada categoría y elige los items específicos que el
                            cliente podrá seleccionar al armar el pedido en modo WhatsApp.
                          </p>
                          <div className="producto-variantes-activas-categorias">
                            {RESUMEN_VARIANTES_ORDEN.map((key) => {
                              const config = obtenerConfigVariante(key);
                              const itemsCatalogo = catalogosVariantesOrdenados[key] || [];
                              if (!config) return null;

                              const entry = productoForm.variantesActivas[key] || {
                                categoria: false,
                                items: [],
                              };

                              return (
                                <div key={key} className="producto-variantes-activas-grupo">
                                  <label className="producto-variantes-activas-categoria">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(entry.categoria)}
                                      onChange={() => toggleCategoriaVarianteProducto(key)}
                                      disabled={itemsCatalogo.length === 0}
                                    />
                                    <span>{config.label}</span>
                                  </label>
                                  {entry.categoria && itemsCatalogo.length > 0 && (
                                    <div className="producto-variantes-activas-items">
                                      {itemsCatalogo.map((item) => (
                                        <label key={item.id} className="variante-opcion">
                                          <input
                                            type="checkbox"
                                            checked={entry.items.some(
                                              (id) => String(id) === String(item.id)
                                            )}
                                            onChange={() =>
                                              toggleItemVarianteProducto(key, item.id)
                                            }
                                          />
                                          <span>
                                            {item.nombre}
                                            {Number(item.precio) > 0
                                              ? ` (+$${Number(item.precio).toFixed(2)})`
                                              : ''}
                                          </span>
                                        </label>
                                      ))}
                                    </div>
                                  )}
                                  {entry.categoria && itemsCatalogo.length === 0 && (
                                    <p className="producto-variantes-activas-vacio">
                                      No hay items en esta categoría todavía.
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </fieldset>
                        <button
                          type="submit"
                          className="guardar-btn"
                          disabled={guardandoProducto}
                        >
                          {guardandoProducto
                            ? 'Guardando...'
                            : editandoProductoId
                              ? 'Guardar cambios'
                              : 'Agregar producto'}
                        </button>
                        <button
                          type="button"
                          className="cancelar-btn"
                          onClick={resetProductoForm}
                        >
                          Cancelar
                        </button>
                      </form>
                  </>
                </section>

                <section className="dashboard-lista">
                  {productos.length === 0 ? (
                    <p className="dashboard-vacio">No hay productos en el catálogo</p>
                  ) : (
                    <div className="pedidos-grid">
                      {productosOrdenados.map((producto) => (
                        <article key={producto.id} className="pedido-tarjeta">
                          <h2 className="pedido-cliente">{producto.nombre}</h2>
                          {producto.categoria && (
                            <p className="pedido-producto">{producto.categoria}</p>
                          )}
                          <p className="pedido-producto pedido-cocina">
                            {etiquetaCocinaProducto(producto.cocina)}
                          </p>
                          <p className="pedido-total">
                            ${Number(producto.precio).toFixed(2)}
                          </p>
                          <div className="tarjeta-acciones">
                            <button
                              type="button"
                              className="editar-btn"
                              onClick={() => iniciarEdicionProducto(producto)}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="eliminar-btn"
                              onClick={() => eliminarProducto(producto.id)}
                            >
                              Eliminar
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}

            {VARIANTES_CATEGORIAS.map(({ key, label }) => {
              if (catalogoTab !== key) return null;

              const items = catalogosVariantesOrdenados[key] || [];
              const editandoActual =
                editandoVariante?.categoria === key ? editandoVariante.id : null;
              const nombreSingular = label.toLowerCase();

              return (
                <div key={key}>
                  <section className="pedido-formulario">
                    <>
                      <h2 className="formulario-titulo">
                        {editandoActual ? `Editar ${nombreSingular}` : `Agregar ${nombreSingular}`}
                      </h2>
                      <form
                        className="formulario"
                        onSubmit={(e) => handleVarianteSubmit(e, key)}
                      >
                          <div className="formulario-campo">
                            <label htmlFor={`${key}-nombre`}>Nombre</label>
                            <input
                              id={`${key}-nombre`}
                              name="nombre"
                              type="text"
                              value={varianteForm.nombre}
                              onChange={handleVarianteFormChange}
                              required
                            />
                          </div>
                          <div className="formulario-campo">
                            <label htmlFor={`${key}-precio`}>Precio adicional</label>
                            <input
                              id={`${key}-precio`}
                              name="precio"
                              type="number"
                              min="0"
                              step="0.01"
                              value={varianteForm.precio}
                              onChange={handleVarianteFormChange}
                              required
                            />
                          </div>
                          <button
                            type="submit"
                            className="guardar-btn"
                            disabled={guardandoVariante}
                          >
                            {guardandoVariante
                              ? 'Guardando...'
                              : editandoActual
                                ? 'Guardar cambios'
                                : `Agregar ${nombreSingular}`}
                          </button>
                          <button
                            type="button"
                            className="cancelar-btn"
                            onClick={resetVarianteForm}
                          >
                            Cancelar
                          </button>
                        </form>
                    </>
                  </section>

                  <section className="dashboard-lista">
                    {items.length === 0 ? (
                      <p className="dashboard-vacio">
                        No hay {label.toLowerCase()} en el catálogo
                      </p>
                    ) : (
                      <div className="pedidos-grid">
                        {items.map((item) => (
                          <article key={item.id} className="pedido-tarjeta">
                            <h2 className="pedido-cliente">{item.nombre}</h2>
                            <p className="pedido-producto">Precio adicional</p>
                            <p className="pedido-total">
                              ${Number(item.precio).toFixed(2)}
                            </p>
                            <div className="tarjeta-acciones">
                              <button
                                type="button"
                                className="editar-btn"
                                onClick={() => {
                                  setCatalogoTab(key);
                                  iniciarEdicionVariante(key, item);
                                }}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="eliminar-btn"
                                onClick={() => eliminarVariante(key, item.id)}
                              >
                                Eliminar
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              );
            })}
          </>
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/cocina" element={<VistaCocina />} />
        <Route path="/cocina2" element={<VistaCocina2 />} />
        <Route path="/repartidor" element={<VistaRepartidor />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
