import { TIPOS_ENTREGA } from './pedidosShared';

export const STORAGE_KEYS = {
  CAJA: 'pos_carrito_caja',
  WHATSAPP_BORRADOR: 'pos_carrito_whatsapp_borrador',
  WHATSAPP_DOMICILIO: 'pos_carrito_whatsapp_domicilio',
  WHATSAPP_SUCURSAL: 'pos_carrito_whatsapp_sucursal',
  MODO_CAPTURA: 'pos_modo_captura',
  SECCION_ACTIVA: 'pos_seccion_activa',
  MESAS: 'pos_carritos_mesas',
  MESA_ACTIVA: 'pos_mesa_activa',
};

const SECCIONES_DASHBOARD = new Set(['pedidos', 'catalogo', 'reportes', 'equipo']);

const CLIENTE_PUBLICO = 'Público general';
const FORMA_PAGO_DEFAULT_CAJA = 'efectivo';
const STATUS_DEFAULT_WHATSAPP = 'en-cocina';
const TIPO_ENTREGA_SIN_SELECCION = '';

function crearVariantesLineaVacias() {
  return {};
}

export function crearLineaPedidoVacia(id) {
  return {
    id,
    productoId: '',
    cantidad: '1',
    variantes: crearVariantesLineaVacias(),
  };
}

export function crearFormularioPedidoDefault(modoActual, tipoEntrega = TIPO_ENTREGA_SIN_SELECCION) {
  const esPresencial = modoActual === 'presencial';

  return {
    cliente: esPresencial ? CLIENTE_PUBLICO : '',
    telefono: '',
    tipoEntrega: esPresencial ? TIPOS_ENTREGA.DOMICILIO : tipoEntrega,
    direccion: '',
    formaPago: esPresencial ? FORMA_PAGO_DEFAULT_CAJA : '',
    referencia: '',
    lineas: [crearLineaPedidoVacia(1)],
    status: esPresencial ? 'por-aceptar' : STATUS_DEFAULT_WHATSAPP,
  };
}

export function obtenerClaveCarritoPedido(modo, tipoEntrega) {
  if (modo === 'presencial') {
    return STORAGE_KEYS.CAJA;
  }

  if (tipoEntrega === TIPOS_ENTREGA.DOMICILIO) {
    return STORAGE_KEYS.WHATSAPP_DOMICILIO;
  }

  if (tipoEntrega === TIPOS_ENTREGA.SUCURSAL) {
    return STORAGE_KEYS.WHATSAPP_SUCURSAL;
  }

  return STORAGE_KEYS.WHATSAPP_BORRADOR;
}

function normalizarVariantesLinea(variantes) {
  if (!variantes || typeof variantes !== 'object') {
    return crearVariantesLineaVacias();
  }

  return Object.entries(variantes).reduce((acc, [key, ids]) => {
    acc[key] = Array.isArray(ids) ? ids.map(String) : [];
    return acc;
  }, {});
}

function normalizarLineaGuardada(linea, index) {
  return {
    id: linea?.id ?? index + 1,
    productoId: linea?.productoId != null ? String(linea.productoId) : '',
    cantidad: linea?.cantidad != null ? String(linea.cantidad) : '1',
    variantes: normalizarVariantesLinea(linea?.variantes),
  };
}

function calcularNextLineaId(lineas) {
  const maxId = lineas.reduce(
    (maximo, linea) => Math.max(maximo, Number(linea.id) || 0),
    1
  );

  return maxId + 1;
}

function lineaEstaVacia(linea) {
  return !linea?.productoId;
}

function esCarritoVacio({ form, pagoRecibido }, modo, tipoEntrega) {
  const clave = obtenerClaveCarritoPedido(modo, tipoEntrega);
  if (!clave) return true;

  const lineas = Array.isArray(form?.lineas) ? form.lineas : [];
  const sinProductos =
    lineas.length === 0 || lineas.every(lineaEstaVacia);

  if (!sinProductos) {
    return false;
  }

  if (modo === 'presencial') {
    return (
      !form?.referencia?.trim() &&
      (form?.formaPago || FORMA_PAGO_DEFAULT_CAJA) === FORMA_PAGO_DEFAULT_CAJA &&
      !String(pagoRecibido ?? '').trim()
    );
  }

  if (tipoEntrega === TIPOS_ENTREGA.DOMICILIO) {
    return (
      !form?.cliente?.trim() &&
      !form?.telefono?.trim() &&
      !form?.direccion?.trim() &&
      !form?.formaPago?.trim() &&
      (form?.status || STATUS_DEFAULT_WHATSAPP) === STATUS_DEFAULT_WHATSAPP
    );
  }

  if (tipoEntrega === TIPOS_ENTREGA.SUCURSAL) {
    return (
      !form?.cliente?.trim() &&
      !form?.telefono?.trim() &&
      !form?.formaPago?.trim() &&
      (form?.status || STATUS_DEFAULT_WHATSAPP) === STATUS_DEFAULT_WHATSAPP
    );
  }

  return (
    !form?.cliente?.trim() &&
    !form?.telefono?.trim() &&
    !form?.direccion?.trim() &&
    !form?.formaPago?.trim() &&
    (form?.status || STATUS_DEFAULT_WHATSAPP) === STATUS_DEFAULT_WHATSAPP
  );
}

function carritoGuardadoTieneContenido(restaurado, modo) {
  if (!restaurado) return false;

  const tipoEntrega =
    modo === 'presencial' ? TIPOS_ENTREGA.DOMICILIO : restaurado.form?.tipoEntrega;

  return !esCarritoVacio(
    { form: restaurado.form, pagoRecibido: restaurado.pagoRecibido },
    modo,
    tipoEntrega
  );
}

export function limpiarCarritoEnStorage(clave) {
  if (!clave || typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(clave);
  } catch {
    // Ignorar errores de almacenamiento local.
  }
}

export function limpiarCarritoPedido(modo, tipoEntrega) {
  const clave = obtenerClaveCarritoPedido(modo, tipoEntrega);
  limpiarCarritoEnStorage(clave);
}

function serializarCarrito({ form, pagoRecibido, nextLineaId }) {
  return JSON.stringify({
    form,
    pagoRecibido: pagoRecibido ?? '',
    nextLineaId: nextLineaId ?? 2,
  });
}

export function persistirModoCaptura(modo) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      STORAGE_KEYS.MODO_CAPTURA,
      modo === 'whatsapp' ? 'whatsapp' : 'presencial'
    );
  } catch {
    // Ignorar errores de almacenamiento local.
  }
}

export function cargarModoCaptura() {
  if (typeof window === 'undefined') return 'presencial';

  try {
    const modo = window.localStorage.getItem(STORAGE_KEYS.MODO_CAPTURA);
    return modo === 'whatsapp' ? 'whatsapp' : 'presencial';
  } catch {
    return 'presencial';
  }
}

export function persistirCarritoPedido({ modo, form, pagoRecibido, nextLineaId }) {
  if (typeof window === 'undefined') return;

  const tipoEntrega =
    modo === 'presencial' ? TIPOS_ENTREGA.DOMICILIO : form?.tipoEntrega;
  const clave = obtenerClaveCarritoPedido(modo, tipoEntrega);

  if (!clave) return;

  try {
    if (esCarritoVacio({ form, pagoRecibido }, modo, tipoEntrega)) {
      limpiarCarritoEnStorage(clave);
      return;
    }

    window.localStorage.setItem(
      clave,
      serializarCarrito({ form, pagoRecibido, nextLineaId })
    );

    if (
      clave === STORAGE_KEYS.WHATSAPP_DOMICILIO ||
      clave === STORAGE_KEYS.WHATSAPP_SUCURSAL
    ) {
      limpiarCarritoEnStorage(STORAGE_KEYS.WHATSAPP_BORRADOR);
    }
  } catch {
    // Ignorar errores de almacenamiento local.
  }
}

export function cargarCarritoPedido(modo, tipoEntrega) {
  const clave = obtenerClaveCarritoPedido(modo, tipoEntrega);
  if (!clave || typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(clave);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed?.form || typeof parsed.form !== 'object') {
      return null;
    }

    const lineas = Array.isArray(parsed.form.lineas)
      ? parsed.form.lineas.map(normalizarLineaGuardada)
      : [];

    const formDefault = crearFormularioPedidoDefault(modo, tipoEntrega);

    return {
      form: {
        ...formDefault,
        ...parsed.form,
        tipoEntrega:
          modo === 'presencial'
            ? TIPOS_ENTREGA.DOMICILIO
            : tipoEntrega || parsed.form.tipoEntrega || TIPO_ENTREGA_SIN_SELECCION,
        lineas: lineas.length ? lineas : [crearLineaPedidoVacia(1)],
      },
      pagoRecibido: parsed.pagoRecibido ?? '',
      nextLineaId: parsed.nextLineaId ?? calcularNextLineaId(lineas),
    };
  } catch {
    return null;
  }
}

export function cargarCarritoWhatsappDisponible() {
  const opciones = [
    TIPOS_ENTREGA.DOMICILIO,
    TIPOS_ENTREGA.SUCURSAL,
    TIPO_ENTREGA_SIN_SELECCION,
  ];

  for (const tipoEntrega of opciones) {
    const restaurado = cargarCarritoPedido('whatsapp', tipoEntrega);
    if (carritoGuardadoTieneContenido(restaurado, 'whatsapp')) {
      return restaurado;
    }
  }

  return null;
}

export function cargarCarritoPresencialDisponible() {
  const restaurado = cargarCarritoPedido('presencial', TIPOS_ENTREGA.DOMICILIO);

  if (carritoGuardadoTieneContenido(restaurado, 'presencial')) {
    return restaurado;
  }

  return null;
}

const VERSION_STORAGE_MESAS = 1;

function esCarritoMesaVacio(snapshot) {
  const lineas = Array.isArray(snapshot?.form?.lineas) ? snapshot.form.lineas : [];
  const sinProductos = lineas.length === 0 || lineas.every(lineaEstaVacia);

  if (!sinProductos) {
    return false;
  }

  return !String(snapshot?.pagoRecibido ?? '').trim();
}

function leerMapaMesasAlmacenado() {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.MESAS);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.carritos !== 'object') {
      return {};
    }

    return parsed.carritos;
  } catch {
    return {};
  }
}

function normalizarSnapshotMesa(entrada) {
  if (!entrada?.form || typeof entrada.form !== 'object') {
    return null;
  }

  const lineas = Array.isArray(entrada.form.lineas)
    ? entrada.form.lineas.map(normalizarLineaGuardada)
    : [];
  const formDefault = crearFormularioPedidoDefault('presencial');

  const snapshot = {
    form: {
      ...formDefault,
      ...entrada.form,
      tipoEntrega: TIPOS_ENTREGA.DOMICILIO,
      lineas: lineas.length ? lineas : [crearLineaPedidoVacia(1)],
    },
    pagoRecibido: entrada.pagoRecibido ?? '',
    nextLineaId: entrada.nextLineaId ?? calcularNextLineaId(lineas),
  };

  if (entrada.mesaId != null && String(entrada.mesaId).trim()) {
    snapshot.mesaId = String(entrada.mesaId);
  }

  if (entrada.actualizadoEn) {
    snapshot.actualizadoEn = entrada.actualizadoEn;
  }

  return snapshot;
}

function escribirMapaMesas(carritos) {
  if (typeof window === 'undefined') return;

  try {
    if (!carritos || Object.keys(carritos).length === 0) {
      limpiarCarritoEnStorage(STORAGE_KEYS.MESAS);
      return;
    }

    window.localStorage.setItem(
      STORAGE_KEYS.MESAS,
      JSON.stringify({
        version: VERSION_STORAGE_MESAS,
        carritos,
      })
    );
  } catch {
    // Ignorar errores de almacenamiento local.
  }
}

export function persistirCarritosMesas(carritos) {
  if (typeof window === 'undefined') return;

  const mapaActual = leerMapaMesasAlmacenado();
  const mapaMerged = { ...mapaActual };

  Object.entries(carritos || {}).forEach(([folioId, snapshot]) => {
    if (!folioId) return;

    const normalizado = normalizarSnapshotMesa(snapshot);

    if (!normalizado || esCarritoMesaVacio(normalizado)) {
      delete mapaMerged[folioId];
      return;
    }

    mapaMerged[folioId] = {
      ...normalizado,
      actualizadoEn: snapshot?.actualizadoEn ?? new Date().toISOString(),
    };
  });

  escribirMapaMesas(mapaMerged);
}

export function cargarCarritosMesasAbiertos() {
  const mapa = leerMapaMesasAlmacenado();
  const resultado = {};

  Object.entries(mapa).forEach(([folioId, entrada]) => {
    const normalizado = normalizarSnapshotMesa(entrada);
    if (!normalizado || esCarritoMesaVacio(normalizado)) {
      return;
    }

    resultado[folioId] = normalizado;
  });

  return resultado;
}

export function limpiarCarritoFolio(folioId) {
  if (!folioId || typeof window === 'undefined') return;

  const mapaActual = leerMapaMesasAlmacenado();
  if (!Object.prototype.hasOwnProperty.call(mapaActual, folioId)) {
    return;
  }

  const mapaRestante = { ...mapaActual };
  delete mapaRestante[folioId];
  escribirMapaMesas(mapaRestante);
}

export function cargarMesaActiva() {
  if (typeof window === 'undefined') return null;

  try {
    const folioId = window.localStorage.getItem(STORAGE_KEYS.MESA_ACTIVA);
    return folioId && String(folioId).trim() ? String(folioId).trim() : null;
  } catch {
    return null;
  }
}

export function persistirMesaActiva(folioId) {
  if (typeof window === 'undefined' || !folioId) return;

  try {
    window.localStorage.setItem(STORAGE_KEYS.MESA_ACTIVA, String(folioId));
  } catch {
    // Ignorar errores de almacenamiento local.
  }
}

export function limpiarMesaActiva() {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(STORAGE_KEYS.MESA_ACTIVA);
  } catch {
    // Ignorar errores de almacenamiento local.
  }
}

export function persistirSeccionActiva(seccion) {
  if (typeof window === 'undefined' || !SECCIONES_DASHBOARD.has(seccion)) return;

  try {
    window.localStorage.setItem(STORAGE_KEYS.SECCION_ACTIVA, seccion);
  } catch {
    // Ignorar errores de almacenamiento local.
  }
}

export function cargarSeccionActiva() {
  if (typeof window === 'undefined') return 'pedidos';

  try {
    const seccion = window.localStorage.getItem(STORAGE_KEYS.SECCION_ACTIVA);
    return SECCIONES_DASHBOARD.has(seccion) ? seccion : 'pedidos';
  } catch {
    return 'pedidos';
  }
}

export function seccionDesdeRuta(pathname) {
  if (pathname === '/catalogo') return 'catalogo';
  if (pathname === '/reportes') return 'reportes';
  if (pathname === '/equipo') return 'equipo';
  if (pathname === '/') return 'pedidos';
  return null;
}

export function rutaSeccionActiva(seccion) {
  if (seccion === 'catalogo') return '/catalogo';
  if (seccion === 'reportes') return '/reportes';
  if (seccion === 'equipo') return '/equipo';
  return '/';
}

const STORAGE_KEY_MODO_PEDIDOS = 'pos_modo_pedidos';

export function cargarModoPedidosInicialWeb() {
  if (typeof window === 'undefined') return 'presencial';

  try {
    const modo = window.localStorage.getItem(STORAGE_KEY_MODO_PEDIDOS);
    if (modo === 'whatsapp') return 'whatsapp';
    if (modo === 'presencial') return 'presencial';
    return 'presencial';
  } catch {
    return 'presencial';
  }
}

export function cargarEstadoInicialCapturaPedidoWeb() {
  const modo = cargarModoPedidosInicialWeb();
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

export function cargarEstadoInicialCapturaPedido() {
  const modoGuardado = cargarModoCaptura();
  const restaurado =
    modoGuardado === 'whatsapp'
      ? cargarCarritoWhatsappDisponible()
      : cargarCarritoPresencialDisponible();

  if (restaurado) {
    return { ...restaurado, modo: modoGuardado };
  }

  return {
    form: crearFormularioPedidoDefault(modoGuardado),
    pagoRecibido: '',
    nextLineaId: 2,
    modo: modoGuardado,
  };
}
