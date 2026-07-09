import { TIPOS_ENTREGA } from './pedidosShared';
import { supabase } from './supabase';
import { payloadConNegocio, queryConNegocio } from './tenantHelpers';

export const STORAGE_KEY_MESA_ACTIVA = 'pos_mesa_activa';

const FORMA_PAGO_DEFAULT_CAJA = 'efectivo';
const cacheFolios = new Map();
const folioAbiertoPorNumeroMesa = new Map();
let negocioIdCache = null;
let usuarioIdCache = null;
let rolCache = null;
let ultimoSnapshotRemotoAplicadoSerializado = null;

const ROLES_CON_ACCESO_CARRITO_MESA = new Set(['dueno', 'administrador']);

export function configurarContextoMesas({ usuarioId, rol } = {}) {
  usuarioIdCache = usuarioId ?? null;
  rolCache = rol ?? null;
}

function puedeVerCarritoMesa(fila) {
  if (!fila) return false;

  const creadoPor = fila.creado_por != null ? String(fila.creado_por) : null;
  const usuarioActual = usuarioIdCache != null ? String(usuarioIdCache) : null;

  if (creadoPor && usuarioActual && creadoPor === usuarioActual) {
    return true;
  }

  return rolCache != null && ROLES_CON_ACCESO_CARRITO_MESA.has(rolCache);
}

function crearVariantesLineaVacias() {
  return {};
}

function crearLineaPedidoVacia(id) {
  return {
    id,
    productoId: '',
    cantidad: '1',
    variantes: crearVariantesLineaVacias(),
  };
}

function crearFormularioBaseMesa() {
  return {
    cliente: '',
    telefono: '',
    tipoEntrega: TIPOS_ENTREGA.DOMICILIO,
    direccion: '',
    formaPago: FORMA_PAGO_DEFAULT_CAJA,
    referencia: '',
    lineas: [crearLineaPedidoVacia(1)],
    status: 'por-aceptar',
  };
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

function crearCarritoSnapshotVacio() {
  return {
    form: crearFormularioCapturaMesaVacio(),
    pagoRecibido: '',
    nextLineaId: 2,
  };
}

function serializarCarritoSnapshot(snapshot) {
  return {
    form: snapshot.form,
    pagoRecibido: snapshot.pagoRecibido ?? '',
    nextLineaId: snapshot.nextLineaId ?? 2,
  };
}

export function serializarSnapshotParaComparacion(snapshot) {
  return JSON.stringify({
    form: snapshot.form,
    pagoRecibido: snapshot.pagoRecibido ?? '',
    nextLineaId: snapshot.nextLineaId ?? 2,
  });
}

export function setUltimoSnapshotRemotoAplicado(serializado) {
  ultimoSnapshotRemotoAplicadoSerializado = serializado ?? null;
}

export function debeSuprimirPersistEco(snapshot) {
  if (ultimoSnapshotRemotoAplicadoSerializado == null) {
    return false;
  }

  return (
    serializarSnapshotParaComparacion(snapshot) === ultimoSnapshotRemotoAplicadoSerializado
  );
}

function normalizarSnapshotDesdeJson(carritoSnapshot, numeroRondaSiguiente = 1) {
  const entrada = carritoSnapshot && typeof carritoSnapshot === 'object' ? carritoSnapshot : {};
  const formEntrada = entrada.form && typeof entrada.form === 'object' ? entrada.form : {};
  const lineas = Array.isArray(formEntrada.lineas)
    ? formEntrada.lineas.map(normalizarLineaGuardada)
    : [];
  const formDefault = crearFormularioBaseMesa();

  return {
    form: {
      ...formDefault,
      ...formEntrada,
      tipoEntrega: TIPOS_ENTREGA.DOMICILIO,
      lineas: lineas.length ? lineas : [crearLineaPedidoVacia(1)],
    },
    pagoRecibido: entrada.pagoRecibido ?? '',
    nextLineaId: entrada.nextLineaId ?? calcularNextLineaId(lineas),
    numeroRondaSiguiente: numeroRondaSiguiente ?? 1,
  };
}

function reconstruirIndiceMesasAbiertas() {
  folioAbiertoPorNumeroMesa.clear();

  cacheFolios.forEach((entrada, folioId) => {
    if (entrada.estado === 'abierta') {
      folioAbiertoPorNumeroMesa.set(entrada.numeroMesa, folioId);
    }
  });
}

function filaEstadoCerrada(fila) {
  return !fila || fila.estado === 'cerrada';
}

function removerFolioDeCache(folioId) {
  if (!folioId) return;

  const clave = String(folioId);
  const entrada = cacheFolios.get(clave);
  cacheFolios.delete(clave);

  if (entrada?.numeroMesa != null) {
    const folioMesa = folioAbiertoPorNumeroMesa.get(entrada.numeroMesa);
    if (folioMesa === clave) {
      folioAbiertoPorNumeroMesa.delete(entrada.numeroMesa);
    }
  }
}

function aplicarFilaACache(fila) {
  if (!fila?.id || filaEstadoCerrada(fila)) {
    removerFolioDeCache(fila?.id);
    return;
  }

  const carritoSnapshotEntrada = puedeVerCarritoMesa(fila) ? fila.carrito_snapshot : null;
  const snapshot = normalizarSnapshotDesdeJson(
    carritoSnapshotEntrada,
    fila.numero_ronda_siguiente
  );

  cacheFolios.set(String(fila.id), {
    ...snapshot,
    numeroMesa: fila.numero_mesa,
    estado: fila.estado,
    creadoPor: fila.creado_por ?? null,
    abiertaEn: fila.abierta_en ?? null,
  });

  if (fila.estado === 'abierta') {
    folioAbiertoPorNumeroMesa.set(fila.numero_mesa, String(fila.id));
  }
}

async function flushFolioToSupabase(folioId) {
  const entrada = cacheFolios.get(String(folioId));
  if (!entrada || !negocioIdCache) return;

  const carritoSnapshot = serializarCarritoSnapshot(entrada);

  if (debeSuprimirPersistEco(carritoSnapshot)) {
    return;
  }

  await queryConNegocio(
    supabase
      .from('mesas_folios')
      .update({
        carrito_snapshot: carritoSnapshot,
        numero_ronda_siguiente: entrada.numeroRondaSiguiente ?? 1,
      })
      .eq('id', folioId),
    negocioIdCache
  );
}

export function crearFormularioCapturaMesaVacio() {
  return crearFormularioBaseMesa();
}

export function obtenerMetadatosMesa(folioId) {
  const entrada = cacheFolios.get(String(folioId));
  const numeroRondaSiguiente = entrada?.numeroRondaSiguiente ?? 1;

  return {
    numeroRondaSiguiente,
    rondasEnviadas: Math.max(0, numeroRondaSiguiente - 1),
  };
}

export function obtenerNumeroMesaDeFolio(folioId) {
  const entrada = cacheFolios.get(String(folioId));
  return entrada?.numeroMesa ?? null;
}

export function mesaEstaOcupada(snapshot, meta = null) {
  if (meta?.estado === 'abierta') {
    return true;
  }

  if (!snapshot) return false;

  if ((snapshot.numeroRondaSiguiente ?? 1) > 1) {
    return true;
  }

  const lineas = Array.isArray(snapshot?.form?.lineas) ? snapshot.form.lineas : [];
  return lineas.some((linea) => linea?.productoId);
}

export function cargarCarritosMesasAbiertos() {
  const resultado = {};

  cacheFolios.forEach((entrada, folioId) => {
    if (entrada.estado !== 'abierta') return;

    resultado[folioId] = {
      form: entrada.form,
      pagoRecibido: entrada.pagoRecibido,
      nextLineaId: entrada.nextLineaId,
      numeroRondaSiguiente: entrada.numeroRondaSiguiente ?? 1,
      numeroMesa: entrada.numeroMesa,
    };
  });

  return resultado;
}

export function obtenerFolioAbiertoPorMesa(numeroMesa) {
  return folioAbiertoPorNumeroMesa.get(Number(numeroMesa)) ?? null;
}

export function obtenerNumerosMesaOcupados() {
  return new Set(
    [...folioAbiertoPorNumeroMesa.keys()].map((numero) => String(numero))
  );
}

export function folioSigueAbierto(folioId) {
  const entrada = cacheFolios.get(String(folioId));
  return entrada?.estado === 'abierta';
}

export function persistirCarritosMesas(carritos) {
  Object.entries(carritos || {}).forEach(([folioId, snapshot]) => {
    if (!folioId) return;

    if (debeSuprimirPersistEco(snapshot)) {
      return;
    }

    const anterior = cacheFolios.get(String(folioId));
    const normalizado = normalizarSnapshotDesdeJson(
      snapshot,
      snapshot?.numeroRondaSiguiente ??
        anterior?.numeroRondaSiguiente ??
        1
    );

    const entradaFinal = {
      ...normalizado,
      numeroRondaSiguiente:
        snapshot?.numeroRondaSiguiente ??
        anterior?.numeroRondaSiguiente ??
        normalizado.numeroRondaSiguiente ??
        1,
      numeroMesa: anterior?.numeroMesa,
      estado: anterior?.estado ?? 'abierta',
      creadoPor: anterior?.creadoPor ?? null,
      abiertaEn: anterior?.abiertaEn ?? null,
    };

    if (entradaFinal.estado !== 'abierta') {
      return;
    }

    cacheFolios.set(String(folioId), entradaFinal);
    if (entradaFinal.numeroMesa != null) {
      folioAbiertoPorNumeroMesa.set(entradaFinal.numeroMesa, String(folioId));
    }

    void flushFolioToSupabase(folioId);
  });
}

export function limpiarCarritoFolio() {
  // El cierre de folio (estado = cerrada) se implementará en el paso de cobro.
}

export async function eliminarFolioMesa(folioId) {
  if (!folioId || !negocioIdCache) {
    return false;
  }

  const { error } = await queryConNegocio(
    supabase.from('mesas_folios').delete().eq('id', folioId),
    negocioIdCache
  );

  if (error) {
    throw error;
  }

  removerFolioDeCache(folioId);
  reconstruirIndiceMesasAbiertas();
  return true;
}

export async function hidratarFoliosMesas(negocioId) {
  negocioIdCache = negocioId ?? null;
  cacheFolios.clear();
  folioAbiertoPorNumeroMesa.clear();

  if (!negocioId) {
    return cargarCarritosMesasAbiertos();
  }

  const { data, error } = await queryConNegocio(
    supabase
      .from('mesas_folios_vista')
      .select(
        'id, negocio_id, numero_mesa, estado, creado_por, abierta_en, numero_ronda_siguiente, carrito_snapshot'
      )
      .eq('estado', 'abierta')
      .order('abierta_en', { ascending: true }),
    negocioId
  );

  if (!error && data) {
    data.forEach(aplicarFilaACache);
  }

  reconstruirIndiceMesasAbiertas();
  return cargarCarritosMesasAbiertos();
}

export async function abrirFolioMesa({
  negocioId,
  numeroMesa,
  creadoPor,
  carritoSnapshot: carritoSnapshotEntrada = null,
}) {
  const existente = obtenerFolioAbiertoPorMesa(numeroMesa);
  if (existente) {
    return existente;
  }

  const carritoSnapshot = carritoSnapshotEntrada
    ? serializarCarritoSnapshot(normalizarSnapshotDesdeJson(carritoSnapshotEntrada))
    : crearCarritoSnapshotVacio();
  const payload = payloadConNegocio(
    {
      numero_mesa: numeroMesa,
      estado: 'abierta',
      creado_por: creadoPor ?? null,
      carrito_snapshot: serializarCarritoSnapshot(carritoSnapshot),
      numero_ronda_siguiente: 1,
    },
    negocioId
  );

  const { data, error } = await supabase
    .from('mesas_folios')
    .insert(payload)
    .select(
      'id, negocio_id, numero_mesa, estado, creado_por, abierta_en, numero_ronda_siguiente, carrito_snapshot'
    )
    .single();

  if (error || !data) {
    throw error ?? new Error('No se pudo abrir la mesa.');
  }

  negocioIdCache = negocioId ?? null;
  aplicarFilaACache(data);
  return String(data.id);
}

export function obtenerFolioIdDesdePayloadRealtime(payload) {
  const eventType = String(payload.eventType ?? payload.type ?? '').toUpperCase();
  const registro = payload.new && Object.keys(payload.new).length > 0 ? payload.new : null;
  const anterior = payload.old && Object.keys(payload.old).length > 0 ? payload.old : null;

  if (eventType === 'DELETE') {
    return anterior?.id != null ? String(anterior.id) : null;
  }

  return registro?.id != null ? String(registro.id) : null;
}

export function sincronizarFilaDesdeRealtime(payload) {
  const eventType = String(payload.eventType ?? payload.type ?? '').toUpperCase();
  const registro = payload.new && Object.keys(payload.new).length > 0 ? payload.new : null;
  const anterior = payload.old && Object.keys(payload.old).length > 0 ? payload.old : null;

  if (eventType === 'DELETE') {
    removerFolioDeCache(anterior?.id);
    reconstruirIndiceMesasAbiertas();
    return;
  }

  if (!registro) return;

  if (negocioIdCache && registro.negocio_id && registro.negocio_id !== negocioIdCache) {
    return;
  }

  aplicarFilaACache(registro);
  reconstruirIndiceMesasAbiertas();
}

export function cargarMesaActiva() {
  if (typeof window === 'undefined') return null;

  try {
    const folioId = window.localStorage.getItem(STORAGE_KEY_MESA_ACTIVA);
    return folioId && String(folioId).trim() ? String(folioId).trim() : null;
  } catch {
    return null;
  }
}

export function persistirMesaActiva(folioId) {
  if (typeof window === 'undefined' || !folioId) return;

  try {
    window.localStorage.setItem(STORAGE_KEY_MESA_ACTIVA, String(folioId));
  } catch {
    // Ignorar errores de almacenamiento local.
  }
}

export function limpiarMesaActiva() {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(STORAGE_KEY_MESA_ACTIVA);
  } catch {
    // Ignorar errores de almacenamiento local.
  }
}
