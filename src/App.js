import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import './App.css';
import { AuthProvider, useAuth } from './AuthContext';
import ProtectedRoute from './ProtectedRoute';
import VistaLogin from './VistaLogin';
import DashboardNav from './DashboardNav';
import DashboardHeaderReservaMovil from './DashboardHeaderReservaMovil';
import BotonCerrarSesion from './BotonCerrarSesion';
import useEsMobile from './useEsMobile';
import { supabase } from './supabase';
import { usePedidosRealtime, useProductosRealtime } from './usePedidosRealtime';
import {
  COCINAS,
  COCINAS_OPCIONES,
  construirPayloadAvancePedido,
  construirPayloadRetrocesoPedido,
  construirUrlWhatsApp,
  determinarStatusInicialPresencial,
  enriquecerLineasDetalleCocina,
  etiquetaCocinaProducto,
  formatearMoneda,
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
import VistaReportes from './VistaReportes';
import VistaEquipo from './VistaEquipo';
import {
  agruparPedidosPorDia,
  formatearHoraPedidoLista,
} from './reportesHelpers';
import {
  cargarCarritoPedido,
  cargarCarritoPresencialDisponible,
  cargarCarritoWhatsappDisponible,
  crearFormularioPedidoDefault,
  cargarEstadoInicialCapturaPedidoWeb,
  cargarSeccionActiva,
  limpiarCarritoPedido,
  persistirCarritoPedido,
  persistirModoCaptura,
  persistirSeccionActiva,
  rutaSeccionActiva,
  seccionDesdeRuta,
} from './pedidoCarritoStorage';
import {
  eliminarPedidoPendienteSync,
  guardarPedidoPendienteSync,
  obtenerPedidosPendientesSync,
} from './pedidoPendingSyncStorage';
import ModalAutorizacionPin from './ModalAutorizacionPin';
import SelectorProductosPedido from './SelectorProductosPedido';
import { useFrecuenciaCategoriasPedidos } from './useFrecuenciaCategoriasPedidos';
import { payloadConNegocio, perteneceANegocio, queryConNegocio } from './tenantHelpers';
import {
  TAB_CATEGORIAS_VARIANTES,
  agruparItemsPorCategoria,
  calcularExtrasLinea,
  catalogosVariantesOrdenadosDesde,
  categoriasVariantesActivas,
  clonarVariantesLinea,
  combinarVariantesLinea,
  construirProductoItemsMap,
  crearCatalogosVariantesVacios,
  crearVariantesActivasFormVacias,
  crearVariantesLineaVacias,
  esTabCategoriaVariante,
  filtrarItemsVariantesProducto,
  formatearDetalleVariantesLinea,
  formatearLineaResumen,
  itemIdsDesdeFormActivas,
  itemsActivosCategoria,
  obtenerCategoriaVariante,
  ordenarItemsVariantes,
  parsearDetalleVariantes,
  parsearVariantesActivasProducto,
  variantesActivasFormDesdeProducto,
} from './variantesDinamicas';

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

const MODOS = [
  { value: 'presencial', label: 'Modo Caja' },
  { value: 'whatsapp', label: 'Modo WhatsApp' },
];

function crearCatalogoTabs(categorias) {
  const tabs = [
    { value: 'productos', label: 'Productos' },
    { value: TAB_CATEGORIAS_VARIANTES, label: 'Categorías' },
  ];

  categoriasVariantesActivas(categorias).forEach((categoria) => {
    tabs.push({ value: String(categoria.id), label: categoria.nombre });
  });

  return tabs;
}

const STORAGE_KEY_MODO_PEDIDOS = 'pos_modo_pedidos';
const STORAGE_KEY_TAB_CATALOGO = 'pos_tab_catalogo';
const STORAGE_KEY_TAB_WHATSAPP_PEDIDOS = 'pos_tab_whatsapp_pedidos';

function normalizarModoPedidos(modo) {
  return modo === 'whatsapp' ? 'whatsapp' : 'presencial';
}

function persistirModoPedidos(modo) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(STORAGE_KEY_MODO_PEDIDOS, normalizarModoPedidos(modo));
  } catch {
    // Ignorar errores de almacenamiento local.
  }
}

function cargarModoPedidos() {
  if (typeof window === 'undefined') return 'presencial';

  try {
    const modo = window.localStorage.getItem(STORAGE_KEY_MODO_PEDIDOS);
    return modo === 'whatsapp' ? 'whatsapp' : 'presencial';
  } catch {
    return 'presencial';
  }
}

function valoresCatalogoTabValidos(tabs) {
  return new Set((tabs || []).map(({ value }) => value));
}

function persistirTabCatalogo(tab, tabs) {
  if (typeof window === 'undefined' || !valoresCatalogoTabValidos(tabs).has(tab)) return;

  try {
    window.localStorage.setItem(STORAGE_KEY_TAB_CATALOGO, tab);
  } catch {
    // Ignorar errores de almacenamiento local.
  }
}

function cargarTabCatalogo(tabs) {
  const validos = valoresCatalogoTabValidos(tabs);
  if (typeof window === 'undefined') return 'productos';

  try {
    const tab = window.localStorage.getItem(STORAGE_KEY_TAB_CATALOGO);
    return validos.has(tab) ? tab : 'productos';
  } catch {
    return 'productos';
  }
}

function valoresTabWhatsappPedidosValidos() {
  return new Set([TIPOS_ENTREGA.DOMICILIO, TIPOS_ENTREGA.SUCURSAL]);
}

function persistirTabWhatsappPedidos(tab) {
  if (typeof window === 'undefined' || !valoresTabWhatsappPedidosValidos().has(tab)) return;

  try {
    window.localStorage.setItem(STORAGE_KEY_TAB_WHATSAPP_PEDIDOS, tab);
  } catch {
    // Ignorar errores de almacenamiento local.
  }
}

function cargarTabWhatsappPedidos() {
  const validos = valoresTabWhatsappPedidosValidos();
  if (typeof window === 'undefined') return TIPOS_ENTREGA.DOMICILIO;

  try {
    const tab = window.localStorage.getItem(STORAGE_KEY_TAB_WHATSAPP_PEDIDOS);
    return validos.has(tab) ? tab : TIPOS_ENTREGA.DOMICILIO;
  } catch {
    return TIPOS_ENTREGA.DOMICILIO;
  }
}

function cargarEstadoInicialDashboardPedidos() {
  const modo = cargarModoPedidos();
  const restaurado =
    modo === 'whatsapp'
      ? cargarCarritoWhatsappDisponible()
      : cargarCarritoPresencialDisponible();

  if (restaurado) {
    return { ...restaurado, modo };
  }

  return {
    form: crearFormularioPedidoDefault(modo),
    pagoRecibido: '',
    nextLineaId: 2,
    modo,
  };
}

const CLIENTE_PUBLICO = 'Público general';

const FORMAS_PAGO = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'link_pago', label: 'Link de pago' },
];

const FORMA_PAGO_DEFAULT_CAJA = 'efectivo';

function etiquetaFormaPago(valor) {
  return FORMAS_PAGO.find((forma) => forma.value === valor)?.label || null;
}

function normalizarFormaPagoPayload(valor) {
  const forma = String(valor ?? '').trim();
  if (!forma) return null;
  return FORMAS_PAGO.some((item) => item.value === forma) ? forma : null;
}

function calcularVentasPorFormaPago(pedidosLista) {
  const totales = {
    efectivo: 0,
    tarjeta: 0,
    transferencia: 0,
    link_pago: 0,
  };

  (pedidosLista || []).forEach((pedido) => {
    const forma = normalizarFormaPagoPayload(pedido.forma_pago);
    if (!forma) return;
    totales[forma] = redondearMoneda(totales[forma] + (Number(pedido.total) || 0));
  });

  return totales;
}

function obtenerRangoFechaClave(claveFecha) {
  const [year, month, day] = claveFecha.split('-').map(Number);
  return {
    inicio: new Date(year, month - 1, day, 0, 0, 0, 0),
    fin: new Date(year, month - 1, day, 23, 59, 59, 999),
  };
}

function crearArqueoContadoVacio() {
  return {
    efectivo: '0',
    tarjeta: '0',
    transferencia: '0',
    link_pago: '0',
  };
}

const MENSAJE_ARQUEO_DIA_EXISTENTE =
  'Ya existe un arqueo de caja registrado para este día.';

const MENSAJE_FONDO_FIJO_BLOQUEADO_ARQUEO =
  'No puedes eliminar este Fondo fijo del día porque existe un arqueo de caja registrado para este día.';

const MENSAJE_RETIRO_BLOQUEADO_ARQUEO =
  'No puedes agregar retiros de efectivo porque existe un arqueo de caja registrado para este día.';

const MENSAJE_ELIMINAR_VENTA_BLOQUEADA_ARQUEO =
  'No puedes eliminar esta venta porque existe un arqueo de caja registrado para este día.';

const MENSAJE_EDITAR_VENTA_BLOQUEADA_ARQUEO =
  'No puedes editar esta venta porque existe un arqueo de caja registrado para este día.';

const MENSAJE_ELIMINAR_PEDIDO_BLOQUEADO_ARQUEO =
  'No puedes eliminar este pedido porque existe un arqueo de caja registrado para este día.';

const MENSAJE_EDITAR_PEDIDO_BLOQUEADO_ARQUEO =
  'No puedes editar este pedido porque existe un arqueo de caja registrado para este día.';

const MENSAJE_RETROCEDER_PEDIDO_BLOQUEADO_ARQUEO =
  'No puedes retroceder el estado de este pedido porque existe un arqueo de caja registrado para este día.';

const MENSAJE_AVANZAR_PEDIDO_BLOQUEADO_ARQUEO =
  'No puedes avanzar el estado de este pedido porque existe un arqueo de caja registrado para este día.';

const MENSAJE_REGISTRAR_VENTA_BLOQUEADA_ARQUEO =
  'No se puede registrar la venta porque existe un arqueo de caja registrado para este día.';

const MENSAJE_GUARDAR_PEDIDO_BLOQUEADO_ARQUEO =
  'No se puede guardar el pedido porque existe un arqueo de caja registrado para este día.';

function obtenerCampoSistemaArqueo(formaPago) {
  if (formaPago === 'link_pago') return 'link_sistema';
  return `${formaPago}_sistema`;
}

function obtenerCampoContadoArqueo(formaPago) {
  if (formaPago === 'link_pago') return 'link_contado';
  return `${formaPago}_contado`;
}

function crearArqueoContadoDesdeRegistro(arqueo) {
  return FORMAS_PAGO.reduce((acc, { value }) => {
    const monto = Number(arqueo?.[obtenerCampoContadoArqueo(value)]);
    acc[value] = Number.isFinite(monto) ? String(monto) : '0';
    return acc;
  }, {});
}

function normalizarMontoContadoArqueo(valor) {
  if (valor === '' || valor === null || valor === undefined) return 0;

  const limpio = String(valor).replace(/[^0-9.-]/g, '');
  const monto = Number.parseFloat(limpio);

  return Number.isFinite(monto) && monto >= 0 ? redondearMoneda(monto) : 0;
}

function formatearContadoArqueoInput(valor) {
  return formatearMoneda(normalizarMontoContadoArqueo(valor));
}

function sanitizarEntradaContadoArqueo(value) {
  const sanitized = String(value).replace(/[^0-9.]/g, '');
  const partes = sanitized.split('.');

  if (partes.length <= 2) return sanitized;

  return `${partes[0]}.${partes.slice(1).join('')}`;
}

function usuarioSesionActual(session) {
  return (
    session?.user?.email ||
    session?.user?.user_metadata?.full_name ||
    session?.user?.id ||
    null
  );
}

function formatearDiferenciaArqueo(valor) {
  const diferencia = redondearMoneda(valor);
  const clase =
    diferencia < 0
      ? 'arqueo-modal-diferencia arqueo-modal-diferencia-negativa'
      : diferencia > 0
        ? 'arqueo-modal-diferencia arqueo-modal-diferencia-positiva'
        : 'arqueo-modal-diferencia';
  const prefijo = diferencia > 0 ? '+' : '';
  return { texto: `${prefijo}${formatearMoneda(diferencia)}`, clase };
}

function formatearNombreClientePedido(pedido) {
  const cliente = pedido.cliente?.trim() || CLIENTE_PUBLICO;
  const referencia = pedido.referencia?.trim();

  if (referencia) {
    return `${cliente} — ${referencia}`;
  }

  return cliente;
}

const STATUS_DEFAULT_WHATSAPP_FORM = 'en-cocina';

function statusDefaultFormularioPedido(modoActual) {
  return modoActual === 'presencial' ? 'por-aceptar' : STATUS_DEFAULT_WHATSAPP_FORM;
}

const TIPO_ENTREGA_SIN_SELECCION = '';

function tipoEntregaWhatsAppSeleccionado(tipoEntrega) {
  return (
    tipoEntrega === TIPOS_ENTREGA.DOMICILIO || tipoEntrega === TIPOS_ENTREGA.SUCURSAL
  );
}

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
  return status === 'en-cocina' || status === 'enviado' || status === 'entregado';
}

function mostrarContactoWhatsAppPedido(status, tipoEntrega = TIPOS_ENTREGA.DOMICILIO) {
  if (normalizarTipoEntrega(tipoEntrega) === TIPOS_ENTREGA.SUCURSAL) {
    return status === 'por-aceptar' || status === 'listo-para-recoger';
  }
  return status === 'por-aceptar' || status === 'enviado';
}

function crearLineaPedido(id, ctx) {
  return {
    id,
    productoId: '',
    cantidad: '1',
    variantes: ctx ? crearVariantesLineaVacias(ctx.categorias) : {},
  };
}

function consolidarLineasPorProducto(lineas, ctx) {
  const orden = [];
  const map = new Map();

  (lineas || []).forEach((linea) => {
    if (!linea?.productoId) return;

    const productoId = String(linea.productoId);
    const cantidad = Math.max(1, parseInt(linea.cantidad, 10) || 1);

    if (map.has(productoId)) {
      const existente = map.get(productoId);
      map.set(productoId, {
        ...existente,
        cantidad: String((parseInt(existente.cantidad, 10) || 1) + cantidad),
        variantes: clonarVariantesLinea(existente.variantes, ctx?.categorias),
      });
      return;
    }

    const copia = {
      ...linea,
      productoId,
      cantidad: String(cantidad),
      variantes: clonarVariantesLinea(linea.variantes, ctx?.categorias),
    };
    map.set(productoId, copia);
    orden.push(productoId);
  });

  return orden.map((productoId) => map.get(productoId));
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
  return `${producto.nombre} — ${formatearMoneda(producto.precio)}`;
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

function toggleIdEnLinea(ids, id) {
  const lista = ids || [];
  const idStr = String(id);
  if (lista.some((item) => String(item) === idStr)) {
    return lista.filter((item) => String(item) !== idStr);
  }
  return [...lista, idStr];
}

function VariantesPedido({ linea, producto, variantesCtx, onToggleVariante }) {
  if (!producto) return null;

  const mapa = parsearVariantesActivasProducto(producto, variantesCtx);
  const categorias = categoriasVariantesActivas(variantesCtx.categorias).filter(
    (categoria) => (mapa[String(categoria.id)] || []).length > 0
  );
  if (categorias.length === 0) return null;

  const grupos = categorias
    .map((categoria) => {
      const categoriaId = String(categoria.id);
      const items = filtrarItemsVariantesProducto(producto, categoriaId, variantesCtx);
      if (items.length === 0) return null;

      return { categoriaId, label: categoria.nombre, items };
    })
    .filter(Boolean);

  if (grupos.length === 0) return null;

  return (
    <div className="linea-variantes">
      {grupos.map(({ categoriaId, label, items }) => (
        <div key={categoriaId} className="linea-variantes-grupo">
          <span className="linea-variantes-titulo">{label} (múltiple)</span>
          <div className="linea-variantes-opciones">
            {items.map((item) => (
              <label key={item.id} className="variante-opcion">
                <input
                  type="checkbox"
                  checked={(linea.variantes?.[categoriaId] || []).some(
                    (id) => String(id) === String(item.id)
                  )}
                  onChange={() => onToggleVariante(linea.id, categoriaId, item.id)}
                />
                <span>
                  {item.nombre}
                  {Number(item.precio) > 0
                    ? ` (+${formatearMoneda(item.precio)})`
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

function calcularDetalleLineaPedido(linea, listaProductos, variantesCtx) {
  const producto = buscarProductoPorId(listaProductos, linea.productoId);
  if (!producto) return null;

  const cantidad = Math.max(1, parseInt(linea.cantidad, 10) || 1);
  const precioBase = parsePrecioCatalogo(producto.precio);
  const extras = redondearMoneda(calcularExtrasLinea(linea, variantesCtx));
  const precioUnitario = redondearMoneda(precioBase + extras);
  const subtotal = redondearMoneda(precioUnitario * cantidad);
  const descripcion = formatearDescripcionLinea(linea, producto, variantesCtx);

  return {
    productoId: String(producto.id),
    nombre: producto.nombre,
    cantidad,
    precioBase,
    extras,
    precioUnitario,
    precio_unitario: precioUnitario,
    subtotal,
    descripcion,
    cocina: normalizarCocinaProducto(producto.cocina),
  };
}

function calcularDetalleLineasPedido(lineas, listaProductos, variantesCtx) {
  const lineasDetalle = lineas
    .map((linea) => calcularDetalleLineaPedido(linea, listaProductos, variantesCtx))
    .filter(Boolean);

  const total = redondearMoneda(
    lineasDetalle.reduce((suma, linea) => suma + linea.subtotal, 0)
  );

  return { lineas: lineasDetalle, total };
}

function calcularSubtotal(linea, listaProductos, variantesCtx) {
  return calcularDetalleLineaPedido(linea, listaProductos, variantesCtx)?.subtotal ?? 0;
}

function calcularPrecioUnitarioLinea(linea, listaProductos, variantesCtx) {
  return (
    calcularDetalleLineaPedido(linea, listaProductos, variantesCtx)?.precioUnitario ?? 0
  );
}

function formatearDescripcionLinea(linea, producto, variantesCtx) {
  const detalles = formatearDetalleVariantesLinea(linea, variantesCtx);
  if (detalles.length === 0) return producto.nombre;
  return `${producto.nombre} (${detalles.join('; ')})`;
}

function construirLineaDesglosePedido(linea, listaProductos, variantesCtx) {
  const producto = buscarProductoPorId(listaProductos, linea.productoId);
  if (!producto) return null;

  const cantidad = parseInt(linea.cantidad, 10) || 1;
  const descripcion = formatearDescripcionLinea(linea, producto, variantesCtx);
  const precioUnitario = calcularPrecioUnitarioLinea(linea, listaProductos, variantesCtx);

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

function obtenerDesglosePedido(pedido, listaProductos, variantesCtx) {
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
    variantesCtx
  );
  const partesRaw = pedido.producto.split(', ').map((s) => s.trim()).filter(Boolean);

  const filas = lineas
    .map((linea, index) => {
      const formateada = construirLineaDesglosePedido(linea, listaProductos, variantesCtx);
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

function DesglosePedido({ pedido, productos, variantesCtx }) {
  const desglose = obtenerDesglosePedido(pedido, productos, variantesCtx);

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
                — {formatearMoneda(linea.precioUnitario)}
              </span>
            )}
          </div>
        </div>
      ))}
      <p className="pedido-desglose-total">Total: {formatearMoneda(desglose.total)}</p>
    </div>
  );
}

function calcularTotalLineas(lineas, listaProductos, variantesCtx) {
  return calcularDetalleLineasPedido(lineas, listaProductos, variantesCtx).total;
}

function resumenProductos(lineas, listaProductos, variantesCtx) {
  return lineas
    .map((linea) => {
      const producto = buscarProductoPorId(listaProductos, linea.productoId);
      if (!producto) return null;
      return formatearLineaResumen(linea, producto, variantesCtx);
    })
    .filter(Boolean)
    .join(', ');
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

function formatearLineaDetalleReporteHistorico(linea) {
  const descripcion = (linea.descripcion || linea.nombre || 'Producto').trim();
  const cantidad = Math.max(1, parseInt(linea.cantidad, 10) || 1);
  const precioUnitario = linea.precio_unitario;

  if (
    precioUnitario != null &&
    precioUnitario !== '' &&
    Number.isFinite(Number(precioUnitario))
  ) {
    return `${descripcion} x${cantidad} — ${formatearMoneda(precioUnitario)} c/u`;
  }

  return `${descripcion} x${cantidad}`;
}

function formatearProductosPedidoReporteHistorico(pedido) {
  const lineas = normalizarLineasDetallePedido(pedido);

  if (lineas.length === 0) {
    return pedido.producto || '—';
  }

  return lineas.map(formatearLineaDetalleReporteHistorico).join(', ');
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

function lineasFormularioDesdePedido(pedido, listaProductos, variantesCtx) {
  const lineasDetalle = normalizarLineasDetallePedido(pedido);

  if (lineasDetalle.length > 0) {
    return lineasDetalle.map((linea, index) => ({
      id: index + 1,
      productoId: productoIdDesdeLineaDetalle(linea, listaProductos),
      cantidad: String(Math.max(1, parseInt(linea.cantidad, 10) || 1)),
      variantes: variantesFormularioDesdeLineaDetalle(
        linea,
        listaProductos,
        variantesCtx
      ),
    }));
  }

  return [crearLineaPedido(1, variantesCtx)];
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

function parsearLineasDesdeResumen(textoProducto, listaProductos, variantesCtx) {
  if (!textoProducto?.trim()) {
    return [crearLineaPedido(1, variantesCtx)];
  }

  const partes = textoProducto.split(', ').map((s) => s.trim()).filter(Boolean);
  let id = 1;

  return partes.map((parte) => parsearLineaPedidoDesdeTexto(
    parte,
    listaProductos,
    variantesCtx,
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

function formatearHoraRelojDashboard(fecha = new Date()) {
  const horas12 = fecha.getHours() % 12 || 12;
  const minutos = String(fecha.getMinutes()).padStart(2, '0');
  const periodo = fecha.getHours() >= 12 ? 'p.m.' : 'a.m.';

  return `${horas12}:${minutos} ${periodo}`;
}

function formatearFechaCompleta(fecha = new Date()) {
  const diaSemana = fecha.toLocaleDateString('es-MX', { weekday: 'long' });
  const dia = fecha.getDate();
  const mes = fecha.toLocaleDateString('es-MX', { month: 'long' });
  const anio = fecha.getFullYear();
  const diaCapitalizado = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
  const hora = formatearHoraRelojDashboard(fecha);

  return `${diaCapitalizado} ${dia} de ${mes} de ${anio} • ${hora}`;
}

function esMismoDia(fechaA, fechaB) {
  return formatearClaveFecha(fechaA) === formatearClaveFecha(fechaB);
}

function formatearHora(fecha) {
  return fecha.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
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

function agruparPedidosPorFecha(listaPedidos) {
  return agruparPedidosPorDia(listaPedidos);
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

function crearIdOptimisticoPedido() {
  return `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function ordenarPedidosDesc(pedidos) {
  return [...pedidos].sort(
    (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
  );
}

function clonarFormPedido(form) {
  return JSON.parse(JSON.stringify(form));
}

const PADDING_HEADER_CERRAR_SESION = '7.75rem';

function estiloContenedorNombreNegocioHeader() {
  return {
    flex: 1,
    minWidth: 0,
    paddingRight: PADDING_HEADER_CERRAR_SESION,
  };
}

function estiloNombreNegocioTituloPrincipal(esMobile) {
  return {
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: esMobile ? 2 : 1,
    WebkitBoxOrient: 'vertical',
    lineHeight: 1.25,
    wordBreak: 'break-word',
  };
}

function esMobileDashboardInicial() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 720px)').matches;
}

function Dashboard() {
  const location = useLocation();
  const { negocioId, session, rol, usuario } = useAuth();
  const esMobileDashboard = useEsMobile(720);
  const seccion = location.pathname === '/catalogo' ? 'catalogo' : 'pedidos';
  const estadoInicialCaptura = esMobileDashboardInicial()
    ? cargarEstadoInicialDashboardPedidos()
    : cargarEstadoInicialCapturaPedidoWeb();
  const [modo, setModo] = useState(estadoInicialCaptura.modo ?? 'presencial');
  const [filtroDomicilio, setFiltroDomicilio] = useState('todos');
  const [filtroSucursal, setFiltroSucursal] = useState('todos');
  const [tabEntregaWhatsAppMovil, setTabEntregaWhatsAppMovil] = useState(() =>
    cargarTabWhatsappPedidos()
  );
  const [filtroFecha, setFiltroFecha] = useState(obtenerFechaHoy);
  const { pedidos, setPedidos } = usePedidosRealtime({
    channelName: 'dashboard-pedidos',
    negocioId,
  });
  const { productos, setProductos } = useProductosRealtime({
    channelName: 'dashboard-productos',
    negocioId,
  });
  const [categoriasVariantes, setCategoriasVariantes] = useState([]);
  const [catalogosVariantes, setCatalogosVariantes] = useState({});
  const [productoItemsVariantes, setProductoItemsVariantes] = useState({});
  const [catalogoTab, setCatalogoTab] = useState('productos');
  const productosOrdenados = useMemo(
    () => ordenarProductos(productos),
    [productos]
  );
  const { frecuenciaCategorias: frecuenciaCategoriasPedidos, frecuenciaLista } =
    useFrecuenciaCategoriasPedidos(negocioId, productos);
  const catalogoTabs = useMemo(
    () => crearCatalogoTabs(categoriasVariantes),
    [categoriasVariantes]
  );
  const variantesCtx = useMemo(
    () => ({
      categorias: categoriasVariantes,
      catalogos: catalogosVariantes,
      productoItems: productoItemsVariantes,
    }),
    [categoriasVariantes, catalogosVariantes, productoItemsVariantes]
  );
  const catalogosVariantesOrdenados = useMemo(
    () => catalogosVariantesOrdenadosDesde(catalogosVariantes, categoriasVariantes, negocioId),
    [catalogosVariantes, categoriasVariantes, negocioId]
  );
  const [resumenVenta, setResumenVenta] = useState(null);
  const [nombreNegocio, setNombreNegocio] = useState('');
  const nextLineaId = useRef(estadoInicialCaptura.nextLineaId);
  const nextEditLineaId = useRef(2);
  const persistenciaCarritoPausadaRef = useRef(false);
  const [form, setForm] = useState(estadoInicialCaptura.form);
  const [productoForm, setProductoForm] = useState({
    nombre: '',
    precio: '',
    categoria: '',
    cocina: COCINAS.COCINA1,
    variantesActivas: crearVariantesActivasFormVacias(categoriasVariantes),
  });
  const [varianteForm, setVarianteForm] = useState({ nombre: '', precio: '0' });
  const [categoriaVarianteForm, setCategoriaVarianteForm] = useState({ nombre: '', orden: '0' });
  const [editandoCategoriaVarianteId, setEditandoCategoriaVarianteId] = useState(null);
  const [guardandoCategoriaVariante, setGuardandoCategoriaVariante] = useState(false);
  const [editandoVariante, setEditandoVariante] = useState(null);
  const [editandoProductoId, setEditandoProductoId] = useState(null);
  const [editandoPedidoId, setEditandoPedidoId] = useState(null);
  const [pedidoEditForm, setPedidoEditForm] = useState(null);
  const [guardandoProducto, setGuardandoProducto] = useState(false);
  const [guardandoVariante, setGuardandoVariante] = useState(false);
  const [guardandoEdicionPedido, setGuardandoEdicionPedido] = useState(false);
  const [errorGuardarPedido, setErrorGuardarPedido] = useState(null);
  const [pagoRecibido, setPagoRecibido] = useState(estadoInicialCaptura.pagoRecibido);
  const [fechaActual, setFechaActual] = useState(() => Date.now());
  const [categoriaPedidoActiva, setCategoriaPedidoActiva] = useState(null);
  const [modalRetiroAbierto, setModalRetiroAbierto] = useState(false);
  const [modalRetiroBloqueadoAbierto, setModalRetiroBloqueadoAbierto] = useState(false);
  const [mensajeRetiroBloqueado, setMensajeRetiroBloqueado] = useState(null);
  const [modalPedidoBloqueadoArqueoAbierto, setModalPedidoBloqueadoArqueoAbierto] =
    useState(false);
  const [mensajePedidoBloqueadoArqueo, setMensajePedidoBloqueadoArqueo] = useState(null);
  const [retiroForm, setRetiroForm] = useState({ monto: '', motivo: '' });
  const [guardandoRetiro, setGuardandoRetiro] = useState(false);
  const [errorRetiro, setErrorRetiro] = useState(null);
  const [modalAutorizacionPinRetiroAbierto, setModalAutorizacionPinRetiroAbierto] =
    useState(false);
  const [modalArqueoAbierto, setModalArqueoAbierto] = useState(false);
  const [arqueoContado, setArqueoContado] = useState(crearArqueoContadoVacio);
  const [arqueoContadoCampoEnfocado, setArqueoContadoCampoEnfocado] = useState(null);
  const [retirosDelDia, setRetirosDelDia] = useState(0);
  const [fondoFijoDelDia, setFondoFijoDelDia] = useState(0);
  const [fondoFijoHoyId, setFondoFijoHoyId] = useState(null);
  const [modalFondoFijoAbierto, setModalFondoFijoAbierto] = useState(false);
  const [fondoFijoForm, setFondoFijoForm] = useState({ monto: '' });
  const [cargandoFondoFijoDatos, setCargandoFondoFijoDatos] = useState(false);
  const [guardandoFondoFijo, setGuardandoFondoFijo] = useState(false);
  const [errorFondoFijo, setErrorFondoFijo] = useState(null);
  const [confirmarEliminarFondoFijo, setConfirmarEliminarFondoFijo] = useState(false);
  const [modalAutorizacionPinFondoFijoAbierto, setModalAutorizacionPinFondoFijoAbierto] =
    useState(false);
  const [accionPendienteAutorizacionFondoFijo, setAccionPendienteAutorizacionFondoFijo] =
    useState(null);
  const [cargandoArqueoDatos, setCargandoArqueoDatos] = useState(false);
  const [guardandoArqueo, setGuardandoArqueo] = useState(false);
  const [errorArqueo, setErrorArqueo] = useState(null);
  const [modalAutorizacionPinArqueoAbierto, setModalAutorizacionPinArqueoAbierto] =
    useState(false);
  const [modalAutorizacionPinEliminarPedidoAbierto, setModalAutorizacionPinEliminarPedidoAbierto] =
    useState(false);
  const [pedidoPendienteEliminar, setPedidoPendienteEliminar] = useState(null);
  const [arqueoDelDiaGuardado, setArqueoDelDiaGuardado] = useState(null);

  const cargarProductoItemsVariantes = async (catalogos, productoIds) => {
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
  };

  const cargarCatalogosVariantes = async () => {
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
    await cargarProductoItemsVariantes(catalogos, productos.map((producto) => producto.id));
  };

  const sincronizarProductoCategoriasVariantes = async (productoId, formActivas) => {
    const ctx = {
      categorias: categoriasVariantes,
      catalogos: catalogosVariantes,
      productoItems: productoItemsVariantes,
    };
    const itemIds = itemIdsDesdeFormActivas(formActivas, ctx);

    await supabase
      .from('producto_categorias_variantes')
      .delete()
      .eq('producto_id', productoId);

    if (itemIds.length > 0) {
      const { error } = await supabase.from('producto_categorias_variantes').insert(
        itemIds.map((itemVarianteId) => ({
          producto_id: productoId,
          item_variante_id: itemVarianteId,
        }))
      );

      if (error) {
        throw new Error(error.message);
      }
    }

    const mapa = itemIds.reduce((acc, itemId) => {
      for (const [categoriaId, items] of Object.entries(catalogosVariantes)) {
        if ((items || []).some((item) => String(item.id) === String(itemId))) {
          if (!acc[categoriaId]) acc[categoriaId] = [];
          acc[categoriaId].push(String(itemId));
          break;
        }
      }
      return acc;
    }, {});

    setProductoItemsVariantes((prev) => ({
      ...prev,
      [String(productoId)]: mapa,
    }));
  };

  const cargarCatalogos = async () => {
    await cargarCatalogosVariantes();
  };

  const sincronizarPedidosPendientes = useCallback(async () => {
    if (!negocioId) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    const pendientes = obtenerPedidosPendientesSync(negocioId);

    for (const item of pendientes) {
      const { data, error } = await supabase
        .from('pedidos')
        .insert(item.payload)
        .select()
        .single();

      if (error || !data) continue;

      eliminarPedidoPendienteSync(item.localId);
      setPedidos((prev) => {
        const sinOptimistico = prev.filter((pedido) => pedido.id !== item.localId);
        const existe = sinOptimistico.some((pedido) => pedido.id === data.id);

        if (existe) {
          return ordenarPedidosDesc(sinOptimistico);
        }

        return ordenarPedidosDesc([...sinOptimistico, data]);
      });
    }
  }, [negocioId, setPedidos]);

  const resetFormulariosCatalogo = () => {
    setEditandoProductoId(null);
    setEditandoVariante(null);
    setEditandoCategoriaVarianteId(null);
    setProductoForm({
      nombre: '',
      precio: '',
      categoria: '',
      cocina: COCINAS.COCINA1,
      variantesActivas: crearVariantesActivasFormVacias(categoriasVariantes),
    });
    setVarianteForm({ nombre: '', precio: '0' });
    setCategoriaVarianteForm({ nombre: '', orden: '0' });
  };

  useEffect(() => {
    cargarCatalogos();
  }, [negocioId]);

  useEffect(() => {
    let activo = true;

    if (!negocioId) {
      setNombreNegocio('');
      return undefined;
    }

    const cargarNombreNegocio = async () => {
      const { data, error } = await supabase
        .from('negocios')
        .select('nombre')
        .eq('id', negocioId)
        .maybeSingle();

      if (!activo) return;

      setNombreNegocio(!error && data?.nombre?.trim() ? data.nombre.trim() : '');
    };

    cargarNombreNegocio();

    return () => {
      activo = false;
    };
  }, [negocioId]);

  useEffect(() => {
    if (seccion === 'pedidos' || seccion === 'catalogo') {
      cargarCatalogos();
    }
  }, [seccion, negocioId]);

  useEffect(() => {
    if (seccion !== 'catalogo') {
      resetFormulariosCatalogo();
    }
  }, [seccion]);

  useEffect(() => {
    if (seccion === 'catalogo') {
      setCatalogoTab(cargarTabCatalogo(catalogoTabs));
    }
  }, [seccion, catalogoTabs]);

  useEffect(() => {
    if (seccion === 'catalogo') {
      persistirTabCatalogo(catalogoTab, catalogoTabs);
    }
  }, [seccion, catalogoTab, catalogoTabs]);

  useEffect(() => {
    if (seccion !== 'catalogo') return;
    if (!valoresCatalogoTabValidos(catalogoTabs).has(catalogoTab)) {
      setCatalogoTab('productos');
    }
  }, [seccion, catalogoTab, catalogoTabs]);

  useEffect(() => {
    if (!categoriasVariantes.length) return;

    setProductoForm((prev) => {
      const base = crearVariantesActivasFormVacias(categoriasVariantes);
      const merged = { ...base };

      Object.entries(prev.variantesActivas || {}).forEach(([key, val]) => {
        if (merged[key]) merged[key] = val;
      });

      return { ...prev, variantesActivas: merged };
    });
  }, [categoriasVariantes]);

  useEffect(() => {
    if (!negocioId || productos.length === 0) {
      if (!negocioId) setProductoItemsVariantes({});
      return;
    }

    void cargarProductoItemsVariantes(
      catalogosVariantes,
      productos.map((producto) => producto.id)
    );
  }, [negocioId, productos, catalogosVariantes]);

  useEffect(() => {
    if (seccion === 'pedidos') {
      persistirModoPedidos(modo);
    }
  }, [seccion, modo]);

  useEffect(() => {
    if (!esMobileDashboard || seccion !== 'pedidos' || modo !== 'whatsapp') return;

    setTabEntregaWhatsAppMovil(cargarTabWhatsappPedidos());
  }, [esMobileDashboard, seccion, modo]);

  useEffect(() => {
    if (!esMobileDashboard || seccion !== 'pedidos' || modo !== 'whatsapp') return;

    persistirTabWhatsappPedidos(tabEntregaWhatsAppMovil);
  }, [esMobileDashboard, seccion, modo, tabEntregaWhatsAppMovil]);

  useEffect(() => {
    if (seccion !== 'pedidos' || persistenciaCarritoPausadaRef.current) return;

    persistirCarritoPedido({
      modo,
      form,
      pagoRecibido,
      nextLineaId: nextLineaId.current,
    });
  }, [seccion, modo, form, pagoRecibido]);

  useEffect(() => {
    if (!negocioId) return;

    const pendientes = obtenerPedidosPendientesSync(negocioId);
    if (pendientes.length === 0) return;

    setPedidos((prev) => {
      let next = [...prev];

      pendientes.forEach((item) => {
        if (!next.some((pedido) => pedido.id === item.localId)) {
          next = [...next, item.pedidoOptimista];
        }
      });

      return ordenarPedidosDesc(next);
    });

    void sincronizarPedidosPendientes();
  }, [negocioId, setPedidos, sincronizarPedidosPendientes]);

  useEffect(() => {
    if (!negocioId) return undefined;

    const handleOnline = () => {
      void sincronizarPedidosPendientes();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [negocioId, sincronizarPedidosPendientes]);

  useEffect(() => {
    if (!resumenVenta || modo !== 'presencial') return;

    const timer = setTimeout(() => {
      setResumenVenta(null);
      resetFormPedido('presencial');
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

  const aplicarEstadoCarrito = ({ form: formRestaurado, pagoRecibido: pagoRestaurado, nextLineaId: nextId }) => {
    setForm(formRestaurado);
    setPagoRecibido(pagoRestaurado);
    nextLineaId.current = nextId;
  };

  const handleFormChange = (e) => {
    setErrorGuardarPedido(null);
    const { name, value } = e.target;

    if (name === 'tipoEntrega' && modo === 'whatsapp') {
      persistirCarritoPedido({
        modo,
        form,
        pagoRecibido,
        nextLineaId: nextLineaId.current,
      });

      if (!value) {
        setForm((prev) => ({
          ...prev,
          tipoEntrega: TIPO_ENTREGA_SIN_SELECCION,
          direccion: '',
        }));
        return;
      }

      const restaurado = cargarCarritoPedido('whatsapp', value);
      if (restaurado) {
        aplicarEstadoCarrito({
          ...restaurado,
          form: {
            ...restaurado.form,
            tipoEntrega: value,
          },
        });
        return;
      }

      const flujo = obtenerFlujoStatus(value);
      setForm({
        cliente: '',
        telefono: '',
        tipoEntrega: value,
        direccion: '',
        formaPago: '',
        referencia: '',
        lineas: [crearLineaPedido(1, variantesCtx)],
        status: flujo.includes(STATUS_DEFAULT_WHATSAPP_FORM)
          ? STATUS_DEFAULT_WHATSAPP_FORM
          : flujo[0],
      });
      setPagoRecibido('');
      nextLineaId.current = 2;
      return;
    }

    setForm((prev) => {
      if (name === 'tipoEntrega') {
        if (!value) {
          return {
            ...prev,
            tipoEntrega: TIPO_ENTREGA_SIN_SELECCION,
            direccion: '',
          };
        }

        const flujo = obtenerFlujoStatus(value);
        const status = flujo.includes(prev.status)
          ? prev.status
          : STATUS_DEFAULT_WHATSAPP_FORM;
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
            variantes: crearVariantesLineaVacias(variantesCtx.categorias),
          };
        }
        return { ...linea, [campo]: valor };
      }),
    }));
  };

  const ajustarCantidadLinea = (lineaId, delta) => {
    setForm((prev) => ({
      ...prev,
      lineas: consolidarLineasPorProducto(
        prev.lineas.map((linea) => {
          if (linea.id !== lineaId) return linea;

          const cantidadActual = Math.max(1, parseInt(linea.cantidad, 10) || 1);
          const cantidadNueva = Math.max(1, cantidadActual + delta);

          return { ...linea, cantidad: String(cantidadNueva) };
        }),
        variantesCtx
      ),
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
      lineas: [...prev.lineas, crearLineaPedido(nextLineaId.current++, variantesCtx)],
    }));
  };

  const agregarProductoAlPedido = (productoId) => {
    const idStr = String(productoId);

    setForm((prev) => {
      const lineasConsolidadas = consolidarLineasPorProducto(
        prev.lineas.filter((linea) => linea.productoId),
        variantesCtx
      );
      const indiceExistente = lineasConsolidadas.findIndex(
        (linea) => String(linea.productoId) === idStr
      );

      if (indiceExistente !== -1) {
        return {
          ...prev,
          lineas: lineasConsolidadas.map((linea, indice) =>
            indice === indiceExistente
              ? {
                  ...linea,
                  cantidad: String((parseInt(linea.cantidad, 10) || 1) + 1),
                }
              : linea
          ),
        };
      }

      return {
        ...prev,
        lineas: [
          ...lineasConsolidadas,
          {
            ...crearLineaPedido(nextLineaId.current++, variantesCtx),
            productoId: idStr,
          },
        ],
      };
    });
  };

  const eliminarLinea = (lineaId) => {
    setForm((prev) => ({
      ...prev,
      lineas: prev.lineas.filter((linea) => linea.id !== lineaId),
    }));
  };

  const resetFormPedido = (modoActual = modo, { limpiarStorage = true } = {}) => {
    if (limpiarStorage) {
      limpiarCarritoPedido(
        modoActual,
        modoActual === 'presencial' ? TIPOS_ENTREGA.DOMICILIO : form.tipoEntrega
      );
    }

    nextLineaId.current = 2;
    setPagoRecibido('');
    setCategoriaPedidoActiva(null);
    setForm({
      cliente: modoActual === 'presencial' ? CLIENTE_PUBLICO : '',
      telefono: '',
      tipoEntrega:
        modoActual === 'presencial' ? TIPOS_ENTREGA.DOMICILIO : TIPO_ENTREGA_SIN_SELECCION,
      direccion: '',
      formaPago: modoActual === 'presencial' ? FORMA_PAGO_DEFAULT_CAJA : '',
      referencia: '',
      lineas: [crearLineaPedido(1, variantesCtx)],
      status: statusDefaultFormularioPedido(modoActual),
    });
  };

  const limpiarPedidoCaptura = () => {
    setErrorGuardarPedido(null);
    resetFormPedido(modo);
  };

  const cambiarModo = (nuevoModo) => {
    persistirCarritoPedido({
      modo,
      form,
      pagoRecibido,
      nextLineaId: nextLineaId.current,
    });
    persistirModoCaptura(nuevoModo);
    persistirModoPedidos(nuevoModo);
    setModo(nuevoModo);
    setErrorGuardarPedido(null);
    setFiltroDomicilio('todos');
    setFiltroSucursal('todos');
    setFiltroFecha(obtenerFechaHoy());
    setResumenVenta(null);
    setEditandoPedidoId(null);
    setPedidoEditForm(null);

    if (nuevoModo === 'presencial') {
      const restaurado = cargarCarritoPresencialDisponible();
      if (restaurado) {
        aplicarEstadoCarrito(restaurado);
        return;
      }
    } else {
      const restaurado = cargarCarritoWhatsappDisponible();
      if (restaurado) {
        aplicarEstadoCarrito(restaurado);
        return;
      }
    }

    resetFormPedido(nuevoModo, { limpiarStorage: false });
  };

  const lineasPedidoActivas = useMemo(
    () => (form.lineas || []).filter((linea) => linea?.productoId),
    [form.lineas]
  );
  const lineasPedidoConProducto = useMemo(
    () => consolidarLineasPorProducto(lineasPedidoActivas, variantesCtx),
    [lineasPedidoActivas, variantesCtx]
  );
  const totalPedido = useMemo(
    () => calcularTotalLineas(lineasPedidoActivas, productos, variantesCtx),
    [lineasPedidoActivas, productos, variantesCtx]
  );
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

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorGuardarPedido(null);

    const detallePedido = calcularDetalleLineasPedido(
      form.lineas,
      productos,
      variantesCtx
    );

    if (detallePedido.lineas.length === 0 || detallePedido.total <= 0) {
      return;
    }

    const esPresencial = modo === 'presencial';

    if (!esPresencial && !tipoEntregaWhatsAppSeleccionado(form.tipoEntrega)) {
      return;
    }

    void ejecutarGuardadoPedido(detallePedido, esPresencial);
  };

  const resetProductoForm = () => {
    setEditandoProductoId(null);
    setProductoForm({
      nombre: '',
      precio: '',
      categoria: '',
      cocina: COCINAS.COCINA1,
      variantesActivas: crearVariantesActivasFormVacias(categoriasVariantes),
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
      variantesActivas: variantesActivasFormDesdeProducto(producto, variantesCtx),
    });
  };

  const iniciarEdicionVariante = (categoriaId, item) => {
    setEditandoVariante({ categoria: String(categoriaId), id: item.id });
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

  const resetCategoriaVarianteForm = () => {
    setEditandoCategoriaVarianteId(null);
    setCategoriaVarianteForm({ nombre: '', orden: '0' });
  };

  const iniciarEdicionCategoriaVariante = (categoria) => {
    setEditandoCategoriaVarianteId(categoria.id);
    setCategoriaVarianteForm({
      nombre: categoria.nombre,
      orden: String(categoria.orden ?? 0),
    });
  };

  const handleCategoriaVarianteFormChange = (e) => {
    const { name, value } = e.target;
    setCategoriaVarianteForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCategoriaVarianteSubmit = async (e) => {
    e.preventDefault();
    setGuardandoCategoriaVariante(true);

    const payload = {
      nombre: categoriaVarianteForm.nombre.trim(),
      orden: parseInt(categoriaVarianteForm.orden, 10) || 0,
    };

    if (editandoCategoriaVarianteId) {
      const { data, error } = await queryConNegocio(
        supabase.from('categorias_variantes').update(payload).eq('id', editandoCategoriaVarianteId),
        negocioId
      )
        .select()
        .single();

      setGuardandoCategoriaVariante(false);

      if (!error && data) {
        setCategoriasVariantes((prev) =>
          [...prev.map((c) => (String(c.id) === String(data.id) ? data : c))].sort(
            (a, b) =>
              (a.orden ?? 0) - (b.orden ?? 0) ||
              String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es')
          )
        );
        resetCategoriaVarianteForm();
      }
      return;
    }

    const { data, error } = await supabase
      .from('categorias_variantes')
      .insert(payloadConNegocio({ ...payload, activo: true }, negocioId))
      .select()
      .single();

    setGuardandoCategoriaVariante(false);

    if (!error && data) {
      setCategoriasVariantes((prev) =>
        [...prev, data].sort(
          (a, b) =>
            (a.orden ?? 0) - (b.orden ?? 0) ||
            String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es')
        )
      );
      setCatalogosVariantes((prev) => ({
        ...prev,
        [String(data.id)]: prev[String(data.id)] || [],
      }));
      resetCategoriaVarianteForm();
    }
  };

  const toggleCategoriaVarianteActiva = async (categoria) => {
    const nuevoActivo = categoria.activo === false;
    const { data, error } = await queryConNegocio(
      supabase
        .from('categorias_variantes')
        .update({ activo: nuevoActivo })
        .eq('id', categoria.id),
      negocioId
    )
      .select()
      .single();

    if (!error && data) {
      setCategoriasVariantes((prev) =>
        prev.map((c) => (String(c.id) === String(data.id) ? data : c))
      );

      if (catalogoTab === String(categoria.id) && !nuevoActivo) {
        setCatalogoTab(TAB_CATEGORIAS_VARIANTES);
      }
    }
  };

  const handleProductoSubmit = async (e) => {
    e.preventDefault();
    setGuardandoProducto(true);

    const payload = {
      nombre: productoForm.nombre.trim(),
      precio: parseFloat(productoForm.precio),
      categoria: productoForm.categoria.trim() || null,
      cocina: normalizarCocinaProducto(productoForm.cocina),
      variantes_configuradas: true,
    };

    try {
      if (editandoProductoId) {
        const { data, error } = await queryConNegocio(
          supabase.from('productos').update(payload).eq('id', editandoProductoId),
          negocioId
        )
          .select()
          .single();

        if (error || !data) return;

        await sincronizarProductoCategoriasVariantes(
          data.id,
          productoForm.variantesActivas
        );

        setProductos((prev) =>
          prev
            .map((p) => (String(p.id) === String(data.id) ? data : p))
            .sort((a, b) => a.id - b.id)
        );
        resetProductoForm();
        return;
      }

      const { data, error } = await supabase
        .from('productos')
        .insert(payloadConNegocio(payload, negocioId))
        .select()
        .single();

      if (error || !data) return;

      await sincronizarProductoCategoriasVariantes(
        data.id,
        productoForm.variantesActivas
      );

      setProductos((prev) => [...prev, data].sort((a, b) => a.id - b.id));
      resetProductoForm();
    } finally {
      setGuardandoProducto(false);
    }
  };

  const handleVarianteSubmit = async (e, categoriaId) => {
    e.preventDefault();
    const categoriaIdStr = String(categoriaId);
    setGuardandoVariante(true);

    const payload = {
      nombre: varianteForm.nombre.trim(),
      precio: parseFloat(varianteForm.precio) || 0,
    };

    const editandoId =
      editandoVariante?.categoria === categoriaIdStr ? editandoVariante.id : null;

    if (editandoId) {
      const { data, error } = await supabase
        .from('items_variantes')
        .update(payload)
        .eq('id', editandoId)
        .select()
        .single();

      setGuardandoVariante(false);

      if (!error && data) {
        setCatalogosVariantes((prev) => ({
          ...prev,
          [categoriaIdStr]: ordenarItemsVariantes(
            (prev[categoriaIdStr] || []).map((item) =>
              String(item.id) === String(data.id) ? data : item
            )
          ),
        }));
        resetVarianteForm();
      }
      return;
    }

    const { data, error } = await supabase
      .from('items_variantes')
      .insert({ ...payload, categoria_id: categoriaId, activo: true })
      .select()
      .single();

    setGuardandoVariante(false);

    if (!error && data) {
      setCatalogosVariantes((prev) => ({
        ...prev,
        [categoriaIdStr]: ordenarItemsVariantes([...(prev[categoriaIdStr] || []), data]),
      }));
      resetVarianteForm();
    }
  };

  const toggleItemVarianteActivo = async (categoriaId, item) => {
    const categoriaIdStr = String(categoriaId);
    const nuevoActivo = item.activo === false;

    const { data, error } = await supabase
      .from('items_variantes')
      .update({ activo: nuevoActivo })
      .eq('id', item.id)
      .select()
      .single();

    if (!error && data) {
      setCatalogosVariantes((prev) => ({
        ...prev,
        [categoriaIdStr]: ordenarItemsVariantes(
          (prev[categoriaIdStr] || []).map((entry) =>
            String(entry.id) === String(data.id) ? data : entry
          )
        ),
      }));

      if (
        editandoVariante?.categoria === categoriaIdStr &&
        editandoVariante.id === item.id &&
        !nuevoActivo
      ) {
        resetVarianteForm();
      }

      if (!nuevoActivo) {
        setForm((prev) => ({
          ...prev,
          lineas: quitarVarianteDeLineas(categoriaIdStr, item.id, prev.lineas),
        }));

        setPedidoEditForm((prev) =>
          prev
            ? {
                ...prev,
                lineas: quitarVarianteDeLineas(categoriaIdStr, item.id, prev.lineas),
              }
            : prev
        );
      }
    }
  };

  const eliminarProducto = async (id) => {
    const { error } = await queryConNegocio(
      supabase.from('productos').delete().eq('id', id),
      negocioId
    );

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
  const ventasBrutasPorFormaPago = useMemo(
    () => calcularVentasPorFormaPago(pedidosHoyTodos),
    [pedidosHoyTodos]
  );
  const arqueoSistema = useMemo(() => {
    const ventasEfectivo = ventasBrutasPorFormaPago.efectivo;
    const efectivo = redondearMoneda(ventasEfectivo - retirosDelDia + fondoFijoDelDia);
    const tarjeta = ventasBrutasPorFormaPago.tarjeta;
    const transferencia = ventasBrutasPorFormaPago.transferencia;
    const linkPago = ventasBrutasPorFormaPago.link_pago;

    return {
      efectivo,
      tarjeta,
      transferencia,
      link_pago: linkPago,
      total: redondearMoneda(efectivo + tarjeta + transferencia + linkPago),
    };
  }, [ventasBrutasPorFormaPago, retirosDelDia, fondoFijoDelDia]);

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

    const { error } = await queryConNegocio(
      supabase.from('pedidos').update(payload).eq('id', id),
      negocioId
    );

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

    const { error } = await queryConNegocio(
      supabase.from('pedidos').update(payload).eq('id', id),
      negocioId
    );

    if (!error) {
      setPedidos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...payload } : p))
      );
    }
  };

  const eliminarPedido = async (id, autorizadoPor = null) => {
    const { error } = await queryConNegocio(
      supabase
        .from('pedidos')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: session?.user?.id ?? null,
          autorizado_por: autorizadoPor,
        })
        .eq('id', id),
      negocioId
    );

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

    const { data, error } = await queryConNegocio(
      supabase.from('pedidos').select('*').eq('id', pedido.id).is('deleted_at', null),
      negocioId
    ).single();

    if (!error && data) {
      pedidoFuente = data;
      setPedidos((prev) =>
        prev.map((item) => (item.id === data.id ? { ...item, ...data } : item))
      );
    }

    const lineas = lineasFormularioDesdePedido(
      pedidoFuente,
      productos,
      variantesCtx
    );
    nextEditLineaId.current = lineas.length + 1;
    setEditandoPedidoId(pedido.id);
    setPedidoEditForm({
      cliente: pedidoFuente.cliente,
      telefono: pedidoFuente.telefono || '',
      tipoEntrega: normalizarTipoEntrega(pedidoFuente.tipo_entrega),
      direccion: pedidoFuente.direccion || '',
      formaPago:
        pedidoFuente.forma_pago ||
        (pedidoFuente.tipo === 'presencial' ? FORMA_PAGO_DEFAULT_CAJA : ''),
      referencia: pedidoFuente.referencia || '',
      status: pedidoFuente.status || 'por-aceptar',
      lineas,
    });
  };

  const handlePedidoEditChange = (e) => {
    const { name, value } = e.target;
    setPedidoEditForm((prev) => {
      if (!prev) return prev;
      if (name === 'tipoEntrega') {
        if (!value) {
          return {
            ...prev,
            tipoEntrega: TIPO_ENTREGA_SIN_SELECCION,
            direccion: '',
          };
        }

        const flujo = obtenerFlujoStatus(value);
        const status = flujo.includes(prev.status)
          ? prev.status
          : STATUS_DEFAULT_WHATSAPP_FORM;
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
            variantes: crearVariantesLineaVacias(variantesCtx.categorias),
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
      lineas: [...prev.lineas, crearLineaPedido(nextEditLineaId.current++, variantesCtx)],
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
      variantesCtx
    );

    if (detallePedido.lineas.length === 0 || detallePedido.total <= 0) return;

    const resumen = resumenProductos(
      pedidoEditForm.lineas,
      productos,
      variantesCtx
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
      forma_pago: normalizarFormaPagoPayload(pedidoEditForm.formaPago),
      ...(esPresencial
        ? {
            cliente: CLIENTE_PUBLICO,
            referencia: pedidoEditForm.referencia?.trim() || null,
            status: 'entregado',
            tipo_entrega: TIPOS_ENTREGA.DOMICILIO,
          }
        : {
            cliente: pedidoEditForm.cliente.trim(),
            referencia: null,
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

    const { data, error } = await queryConNegocio(
      supabase.from('pedidos').update(payload).eq('id', pedido.id),
      negocioId
    )
      .select()
      .single();

    setGuardandoEdicionPedido(false);

    if (!error && data) {
      const valorEdicionComoTexto = (valor) => {
        if (valor == null) return '';
        if (typeof valor === 'object') return JSON.stringify(valor);
        return String(valor);
      };

      const camposEdicion = [
        'total',
        'cliente',
        'forma_pago',
        'tipo_entrega',
        'lineas_detalle',
      ];
      const valoresAnteriores = {
        total: pedido.total,
        cliente: pedido.cliente,
        forma_pago: normalizarFormaPagoPayload(pedido.forma_pago),
        tipo_entrega: normalizarTipoEntrega(pedido.tipo_entrega),
        lineas_detalle: pedido.lineas_detalle,
      };
      const valoresNuevos = {
        total: payload.total,
        cliente: payload.cliente,
        forma_pago: payload.forma_pago,
        tipo_entrega: payload.tipo_entrega,
        lineas_detalle: payload.lineas_detalle,
      };

      const registrosEdicion = camposEdicion
        .filter(
          (campo) =>
            valorEdicionComoTexto(valoresAnteriores[campo]) !==
            valorEdicionComoTexto(valoresNuevos[campo])
        )
        .map((campo) => ({
          pedido_id: pedido.id,
          negocio_id: pedido.negocio_id ?? negocioId,
          editado_por: session?.user?.id ?? null,
          campo_modificado: campo,
          valor_anterior: valorEdicionComoTexto(valoresAnteriores[campo]),
          valor_nuevo: valorEdicionComoTexto(valoresNuevos[campo]),
        }));

      if (registrosEdicion.length > 0) {
        await supabase.from('pedidos_ediciones').insert(registrosEdicion);
      }

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

                                {esPresencialPedido && (
                                  <div className="formulario-campo">
                                    <label htmlFor={`edit-referencia-${pedido.id}`}>
                                      Referencia / Nombre
                                    </label>
                                    <input
                                      id={`edit-referencia-${pedido.id}`}
                                      name="referencia"
                                      type="text"
                                      placeholder="Opcional"
                                      value={pedidoEditForm.referencia}
                                      onChange={handlePedidoEditChange}
                                    />
                                  </div>
                                )}

                                <div className="formulario-campo">
                                  <label htmlFor={`edit-forma-pago-${pedido.id}`}>
                                    Forma de pago
                                  </label>
                                  <select
                                    id={`edit-forma-pago-${pedido.id}`}
                                    name="formaPago"
                                    value={pedidoEditForm.formaPago}
                                    onChange={handlePedidoEditChange}
                                  >
                                    {!esPresencialPedido && (
                                      <option value="">Sin especificar</option>
                                    )}
                                    {FORMAS_PAGO.map((forma) => (
                                      <option key={forma.value} value={forma.value}>
                                        {forma.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                {!esPresencialPedido && (
                                  <div className="formulario-campo">
                                    <label htmlFor={`edit-status-${pedido.id}`}>
                                      Estatus del pedido
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
                      variantesCtx
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
                                                  {formatearEtiquetaProducto(producto)}
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
                                                  ? formatearMoneda(subtotal)
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
                                            variantesCtx={variantesCtx}
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
                                    {formatearMoneda(totalEdicion)}
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

  const retiroFormValido =
    Number.parseFloat(retiroForm.monto) > 0 && retiroForm.motivo.trim().length > 0;

  const cerrarModalRetiro = () => {
    setModalRetiroAbierto(false);
    setRetiroForm({ monto: '', motivo: '' });
    setErrorRetiro(null);
  };

  const cerrarModalRetiroBloqueado = () => {
    setModalRetiroBloqueadoAbierto(false);
    setMensajeRetiroBloqueado(null);
  };

  const handleRetiroFormChange = (e) => {
    const { name, value } = e.target;
    setRetiroForm((prev) => ({ ...prev, [name]: value }));
  };

  const cerrarAutorizacionPinRetiro = () => {
    setModalAutorizacionPinRetiroAbierto(false);
  };

  const solicitarAutorizacionGuardarRetiro = (e) => {
    e.preventDefault();
    if (!retiroFormValido || !negocioId || guardandoRetiro) return;
    setModalAutorizacionPinRetiroAbierto(true);
  };

  const onAutorizadoRetiro = () => {
    void handleGuardarRetiro({ preventDefault: () => {} });
  };

  const handleGuardarRetiro = async (e) => {
    e.preventDefault();
    if (!retiroFormValido || !negocioId || guardandoRetiro) return;

    setGuardandoRetiro(true);
    setErrorRetiro(null);

    const { error } = await supabase.from('retiros').insert(
      payloadConNegocio(
        {
          monto: Number.parseFloat(retiroForm.monto),
          motivo: retiroForm.motivo.trim(),
          usuario:
            session?.user?.email ||
            session?.user?.user_metadata?.full_name ||
            session?.user?.id ||
            null,
        },
        negocioId
      )
    );

    setGuardandoRetiro(false);

    if (error) {
      setErrorRetiro(error.message);
      return;
    }

    cerrarModalRetiro();
  };

  const arqueoContadoValido = FORMAS_PAGO.every(({ value }) => {
    const raw = arqueoContado[value];
    if (raw === '') return false;
    const monto = Number.parseFloat(raw);
    return Number.isFinite(monto) && monto >= 0;
  });

  const totalArqueoContado = useMemo(
    () =>
      redondearMoneda(
        FORMAS_PAGO.reduce(
          (suma, { value }) => suma + (Number.parseFloat(arqueoContado[value]) || 0),
          0
        )
      ),
    [arqueoContado]
  );

  const diferenciaArqueoTotal = useMemo(
    () => redondearMoneda(totalArqueoContado - arqueoSistema.total),
    [totalArqueoContado, arqueoSistema.total]
  );

  const cargarRetirosDelDia = async () => {
    if (!negocioId) return 0;

    const { inicio, fin } = obtenerRangoFechaClave(hoyClave);
    const { data, error } = await queryConNegocio(
      supabase
        .from('retiros')
        .select('monto')
        .gte('created_at', inicio.toISOString())
        .lte('created_at', fin.toISOString()),
      negocioId
    );

    if (error) {
      throw new Error(error.message);
    }

    return redondearMoneda(
      (data || []).reduce((suma, retiro) => suma + (Number(retiro.monto) || 0), 0)
    );
  };

  const cargarFondoFijoDelDia = async () => {
    if (!negocioId) return { monto: 0, id: null };

    const { inicio, fin } = obtenerRangoFechaClave(hoyClave);
    const { data, error } = await queryConNegocio(
      supabase
        .from('fondos_fijos')
        .select('id, monto')
        .gte('created_at', inicio.toISOString())
        .lte('created_at', fin.toISOString())
        .order('created_at', { ascending: false })
        .limit(1),
      negocioId
    );

    if (error) {
      throw new Error(error.message);
    }

    const registro = (data || [])[0];

    return {
      monto: registro ? redondearMoneda(Number(registro.monto) || 0) : 0,
      id: registro?.id ?? null,
    };
  };

  const cargarArqueoDelDia = async () => {
    if (!negocioId) return null;

    const { inicio, fin } = obtenerRangoFechaClave(hoyClave);
    const { data, error } = await queryConNegocio(
      supabase
        .from('arqueos')
        .select('*')
        .gte('created_at', inicio.toISOString())
        .lte('created_at', fin.toISOString())
        .order('created_at', { ascending: false })
        .limit(1),
      negocioId
    );

    if (error) {
      throw new Error(error.message);
    }

    return (data || [])[0] ?? null;
  };

  const pedidoEsDelDiaHoy = (pedido) =>
    formatearClaveFecha(new Date(pedido.created_at || 0)) === hoyClave;

  const abrirModalPedidoBloqueadoArqueo = (mensaje) => {
    setMensajePedidoBloqueadoArqueo(mensaje);
    setModalPedidoBloqueadoArqueoAbierto(true);
  };

  const cerrarModalPedidoBloqueadoArqueo = () => {
    setModalPedidoBloqueadoArqueoAbierto(false);
    setMensajePedidoBloqueadoArqueo(null);
  };

  const verificarArqueoDelDiaBloqueaPedido = async (pedido, mensajeBloqueo) => {
    const debeVerificar =
      pedido.tipo === 'presencial' ? filtroFecha === hoyClave : pedidoEsDelDiaHoy(pedido);

    if (!debeVerificar) {
      return false;
    }

    const arqueo = await cargarArqueoDelDia();
    if (arqueo) {
      abrirModalPedidoBloqueadoArqueo(mensajeBloqueo);
      return true;
    }

    return false;
  };

  const intentarEliminarPedido = async (pedido) => {
    try {
      const bloqueado = await verificarArqueoDelDiaBloqueaPedido(
        pedido,
        pedido.tipo === 'presencial'
          ? MENSAJE_ELIMINAR_VENTA_BLOQUEADA_ARQUEO
          : MENSAJE_ELIMINAR_PEDIDO_BLOQUEADO_ARQUEO
      );
      if (bloqueado) return;
    } catch (err) {
      abrirModalPedidoBloqueadoArqueo(
        err.message || 'No se pudo verificar el arqueo del día.'
      );
      return;
    }

    setPedidoPendienteEliminar(pedido);
    setModalAutorizacionPinEliminarPedidoAbierto(true);
  };

  const cerrarAutorizacionPinEliminarPedido = () => {
    setModalAutorizacionPinEliminarPedidoAbierto(false);
    setPedidoPendienteEliminar(null);
  };

  const onAutorizadoEliminarPedido = ({ autorizado_por }) => {
    const pedido = pedidoPendienteEliminar;
    if (pedido?.id) {
      void eliminarPedido(pedido.id, autorizado_por ?? null);
    }
  };

  const tituloAutorizacionPinEliminarPedido =
    pedidoPendienteEliminar?.tipo === 'presencial'
      ? 'Autoriza la eliminación de la venta'
      : 'Autoriza la eliminación del pedido';

  const intentarEditarPedido = async (pedido) => {
    try {
      const bloqueado = await verificarArqueoDelDiaBloqueaPedido(
        pedido,
        pedido.tipo === 'presencial'
          ? MENSAJE_EDITAR_VENTA_BLOQUEADA_ARQUEO
          : MENSAJE_EDITAR_PEDIDO_BLOQUEADO_ARQUEO
      );
      if (bloqueado) return;
    } catch (err) {
      abrirModalPedidoBloqueadoArqueo(
        err.message || 'No se pudo verificar el arqueo del día.'
      );
      return;
    }

    await iniciarEdicionPedido(pedido);
  };

  const intentarAvanzarPedido = async (id) => {
    const pedido = pedidos.find((item) => item.id === id);
    if (!pedido) return;

    try {
      const bloqueado = await verificarArqueoDelDiaBloqueaPedido(
        pedido,
        MENSAJE_AVANZAR_PEDIDO_BLOQUEADO_ARQUEO
      );
      if (bloqueado) return;
    } catch (err) {
      abrirModalPedidoBloqueadoArqueo(
        err.message || 'No se pudo verificar el arqueo del día.'
      );
      return;
    }

    await avanzarPedido(id);
  };

  const intentarRetrocederPedido = async (id) => {
    const pedido = pedidos.find((item) => item.id === id);
    if (!pedido) return;

    try {
      const bloqueado = await verificarArqueoDelDiaBloqueaPedido(
        pedido,
        MENSAJE_RETROCEDER_PEDIDO_BLOQUEADO_ARQUEO
      );
      if (bloqueado) return;
    } catch (err) {
      abrirModalPedidoBloqueadoArqueo(
        err.message || 'No se pudo verificar el arqueo del día.'
      );
      return;
    }

    await retrocederPedido(id);
  };

  const ejecutarGuardadoPedido = async (detallePedido, esPresencial) => {
    try {
      const arqueo = await cargarArqueoDelDia();
      if (arqueo) {
        abrirModalPedidoBloqueadoArqueo(
          esPresencial
            ? MENSAJE_REGISTRAR_VENTA_BLOQUEADA_ARQUEO
            : MENSAJE_GUARDAR_PEDIDO_BLOQUEADO_ARQUEO
        );
        return;
      }
    } catch (err) {
      abrirModalPedidoBloqueadoArqueo(
        err.message || 'No se pudo verificar el arqueo del día.'
      );
      return;
    }

    const resumen = resumenProductos(form.lineas, productos, variantesCtx);
    const statusPresencial = esPresencial ? determinarStatusInicialPresencial() : null;

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
      forma_pago: normalizarFormaPagoPayload(form.formaPago),
      referencia: esPresencial ? form.referencia.trim() || null : null,
      created_by: usuario?.id ?? null,
      ...(esPresencial
        ? {
            status_cocina1: statusPresencial.status_cocina1,
            status_cocina2: statusPresencial.status_cocina2,
          }
        : {}),
    };

    const optimisticId = crearIdOptimisticoPedido();
    const ahora = new Date().toISOString();
    const payloadInsert = payloadConNegocio(payload, negocioId);
    const pedidoOptimista = {
      id: optimisticId,
      ...payloadInsert,
      created_at: ahora,
      updated_at: ahora,
    };

    guardarPedidoPendienteSync({
      localId: optimisticId,
      payload: payloadInsert,
      pedidoOptimista,
      negocioId,
    });

    setPedidos((prev) => ordenarPedidosDesc([...prev, pedidoOptimista]));

    if (esPresencial) {
      setResumenVenta({
        producto: resumen,
        total: detallePedido.total,
        referencia: form.referencia.trim(),
        formaPago: form.formaPago,
      });
    }

    persistenciaCarritoPausadaRef.current = true;
    resetFormPedido(modo);

    const { data, error } = await supabase
      .from('pedidos')
      .insert(payloadInsert)
      .select()
      .single();

    if (error || !data) {
      setErrorGuardarPedido(
        'Pedido guardado localmente. Se sincronizará cuando haya conexión.'
      );
      persistenciaCarritoPausadaRef.current = false;
      return;
    }

    eliminarPedidoPendienteSync(optimisticId);
    setErrorGuardarPedido(null);
    persistenciaCarritoPausadaRef.current = false;

    setPedidos((prev) => {
      const sinOptimistico = prev.filter((pedido) => pedido.id !== optimisticId);
      const existe = sinOptimistico.some((pedido) => pedido.id === data.id);

      if (existe) {
        return ordenarPedidosDesc(sinOptimistico);
      }

      return ordenarPedidosDesc([...sinOptimistico, data]);
    });
  };

  const abrirModalRetiro = async () => {
    if (!negocioId) return;

    setErrorRetiro(null);
    setMensajeRetiroBloqueado(null);

    try {
      const arqueo = await cargarArqueoDelDia();
      if (arqueo) {
        setMensajeRetiroBloqueado(MENSAJE_RETIRO_BLOQUEADO_ARQUEO);
        setModalRetiroBloqueadoAbierto(true);
        return;
      }

      setRetiroForm({ monto: '', motivo: '' });
      setModalRetiroAbierto(true);
    } catch (err) {
      setMensajeRetiroBloqueado(err.message || 'No se pudo verificar el arqueo del día.');
      setModalRetiroBloqueadoAbierto(true);
    }
  };

  useEffect(() => {
    if (!negocioId) {
      setFondoFijoDelDia(0);
      setFondoFijoHoyId(null);
      return undefined;
    }

    let activo = true;

    cargarFondoFijoDelDia()
      .then((fondoFijo) => {
        if (!activo) return;
        setFondoFijoDelDia(fondoFijo.monto);
        setFondoFijoHoyId(fondoFijo.id);
      })
      .catch(() => {
        if (!activo) return;
        setFondoFijoDelDia(0);
        setFondoFijoHoyId(null);
      });

    return () => {
      activo = false;
    };
  }, [negocioId, hoyClave]);

  const abrirModalFondoFijo = async () => {
    setModalFondoFijoAbierto(true);
    setFondoFijoForm({ monto: '' });
    setErrorFondoFijo(null);
    setConfirmarEliminarFondoFijo(false);
    setCargandoFondoFijoDatos(true);

    try {
      const fondoFijo = await cargarFondoFijoDelDia();
      setFondoFijoDelDia(fondoFijo.monto);
      setFondoFijoHoyId(fondoFijo.id);
    } catch (err) {
      setErrorFondoFijo(err.message || 'No se pudo cargar el fondo fijo del día.');
      setFondoFijoDelDia(0);
      setFondoFijoHoyId(null);
    } finally {
      setCargandoFondoFijoDatos(false);
    }
  };

  const cerrarModalFondoFijo = () => {
    setModalFondoFijoAbierto(false);
    setFondoFijoForm({ monto: '' });
    setErrorFondoFijo(null);
    setConfirmarEliminarFondoFijo(false);
  };

  const handleFondoFijoFormChange = (e) => {
    setFondoFijoForm({ monto: e.target.value });
  };

  const fondoFijoFormValido = Number.parseFloat(fondoFijoForm.monto) > 0;

  const tituloAutorizacionPinFondoFijo =
    accionPendienteAutorizacionFondoFijo === 'eliminar'
      ? 'Autoriza la eliminación del fondo fijo'
      : 'Autoriza el fondo fijo';

  const cerrarAutorizacionPinFondoFijo = () => {
    setModalAutorizacionPinFondoFijoAbierto(false);
    setAccionPendienteAutorizacionFondoFijo(null);
  };

  const solicitarAutorizacionGuardarFondoFijo = (e) => {
    e.preventDefault();
    if (!fondoFijoFormValido || !negocioId || guardandoFondoFijo || fondoFijoHoyId) return;
    setAccionPendienteAutorizacionFondoFijo('guardar');
    setModalAutorizacionPinFondoFijoAbierto(true);
  };

  const solicitarAutorizacionEliminarFondoFijo = () => {
    if (!negocioId || !fondoFijoHoyId || guardandoFondoFijo) return;
    setAccionPendienteAutorizacionFondoFijo('eliminar');
    setModalAutorizacionPinFondoFijoAbierto(true);
  };

  const onAutorizadoFondoFijo = () => {
    const accion = accionPendienteAutorizacionFondoFijo;
    setAccionPendienteAutorizacionFondoFijo(null);

    if (accion === 'guardar') {
      void handleGuardarFondoFijo({ preventDefault: () => {} });
    } else if (accion === 'eliminar') {
      void intentarEliminarFondoFijo();
    }
  };

  const handleGuardarFondoFijo = async (e) => {
    e.preventDefault();
    if (!fondoFijoFormValido || !negocioId || guardandoFondoFijo || fondoFijoHoyId) return;

    setGuardandoFondoFijo(true);
    setErrorFondoFijo(null);

    const { data, error } = await supabase
      .from('fondos_fijos')
      .insert(
        payloadConNegocio(
          {
            monto: Number.parseFloat(fondoFijoForm.monto),
            usuario: usuarioSesionActual(session),
          },
          negocioId
        )
      )
      .select('id, monto')
      .single();

    setGuardandoFondoFijo(false);

    if (error) {
      setErrorFondoFijo(error.message);
      return;
    }

    setFondoFijoDelDia(redondearMoneda(Number(data?.monto) || 0));
    setFondoFijoHoyId(data?.id ?? null);
    setFondoFijoForm({ monto: '' });
  };

  const handleEliminarFondoFijo = async () => {
    if (!negocioId || !fondoFijoHoyId || guardandoFondoFijo) return;

    setGuardandoFondoFijo(true);
    setErrorFondoFijo(null);

    try {
      const arqueo = await cargarArqueoDelDia();
      if (arqueo) {
        setErrorFondoFijo(MENSAJE_FONDO_FIJO_BLOQUEADO_ARQUEO);
        setConfirmarEliminarFondoFijo(false);
        return;
      }

      const { error } = await queryConNegocio(
        supabase.from('fondos_fijos').delete().eq('id', fondoFijoHoyId),
        negocioId
      );

      if (error) {
        setErrorFondoFijo(error.message);
        return;
      }

      setFondoFijoDelDia(0);
      setFondoFijoHoyId(null);
      setConfirmarEliminarFondoFijo(false);
    } catch (err) {
      setErrorFondoFijo(err.message || 'No se pudo verificar el arqueo del día.');
      setConfirmarEliminarFondoFijo(false);
    } finally {
      setGuardandoFondoFijo(false);
    }
  };

  const intentarEliminarFondoFijo = async () => {
    if (!negocioId || !fondoFijoHoyId || guardandoFondoFijo) return;

    setErrorFondoFijo(null);
    setConfirmarEliminarFondoFijo(false);
    setGuardandoFondoFijo(true);

    try {
      const arqueo = await cargarArqueoDelDia();
      if (arqueo) {
        setErrorFondoFijo(MENSAJE_FONDO_FIJO_BLOQUEADO_ARQUEO);
        return;
      }

      setConfirmarEliminarFondoFijo(true);
    } catch (err) {
      setErrorFondoFijo(err.message || 'No se pudo verificar el arqueo del día.');
    } finally {
      setGuardandoFondoFijo(false);
    }
  };

  const abrirModalArqueo = async () => {
    setModalArqueoAbierto(true);
    setArqueoContado(crearArqueoContadoVacio());
    setArqueoContadoCampoEnfocado(null);
    setArqueoDelDiaGuardado(null);
    setErrorArqueo(null);
    setCargandoArqueoDatos(true);

    const errores = [];
    const [retirosResult, fondoResult, arqueoResult] = await Promise.allSettled([
      cargarRetirosDelDia(),
      cargarFondoFijoDelDia(),
      cargarArqueoDelDia(),
    ]);

    if (arqueoResult.status === 'fulfilled' && arqueoResult.value) {
      const arqueo = arqueoResult.value;
      setArqueoDelDiaGuardado(arqueo);
      setArqueoContado(crearArqueoContadoDesdeRegistro(arqueo));
      setRetirosDelDia(redondearMoneda(Number(arqueo.retiros_del_dia) || 0));
      setFondoFijoDelDia(redondearMoneda(Number(arqueo.fondo_fijo_del_dia) || 0));
    } else {
      if (arqueoResult.status === 'rejected') {
        errores.push(
          arqueoResult.reason?.message || 'No se pudo verificar el arqueo del día.'
        );
      }

      if (retirosResult.status === 'fulfilled') {
        setRetirosDelDia(retirosResult.value);
      } else {
        setRetirosDelDia(0);
        errores.push(
          retirosResult.reason?.message || 'No se pudieron cargar los retiros del día.'
        );
      }

      if (fondoResult.status === 'fulfilled') {
        setFondoFijoDelDia(fondoResult.value.monto);
        setFondoFijoHoyId(fondoResult.value.id);
      } else {
        setFondoFijoDelDia(0);
        setFondoFijoHoyId(null);
        errores.push(
          fondoResult.reason?.message || 'No se pudo cargar el fondo fijo del día.'
        );
      }
    }

    if (errores.length > 0) {
      setErrorArqueo(errores.join(' '));
    }

    setCargandoArqueoDatos(false);
  };

  const cerrarModalArqueo = () => {
    setModalArqueoAbierto(false);
    setArqueoContado(crearArqueoContadoVacio());
    setArqueoContadoCampoEnfocado(null);
    setArqueoDelDiaGuardado(null);
    setErrorArqueo(null);
  };

  const handleArqueoContadoChange = (formaPago, value) => {
    setArqueoContado((prev) => ({
      ...prev,
      [formaPago]: sanitizarEntradaContadoArqueo(value),
    }));
  };

  const handleArqueoContadoFocus = (formaPago) => {
    setArqueoContadoCampoEnfocado(formaPago);
    setArqueoContado((prev) => ({ ...prev, [formaPago]: '' }));
  };

  const handleArqueoContadoBlur = (formaPago) => {
    setArqueoContadoCampoEnfocado((prev) => (prev === formaPago ? null : prev));
    setArqueoContado((prev) => {
      const raw = prev[formaPago];

      if (raw === '' || raw === null || raw === undefined) {
        return { ...prev, [formaPago]: '0' };
      }

      return { ...prev, [formaPago]: String(normalizarMontoContadoArqueo(raw)) };
    });
  };

  const cerrarAutorizacionPinArqueo = () => {
    setModalAutorizacionPinArqueoAbierto(false);
  };

  const solicitarAutorizacionGuardarArqueo = (e) => {
    e.preventDefault();
    if (
      !arqueoContadoValido ||
      !negocioId ||
      guardandoArqueo ||
      cargandoArqueoDatos ||
      arqueoDelDiaGuardado
    ) {
      return;
    }
    setModalAutorizacionPinArqueoAbierto(true);
  };

  const onAutorizadoArqueo = () => {
    void handleGuardarArqueo({ preventDefault: () => {} });
  };

  const handleGuardarArqueo = async (e) => {
    e.preventDefault();
    if (
      !arqueoContadoValido ||
      !negocioId ||
      guardandoArqueo ||
      cargandoArqueoDatos ||
      arqueoDelDiaGuardado
    )
      return;

    setGuardandoArqueo(true);
    setErrorArqueo(null);

    const efectivoContado = Number.parseFloat(arqueoContado.efectivo);
    const tarjetaContado = Number.parseFloat(arqueoContado.tarjeta);
    const transferenciaContado = Number.parseFloat(arqueoContado.transferencia);
    const linkContado = Number.parseFloat(arqueoContado.link_pago);

    const { error } = await supabase.from('arqueos').insert(
      payloadConNegocio(
        {
          usuario: usuarioSesionActual(session),
          efectivo_sistema: arqueoSistema.efectivo,
          efectivo_contado: efectivoContado,
          tarjeta_sistema: arqueoSistema.tarjeta,
          tarjeta_contado: tarjetaContado,
          transferencia_sistema: arqueoSistema.transferencia,
          transferencia_contado: transferenciaContado,
          link_sistema: arqueoSistema.link_pago,
          link_contado: linkContado,
          total_sistema: arqueoSistema.total,
          total_contado: totalArqueoContado,
          diferencia: diferenciaArqueoTotal,
          retiros_del_dia: retirosDelDia,
          fondo_fijo_del_dia: fondoFijoDelDia,
        },
        negocioId
      )
    );

    setGuardandoArqueo(false);

    if (error) {
      setErrorArqueo(error.message);
      return;
    }

    cerrarModalArqueo();
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

    const mostrarAgrupacionPorFecha = pedidosAgrupados.length > 1;

    return pedidosAgrupados.map(({ clave, etiqueta, pedidos: pedidosGrupo, totalDelDia }) => {
      const esGrupoHistorico = clave !== hoyClave;
      const usarVistaReporte = esGrupoHistorico || mostrarAgrupacionPorFecha;

      return (
        <div
          key={clave}
          className={`pedidos-grupo${
            mostrarAgrupacionPorFecha ? ' pedidos-grupo-separado' : ''
          }`}
        >
          {usarVistaReporte ? (
            <>
              <div
                className="pedidos-grupo-encabezado dashboard-grupo-encabezado"
                style={
                  esMobileDashboard
                    ? {
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.45rem',
                        textAlign: 'center',
                      }
                    : undefined
                }
              >
                <span
                  className="pedidos-grupo-encabezado-linea dashboard-grupo-encabezado-fecha"
                  style={
                    esMobileDashboard
                      ? {
                          display: 'block',
                          textAlign: 'center',
                        }
                      : undefined
                  }
                >
                  <span className="pedidos-grupo-encabezado-separador" aria-hidden="true">
                    ──
                  </span>
                  {etiqueta}
                  <span className="pedidos-grupo-encabezado-separador" aria-hidden="true">
                    ──
                  </span>
                </span>
                <span
                  className="pedidos-grupo-encabezado-total dashboard-grupo-encabezado-total"
                  style={
                    esMobileDashboard
                      ? {
                          display: 'block',
                          alignSelf: 'stretch',
                          width: '100%',
                          textAlign: 'right',
                        }
                      : undefined
                  }
                >
                  Total del día: {formatearMoneda(totalDelDia)}
                </span>
              </div>
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
                        variantesCtx
                      )
                    : 0;

                  if (editandoPedidoId === pedido.id && pedidoEditForm) {
                    return (
                      <div key={pedido.id} className="pedidos-reporte-editando">
                        {renderPedidoEnEdicion(pedido, totalEdicionHistorico)}
                      </div>
                    );
                  }

                  return (
                    <div key={pedido.id} className="pedidos-reporte-fila">
                      <span className="reporte-hora">
                        {formatearHoraPedidoLista(pedido.created_at)}
                      </span>
                      <span className="reporte-cliente">
                        {formatearNombreClientePedido(pedido)}
                      </span>
                      <span className="reporte-productos">
                        {formatearProductosPedidoReporteHistorico(pedido)}
                      </span>
                      <span className="reporte-total">
                        {formatearMoneda(pedido.total)}
                      </span>
                      <span className="reporte-acciones">
                        <button
                          type="button"
                          className="editar-btn"
                          disabled={otroEditando}
                          onClick={() => intentarEditarPedido(pedido)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="eliminar-btn"
                          disabled={otroEditando}
                          onClick={() => intentarEliminarPedido(pedido)}
                        >
                          Eliminar
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
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
                              variantesCtx
                            )
                          : 0;

                        if (estaEditando && pedidoEditForm) {
                          return renderPedidoEnEdicion(pedido, totalEdicion);
                        }

                        return (
                          <article key={pedido.id} className="pedido-tarjeta">
                            <div className="pedido-tarjeta-cabecera">
                              <h2 className="pedido-cliente">
                                {formatearNombreClientePedido(pedido)}
                              </h2>
                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'flex-end',
                                  flexShrink: 0,
                                  gap: '0.15rem',
                                }}
                              >
                                {pedido.folio !== null && (
                                  <span
                                    style={{
                                      fontSize: '0.75rem',
                                      fontWeight: 500,
                                      color: '#64748b',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {pedido.folio}
                                  </span>
                                )}
                                <time
                                  className="pedido-hora"
                                  dateTime={pedido.created_at}
                                >
                                  {formatearHoraPedido(pedido.created_at)}
                                </time>
                              </div>
                            </div>
                            <DesglosePedido
                              pedido={pedido}
                              productos={productos}
                              variantesCtx={variantesCtx}
                            />
                            {etiquetaFormaPago(pedido.forma_pago) && (
                              <p className="pedido-forma-pago">
                                Forma de pago: {etiquetaFormaPago(pedido.forma_pago)}
                              </p>
                            )}
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
                                    onClick={() => intentarEditarPedido(pedido)}
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    className="eliminar-btn"
                                    disabled={otroEditando}
                                    onClick={() => intentarEliminarPedido(pedido)}
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
                                            onClick={() => intentarRetrocederPedido(pedido.id)}
                                          >
                                            Retroceder
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          className="avanzar-btn"
                                          disabled={esFinal || otroEditando}
                                          onClick={() => intentarAvanzarPedido(pedido.id)}
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
                                      onClick={() => intentarEditarPedido(pedido)}
                                    >
                                      Editar
                                    </button>
                                    <button
                                      type="button"
                                      className="eliminar-btn"
                                      disabled={otroEditando}
                                      onClick={() => intentarEliminarPedido(pedido)}
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

  const arqueoModalSoloLectura = Boolean(arqueoDelDiaGuardado);
  const estiloSeccionesEntregaDobleWeb = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '1rem',
    alignItems: 'stretch',
    width: '100vw',
    maxWidth: '100vw',
    marginLeft: 'calc(50% - 50vw)',
    marginRight: 'calc(50% - 50vw)',
    paddingLeft: '2rem',
    paddingRight: '2rem',
    boxSizing: 'border-box',
  };
  const estiloSeccionEntregaColumnaWeb = {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    marginBottom: 0,
    maxHeight: 'calc(100vh - 14rem)',
  };
  const estiloSeccionEntregaListaScrollWeb = {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
  };

  return (
    <div className="dashboard">
      {seccion === 'catalogo' ? (
        <DashboardHeaderReservaMovil nombreNegocio={nombreNegocio} />
      ) : (
      <header className="dashboard-header">
        <div className="dashboard-header-inner">
          <div className="header-top" style={{ marginBottom: '0.5rem' }}>
            <div style={estiloContenedorNombreNegocioHeader()}>
              <h1 style={estiloNombreNegocioTituloPrincipal(esMobileDashboard)}>
                {nombreNegocio || '—'}
              </h1>
            </div>
          </div>
          <div className="header-stats">
            <div className="header-stat header-stat-principal">
              <span className="header-stat-label">Ventas totales hoy</span>
              <span className="header-stat-fecha">
                {formatearFechaCompleta(new Date(fechaActual))}
              </span>
              <span className="header-stat-value header-stat-value-total">
                {formatearMoneda(totalVentasHoyTotal)}
              </span>
              <p className="header-stat-desglose">
                Caja: {formatearMoneda(totalVentasHoyCaja)} | WhatsApp:{' '}
                {formatearMoneda(totalVentasHoyWhatsApp)}
              </p>
              <p className="header-stat-desglose header-stat-desglose-whatsapp">
                🛵 Domicilio: {formatearMoneda(totalVentasHoyDomicilio)} | 🏪 Para recoger:{' '}
                {formatearMoneda(totalVentasHoySucursal)}
              </p>
              <div className="header-acciones-caja">
                <button
                  type="button"
                  className="header-retiro-btn"
                  onClick={abrirModalFondoFijo}
                >
                  Fondo fijo
                </button>
                <button
                  type="button"
                  className="header-retiro-btn"
                  onClick={abrirModalRetiro}
                >
                  Retiro de efectivo
                </button>
                <button
                  type="button"
                  className="header-retiro-btn"
                  onClick={abrirModalArqueo}
                >
                  Arqueo de caja
                </button>
              </div>
            </div>
          </div>
        </div>
        <BotonCerrarSesion />
      </header>
      )}

      {modalRetiroBloqueadoAbierto ? (
        <div
          className="retiro-modal-overlay"
          onClick={cerrarModalRetiroBloqueado}
          role="presentation"
        >
          <div
            className="retiro-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="retiro-bloqueado-modal-titulo"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="retiro-bloqueado-modal-titulo" className="retiro-modal-titulo">
              Retiro de efectivo
            </h2>
            <p className="retiro-modal-error" role="alert">
              {mensajeRetiroBloqueado}
            </p>
            <div className="retiro-modal-acciones">
              <button
                type="button"
                className="retiro-modal-cancelar"
                onClick={cerrarModalRetiroBloqueado}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modalPedidoBloqueadoArqueoAbierto ? (
        <div
          className="retiro-modal-overlay"
          onClick={cerrarModalPedidoBloqueadoArqueo}
          role="presentation"
        >
          <div
            className="retiro-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pedido-bloqueado-arqueo-modal-titulo"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="pedido-bloqueado-arqueo-modal-titulo" className="retiro-modal-titulo">
              Arqueo de caja
            </h2>
            <p className="retiro-modal-error" role="alert">
              {mensajePedidoBloqueadoArqueo}
            </p>
            <div className="retiro-modal-acciones">
              <button
                type="button"
                className="retiro-modal-cancelar"
                onClick={cerrarModalPedidoBloqueadoArqueo}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modalRetiroAbierto ? (
        <div
          className="retiro-modal-overlay"
          onClick={cerrarModalRetiro}
          role="presentation"
        >
          <div
            className="retiro-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="retiro-modal-titulo"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="retiro-modal-titulo" className="retiro-modal-titulo">
              Retiro de efectivo
            </h2>
            <form onSubmit={solicitarAutorizacionGuardarRetiro}>
              <div className="retiro-modal-campo">
                <label htmlFor="retiro-monto">Monto</label>
                <input
                  id="retiro-monto"
                  name="monto"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={retiroForm.monto}
                  onChange={handleRetiroFormChange}
                  required
                />
              </div>
              <div className="retiro-modal-campo">
                <label htmlFor="retiro-motivo">Motivo</label>
                <input
                  id="retiro-motivo"
                  name="motivo"
                  type="text"
                  value={retiroForm.motivo}
                  onChange={handleRetiroFormChange}
                  required
                />
              </div>
              {errorRetiro ? (
                <p className="retiro-modal-error" role="alert">
                  {errorRetiro}
                </p>
              ) : null}
              <div className="retiro-modal-acciones">
                <button
                  type="button"
                  className="retiro-modal-cancelar"
                  onClick={cerrarModalRetiro}
                  disabled={guardandoRetiro}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="retiro-modal-guardar"
                  disabled={!retiroFormValido || guardandoRetiro || !negocioId}
                >
                  {guardandoRetiro ? 'Guardando...' : 'Guardar retiro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ModalAutorizacionPin
        visible={modalAutorizacionPinRetiroAbierto}
        titulo="Autoriza el retiro de efectivo"
        onClose={cerrarAutorizacionPinRetiro}
        onAutorizado={onAutorizadoRetiro}
      />

      {modalFondoFijoAbierto ? (
        <div
          className="retiro-modal-overlay"
          onClick={cerrarModalFondoFijo}
          role="presentation"
        >
          <div
            className="retiro-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fondo-fijo-modal-titulo"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="fondo-fijo-modal-titulo" className="retiro-modal-titulo">
              Fondo fijo
            </h2>
            {cargandoFondoFijoDatos ? (
              <p className="arqueo-modal-cargando">Cargando fondo fijo del día...</p>
            ) : fondoFijoHoyId ? (
              <>
                <p className="arqueo-modal-descripcion">
                  Fondo fijo registrado hoy: {formatearMoneda(fondoFijoDelDia)}
                </p>
                {errorFondoFijo ? (
                  <p className="retiro-modal-error" role="alert">
                    {errorFondoFijo}
                  </p>
                ) : null}
                {confirmarEliminarFondoFijo ? (
                  <div className="retiro-modal-acciones">
                    <p className="arqueo-modal-descripcion">¿Eliminar el fondo fijo de hoy?</p>
                    <button
                      type="button"
                      className="retiro-modal-cancelar"
                      onClick={() => setConfirmarEliminarFondoFijo(false)}
                      disabled={guardandoFondoFijo}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="retiro-modal-guardar"
                      onClick={handleEliminarFondoFijo}
                      disabled={guardandoFondoFijo || !negocioId}
                    >
                      {guardandoFondoFijo ? 'Eliminando...' : 'Confirmar'}
                    </button>
                  </div>
                ) : (
                  <div className="retiro-modal-acciones">
                    <button
                      type="button"
                      className="retiro-modal-cancelar"
                      onClick={cerrarModalFondoFijo}
                      disabled={guardandoFondoFijo}
                    >
                      Cerrar
                    </button>
                    <button
                      type="button"
                      className="retiro-modal-guardar"
                      onClick={solicitarAutorizacionEliminarFondoFijo}
                      disabled={guardandoFondoFijo || !negocioId}
                    >
                      Eliminar
                    </button>
                  </div>
                )}
              </>
            ) : (
              <form onSubmit={solicitarAutorizacionGuardarFondoFijo}>
                <div className="retiro-modal-campo">
                  <label htmlFor="fondo-fijo-monto">Monto</label>
                  <input
                    id="fondo-fijo-monto"
                    name="monto"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={fondoFijoForm.monto}
                    onChange={handleFondoFijoFormChange}
                    required
                  />
                </div>
                {errorFondoFijo ? (
                  <p className="retiro-modal-error" role="alert">
                    {errorFondoFijo}
                  </p>
                ) : null}
                <div className="retiro-modal-acciones">
                  <button
                    type="button"
                    className="retiro-modal-cancelar"
                    onClick={cerrarModalFondoFijo}
                    disabled={guardandoFondoFijo}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="retiro-modal-guardar"
                    disabled={!fondoFijoFormValido || guardandoFondoFijo || !negocioId}
                  >
                    {guardandoFondoFijo ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}

      <ModalAutorizacionPin
        visible={modalAutorizacionPinFondoFijoAbierto}
        titulo={tituloAutorizacionPinFondoFijo}
        onClose={cerrarAutorizacionPinFondoFijo}
        onAutorizado={onAutorizadoFondoFijo}
      />

      {modalArqueoAbierto ? (
        <div
          className="retiro-modal-overlay"
          onClick={cerrarModalArqueo}
          role="presentation"
        >
          <div
            className="retiro-modal arqueo-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="arqueo-modal-titulo"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="arqueo-modal-titulo" className="retiro-modal-titulo">
              Arqueo de caja
            </h2>
            <p className="arqueo-modal-descripcion">
              Ventas totales del día:{' '}
              {formatearMoneda(
                (arqueoModalSoloLectura
                  ? Number(arqueoDelDiaGuardado.total_sistema) || 0
                  : arqueoSistema.total) -
                  (arqueoModalSoloLectura
                    ? Number(arqueoDelDiaGuardado.fondo_fijo_del_dia) || 0
                    : fondoFijoDelDia) +
                  (arqueoModalSoloLectura
                    ? Number(arqueoDelDiaGuardado.retiros_del_dia) || 0
                    : retirosDelDia)
              )}
            </p>
            <p className="arqueo-modal-descripcion">
              Fondo fijo del día:{' '}
              {formatearMoneda(
                arqueoModalSoloLectura
                  ? Number(arqueoDelDiaGuardado.fondo_fijo_del_dia) || 0
                  : fondoFijoDelDia
              )}{' '}
              | Retiros del día:{' '}
              {formatearMoneda(
                arqueoModalSoloLectura
                  ? Number(arqueoDelDiaGuardado.retiros_del_dia) || 0
                  : retirosDelDia
              )}
            </p>
            {cargandoArqueoDatos ? (
              <p className="arqueo-modal-cargando">Calculando datos del día...</p>
            ) : (
            <form onSubmit={solicitarAutorizacionGuardarArqueo}>
              <div className="arqueo-modal-tabla">
                <div className="arqueo-modal-tabla-encabezado">
                  <span>Forma</span>
                  <span>Sistema</span>
                  <span>Contado</span>
                  <span>Diferencia</span>
                </div>
                {FORMAS_PAGO.map(({ value, label }) => {
                  const sistema = arqueoModalSoloLectura
                    ? Number(arqueoDelDiaGuardado[obtenerCampoSistemaArqueo(value)]) || 0
                    : arqueoSistema[value];
                  const contado = Number.parseFloat(arqueoContado[value]);
                  const diferencia =
                    arqueoContado[value] === '' || !Number.isFinite(contado)
                      ? null
                      : redondearMoneda(contado - sistema);
                  const diferenciaFmt =
                    diferencia == null ? null : formatearDiferenciaArqueo(diferencia);

                  return (
                    <div key={value} className="arqueo-modal-fila">
                      <label htmlFor={`arqueo-contado-${value}`}>{label}</label>
                      <span className="arqueo-modal-sistema">{formatearMoneda(sistema)}</span>
                      <div className="arqueo-modal-contado">
                        <input
                          id={`arqueo-contado-${value}`}
                          type="text"
                          inputMode="decimal"
                          value={
                            arqueoModalSoloLectura
                              ? formatearContadoArqueoInput(arqueoContado[value])
                              : arqueoContadoCampoEnfocado === value
                                ? arqueoContado[value]
                                : formatearContadoArqueoInput(arqueoContado[value])
                          }
                          onFocus={() => handleArqueoContadoFocus(value)}
                          onBlur={() => handleArqueoContadoBlur(value)}
                          onChange={(e) => handleArqueoContadoChange(value, e.target.value)}
                          disabled={arqueoModalSoloLectura || guardandoArqueo}
                          required={!arqueoModalSoloLectura}
                        />
                      </div>
                      <span className={diferenciaFmt?.clase || 'arqueo-modal-diferencia'}>
                        {diferenciaFmt?.texto || '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="arqueo-modal-totales">
                <div className="arqueo-modal-total-fila">
                  <span>Total sistema</span>
                  <strong>
                    {formatearMoneda(
                      arqueoModalSoloLectura
                        ? Number(arqueoDelDiaGuardado.total_sistema) || 0
                        : arqueoSistema.total
                    )}
                  </strong>
                </div>
                <div className="arqueo-modal-total-fila">
                  <span>Total contado</span>
                  <strong>
                    {arqueoModalSoloLectura || arqueoContadoValido
                      ? formatearMoneda(
                          arqueoModalSoloLectura
                            ? Number(arqueoDelDiaGuardado.total_contado) || 0
                            : totalArqueoContado
                        )
                      : '—'}
                  </strong>
                </div>
                <div className="arqueo-modal-total-fila">
                  <span>Diferencia total</span>
                  <strong
                    className={
                      formatearDiferenciaArqueo(
                        arqueoModalSoloLectura
                          ? Number(arqueoDelDiaGuardado.diferencia) || 0
                          : diferenciaArqueoTotal
                      ).clase
                    }
                  >
                    {arqueoModalSoloLectura || arqueoContadoValido
                      ? formatearDiferenciaArqueo(
                          arqueoModalSoloLectura
                            ? Number(arqueoDelDiaGuardado.diferencia) || 0
                            : diferenciaArqueoTotal
                        ).texto
                      : '—'}
                  </strong>
                </div>
              </div>
              {arqueoModalSoloLectura ? (
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <div
                    className="reportes-arqueo-confirmar-eliminar"
                    style={{ textAlign: 'left' }}
                  >
                    <p className="retiro-modal-error" role="alert">
                      {MENSAJE_ARQUEO_DIA_EXISTENTE}
                    </p>
                  </div>
                </div>
              ) : null}
              {errorArqueo ? (
                <p className="retiro-modal-error" role="alert">
                  {errorArqueo}
                </p>
              ) : null}
              <div className="retiro-modal-acciones">
                <button
                  type="button"
                  className="retiro-modal-cancelar"
                  onClick={cerrarModalArqueo}
                  disabled={guardandoArqueo}
                >
                  Cancelar
                </button>
                {!arqueoModalSoloLectura ? (
                  <button
                    type="submit"
                    className="retiro-modal-guardar"
                    disabled={
                      !arqueoContadoValido ||
                      guardandoArqueo ||
                      cargandoArqueoDatos ||
                      !negocioId ||
                      diferenciaArqueoTotal !== 0 ||
                      totalArqueoContado <= 0
                    }
                  >
                    {guardandoArqueo ? 'Guardando...' : 'Guardar arqueo'}
                  </button>
                ) : null}
              </div>
              {!arqueoModalSoloLectura && totalArqueoContado <= 0 ? (
                <p
                  className="retiro-modal-error"
                  role="alert"
                  style={{ textAlign: 'center', marginTop: '0.75rem' }}
                >
                  Debes ingresar los montos contados antes de guardar el arqueo.
                </p>
              ) : null}
              {!arqueoModalSoloLectura && diferenciaArqueoTotal !== 0 ? (
                <p
                  className="retiro-modal-error"
                  role="alert"
                  style={{ textAlign: 'center', marginTop: '0.75rem' }}
                >
                  La diferencia debe ser $0.00 para guardar el arqueo.
                </p>
              ) : null}
            </form>
            )}
          </div>
        </div>
      ) : null}

      <ModalAutorizacionPin
        visible={modalAutorizacionPinArqueoAbierto}
        titulo="Autoriza el arqueo de caja"
        onClose={cerrarAutorizacionPinArqueo}
        onAutorizado={onAutorizadoArqueo}
      />

      <ModalAutorizacionPin
        visible={modalAutorizacionPinEliminarPedidoAbierto}
        titulo={tituloAutorizacionPinEliminarPedido}
        onClose={cerrarAutorizacionPinEliminarPedido}
        onAutorizado={onAutorizadoEliminarPedido}
      />

      <main className="dashboard-main">
        <DashboardNav activo={seccion} rol={rol} />

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
                <p className="venta-resumen-cliente">
                  Cliente:{' '}
                  {formatearNombreClientePedido({
                    cliente: CLIENTE_PUBLICO,
                    referencia: resumenVenta.referencia,
                  })}
                </p>
                {etiquetaFormaPago(resumenVenta.formaPago) && (
                  <p className="venta-resumen-forma-pago">
                    Forma de pago: {etiquetaFormaPago(resumenVenta.formaPago)}
                  </p>
                )}
                <p className="venta-resumen-productos">{resumenVenta.producto}</p>
                <p className="venta-resumen-total">
                  Total: {formatearMoneda(resumenVenta.total)}
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
                        required
                      >
                        <option value="">Seleccionar tipo de entrega…</option>
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
                  {!esModoPresencial && tipoEntregaWhatsAppSeleccionado(form.tipoEntrega) && (
                    <div className="formulario-campo">
                      <label htmlFor="status">Estatus del pedido</label>
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
                  {esModoPresencial && (
                    <div className="formulario-campo">
                      <label htmlFor="referencia">Referencia / Nombre</label>
                      <input
                        id="referencia"
                        name="referencia"
                        type="text"
                        placeholder="Opcional"
                        value={form.referencia}
                        onChange={handleFormChange}
                      />
                    </div>
                  )}
                  <div className="formulario-campo">
                    <label htmlFor="formaPago">Forma de pago</label>
                    <select
                      id="formaPago"
                      name="formaPago"
                      value={form.formaPago}
                      onChange={handleFormChange}
                    >
                      {!esModoPresencial && <option value="">Sin especificar</option>}
                      {FORMAS_PAGO.map((forma) => (
                        <option key={forma.value} value={forma.value}>
                          {forma.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {productos.length > 0 && (
                  <SelectorProductosPedido
                    productos={productosOrdenados}
                    frecuenciaCategorias={frecuenciaCategoriasPedidos}
                    frecuenciaLista={frecuenciaLista}
                    categoriaActiva={categoriaPedidoActiva}
                    onCategoriaChange={setCategoriaPedidoActiva}
                    onAgregarProducto={agregarProductoAlPedido}
                  />
                )}

                <div className="pedido-lineas">
                  <div className="pedido-lineas-encabezado">
                    <span>Productos del pedido</span>
                  </div>
                  {lineasPedidoConProducto.map((linea, indice) => {
                    const productoSeleccionado = buscarProductoPorId(
                      productos,
                      linea.productoId
                    );
                    const subtotal = calcularSubtotal(
                      linea,
                      productos,
                      variantesCtx
                    );

                    return (
                      <div key={linea.id} className="pedido-linea-contenedor">
                        <div className="pedido-linea">
                          <div className="pedido-linea-numero">#{indice + 1}</div>
                          <div className="formulario-campo pedido-linea-producto">
                            <span className="pedido-linea-producto-label">Producto</span>
                            <span className="pedido-linea-producto-nombre">
                              {productoSeleccionado
                                ? `${productoSeleccionado.nombre} — ${formatearMoneda(productoSeleccionado.precio)} c/u`
                                : ''}
                            </span>
                          </div>
                          <div className="formulario-campo pedido-linea-cantidad">
                            <span className="pedido-linea-cantidad-label">Cantidad</span>
                            <div
                              className="cantidad-stepper"
                              role="group"
                              aria-label={`Cantidad producto ${indice + 1}`}
                            >
                              <button
                                type="button"
                                className="cantidad-stepper-btn"
                                onClick={() => ajustarCantidadLinea(linea.id, -1)}
                                disabled={(parseInt(linea.cantidad, 10) || 1) <= 1}
                                aria-label="Reducir cantidad"
                              >
                                −
                              </button>
                              <span
                                className="cantidad-stepper-valor"
                                id={`cantidad-${linea.id}`}
                              >
                                {parseInt(linea.cantidad, 10) || 1}
                              </span>
                              <button
                                type="button"
                                className="cantidad-stepper-btn"
                                onClick={() => ajustarCantidadLinea(linea.id, 1)}
                                aria-label="Aumentar cantidad"
                              >
                                +
                              </button>
                            </div>
                          </div>
                          <div className="formulario-campo pedido-linea-subtotal">
                            <label htmlFor={`subtotal-${linea.id}`}>Subtotal</label>
                            <input
                              id={`subtotal-${linea.id}`}
                              type="text"
                              value={subtotal > 0 ? formatearMoneda(subtotal) : ''}
                              readOnly
                            />
                          </div>
                          <button
                            type="button"
                            className="eliminar-linea-btn"
                            onClick={() => eliminarLinea(linea.id)}
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
                            variantesCtx={variantesCtx}
                            onToggleVariante={cambiarVarianteLinea}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="pedido-acciones">
                  <div className="pedido-total-pedido">
                    <span className="pedido-total-label">Total del pedido</span>
                    <span className="pedido-total-valor">{formatearMoneda(totalPedido)}</span>
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
                            Cambio: {formatearMoneda(cambio)}
                          </p>
                        ))}
                    </div>
                  )}
                  <div className="pedido-acciones-principales">
                    <button
                      type="button"
                      className="limpiar-pedido-btn"
                      onClick={limpiarPedidoCaptura}
                    >
                      Limpiar pedido
                    </button>
                    <button
                      type="submit"
                      className="guardar-btn"
                      disabled={productos.length === 0 || totalPedido <= 0}
                    >
                      {esModoPresencial ? 'Registrar venta' : 'Guardar pedido'}
                    </button>
                  </div>
                  {errorGuardarPedido ? (
                    <p className="formulario-error-guardar" role="alert">
                      {errorGuardarPedido}
                    </p>
                  ) : null}
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
                  Total del {formatearFechaCortaFiltro(filtroFecha)}:{' '}
                  {formatearMoneda(totalVentasFechaFiltro)}
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
                {esMobileDashboard && (
                  <nav className="catalogo-nav">
                    {SECCIONES_ENTREGA_DASHBOARD.map((seccionEntrega) => (
                      <button
                        key={seccionEntrega.key}
                        type="button"
                        className={`catalogo-tab${
                          tabEntregaWhatsAppMovil === seccionEntrega.key ? ' activo' : ''
                        }`}
                        onClick={() => setTabEntregaWhatsAppMovil(seccionEntrega.key)}
                      >
                        {seccionEntrega.key === TIPOS_ENTREGA.DOMICILIO
                          ? 'A domicilio'
                          : 'Para recoger'}
                      </button>
                    ))}
                  </nav>
                )}
                <div style={esMobileDashboard ? undefined : estiloSeccionesEntregaDobleWeb}>
                  {SECCIONES_ENTREGA_DASHBOARD.filter(
                    (seccionEntrega) =>
                      !esMobileDashboard || tabEntregaWhatsAppMovil === seccionEntrega.key
                  ).map((seccionEntrega) => {
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
                      style={esMobileDashboard ? undefined : estiloSeccionEntregaColumnaWeb}
                    >
                      <div className="seccion-entrega-cabecera">
                        <h2 className="seccion-entrega-titulo">{seccionEntrega.titulo}</h2>
                        <div className="seccion-entrega-resumen">
                          <span className="seccion-entrega-total">
                            Total: {formatearMoneda(totalSeccion)}
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
                      <div
                        className="dashboard-lista seccion-entrega-lista"
                        style={esMobileDashboard ? undefined : estiloSeccionEntregaListaScrollWeb}
                      >
                        {renderPedidosLista(
                          pedidosAgrupadosSeccion,
                          filtroSeccion,
                          pedidosTipo.length
                        )}
                      </div>
                    </section>
                  );
                })}
                </div>
              </>
            )}
          </>
        )}

        {seccion === 'catalogo' && (
          <>
            <nav className="catalogo-nav">
              {catalogoTabs.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={`catalogo-tab${catalogoTab === value ? ' activo' : ''}`}
                  onClick={() => {
                    setCatalogoTab(value);
                    resetProductoForm();
                    resetVarianteForm();
                    resetCategoriaVarianteForm();
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
                        {categoriasVariantesActivas(categoriasVariantes).length > 0 && (
                        <fieldset className="producto-variantes-activas">
                          <legend className="producto-variantes-activas-titulo">
                            Variantes disponibles para este producto
                          </legend>
                          <p className="producto-variantes-activas-descripcion">
                            Activa cada categoría y elige los items específicos que el
                            cliente podrá seleccionar al armar el pedido en modo WhatsApp.
                          </p>
                          <div className="producto-variantes-activas-categorias">
                            {categoriasVariantesActivas(categoriasVariantes).map((categoria) => {
                              const categoriaId = String(categoria.id);
                              const itemsCatalogo = catalogosVariantesOrdenados[categoriaId] || [];
                              const entry = productoForm.variantesActivas[categoriaId] || {
                                categoria: false,
                                items: [],
                              };

                              return (
                                <div key={categoriaId} className="producto-variantes-activas-grupo">
                                  <label className="producto-variantes-activas-categoria">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(entry.categoria)}
                                      onChange={() => toggleCategoriaVarianteProducto(categoriaId)}
                                      disabled={itemsCatalogo.length === 0}
                                    />
                                    <span>{categoria.nombre}</span>
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
                                              toggleItemVarianteProducto(categoriaId, item.id)
                                            }
                                          />
                                          <span>
                                            {item.nombre}
                                            {Number(item.precio) > 0
                                              ? ` (+${formatearMoneda(item.precio)})`
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
                        )}
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
                            {formatearMoneda(producto.precio)}
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

            {catalogoTab === TAB_CATEGORIAS_VARIANTES && (
              <>
                <section className="pedido-formulario">
                  <>
                    <h2 className="formulario-titulo">
                      {editandoCategoriaVarianteId
                        ? 'Editar categoría de variante'
                        : 'Agregar categoría de variante'}
                    </h2>
                    <form className="formulario" onSubmit={handleCategoriaVarianteSubmit}>
                      <div className="formulario-campo">
                        <label htmlFor="categoria-variante-nombre">Nombre</label>
                        <input
                          id="categoria-variante-nombre"
                          name="nombre"
                          type="text"
                          value={categoriaVarianteForm.nombre}
                          onChange={handleCategoriaVarianteFormChange}
                          required
                        />
                      </div>
                      <div className="formulario-campo">
                        <label htmlFor="categoria-variante-orden">Orden</label>
                        <input
                          id="categoria-variante-orden"
                          name="orden"
                          type="number"
                          min="0"
                          step="1"
                          value={categoriaVarianteForm.orden}
                          onChange={handleCategoriaVarianteFormChange}
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        className="guardar-btn"
                        disabled={guardandoCategoriaVariante}
                      >
                        {guardandoCategoriaVariante
                          ? 'Guardando...'
                          : editandoCategoriaVarianteId
                            ? 'Guardar cambios'
                            : 'Agregar categoría'}
                      </button>
                      <button
                        type="button"
                        className="cancelar-btn"
                        onClick={resetCategoriaVarianteForm}
                      >
                        Cancelar
                      </button>
                    </form>
                  </>
                </section>

                <section className="dashboard-lista">
                  {categoriasVariantes.length === 0 ? (
                    <p className="dashboard-vacio">
                      No hay categorías de variantes configuradas
                    </p>
                  ) : (
                    <div className="pedidos-grid">
                      {[...categoriasVariantes]
                        .sort(
                          (a, b) =>
                            (a.orden ?? 0) - (b.orden ?? 0) ||
                            String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es')
                        )
                        .map((categoria) => (
                          <article key={categoria.id} className="pedido-tarjeta">
                            <h2 className="pedido-cliente">{categoria.nombre}</h2>
                            <p className="pedido-producto">Orden: {categoria.orden ?? 0}</p>
                            {categoria.activo === false && (
                              <p className="pedido-producto">Inactiva</p>
                            )}
                            <div className="tarjeta-acciones">
                              <button
                                type="button"
                                className="editar-btn"
                                onClick={() => iniciarEdicionCategoriaVariante(categoria)}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="eliminar-btn"
                                onClick={() => toggleCategoriaVarianteActiva(categoria)}
                              >
                                {categoria.activo === false ? 'Activar' : 'Desactivar'}
                              </button>
                            </div>
                          </article>
                        ))}
                    </div>
                  )}
                </section>
              </>
            )}

            {categoriasVariantesActivas(categoriasVariantes).map((categoria) => {
              const categoriaId = String(categoria.id);
              if (catalogoTab !== categoriaId) return null;

              const items = ordenarItemsVariantes(catalogosVariantes[categoriaId] || []);
              const editandoActual =
                editandoVariante?.categoria === categoriaId ? editandoVariante.id : null;
              const nombreSingular = categoria.nombre.toLowerCase();

              return (
                <div key={categoriaId}>
                  <section className="pedido-formulario">
                    <>
                      <h2 className="formulario-titulo">
                        {editandoActual ? `Editar ${nombreSingular}` : `Agregar ${nombreSingular}`}
                      </h2>
                      <form
                        className="formulario"
                        onSubmit={(e) => handleVarianteSubmit(e, categoria.id)}
                      >
                          <div className="formulario-campo">
                            <label htmlFor={`${categoriaId}-nombre`}>Nombre</label>
                            <input
                              id={`${categoriaId}-nombre`}
                              name="nombre"
                              type="text"
                              value={varianteForm.nombre}
                              onChange={handleVarianteFormChange}
                              required
                            />
                          </div>
                          <div className="formulario-campo">
                            <label htmlFor={`${categoriaId}-precio`}>Precio adicional</label>
                            <input
                              id={`${categoriaId}-precio`}
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
                        No hay items en {categoria.nombre.toLowerCase()}
                      </p>
                    ) : (
                      <div className="pedidos-grid">
                        {items.map((item) => (
                          <article key={item.id} className="pedido-tarjeta">
                            <h2 className="pedido-cliente">{item.nombre}</h2>
                            <p className="pedido-producto">Precio adicional</p>
                            {item.activo === false && (
                              <p className="pedido-producto">Inactivo</p>
                            )}
                            <p className="pedido-total">
                              {formatearMoneda(item.precio)}
                            </p>
                            <div className="tarjeta-acciones">
                              <button
                                type="button"
                                className="editar-btn"
                                onClick={() => {
                                  setCatalogoTab(categoriaId);
                                  iniciarEdicionVariante(categoriaId, item);
                                }}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="eliminar-btn"
                                onClick={() => toggleItemVarianteActivo(categoriaId, item)}
                              >
                                {item.activo === false ? 'Activar' : 'Desactivar'}
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

function PersistirSeccionActiva() {
  const location = useLocation();

  useEffect(() => {
    const seccion = seccionDesdeRuta(location.pathname);
    if (seccion) {
      persistirSeccionActiva(seccion);
    }
  }, [location.pathname]);

  return null;
}

function RestaurarSeccionActiva() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, cargando } = useAuth();
  const seccionRestauradaRef = useRef(false);

  useEffect(() => {
    if (cargando || !session || seccionRestauradaRef.current) return;
    if (location.pathname !== '/') return;

    seccionRestauradaRef.current = true;

    const seccionGuardada = cargarSeccionActiva();
    const destino = rutaSeccionActiva(seccionGuardada);

    if (destino !== '/') {
      navigate(destino, { replace: true });
    }
  }, [cargando, session, location.pathname, navigate]);

  return null;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PersistirSeccionActiva />
        <RestaurarSeccionActiva />
        <Routes>
          <Route path="/login" element={<VistaLogin />} />
          <Route
            path="/"
            element={
              <ProtectedRoute rolesPermitidos={['dueno', 'administrador', 'cajero']}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/catalogo"
            element={
              <ProtectedRoute rolesPermitidos={['dueno', 'administrador']}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reportes"
            element={
              <ProtectedRoute rolesPermitidos={['dueno', 'administrador']}>
                <VistaReportes />
              </ProtectedRoute>
            }
          />
          <Route
            path="/equipo"
            element={
              <ProtectedRoute rolesPermitidos={['dueno']}>
                <VistaEquipo />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cocina"
            element={
              <ProtectedRoute rolesPermitidos={['dueno', 'administrador', 'cocina']}>
                <VistaCocina />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cocina2"
            element={
              <ProtectedRoute rolesPermitidos={['dueno', 'administrador', 'cocina2']}>
                <VistaCocina2 />
              </ProtectedRoute>
            }
          />
          <Route
            path="/repartidor"
            element={
              <ProtectedRoute rolesPermitidos={['dueno', 'administrador', 'repartidor']}>
                <VistaRepartidor />
              </ProtectedRoute>
            }
          />
        </Routes>
        {process.env.REACT_APP_ENV === 'development' && (
          <span
            style={{
              position: 'fixed',
              bottom: '0.5rem',
              left: '0.5rem',
              zIndex: 9999,
              padding: '0.15rem 0.4rem',
              background: '#dc2626',
              color: '#fff',
              fontSize: '0.65rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              borderRadius: '3px',
              pointerEvents: 'none',
              lineHeight: 1,
            }}
          >
            DEV
          </span>
        )}
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
