const STORAGE_KEY = 'pos_pedidos_pendientes_sync';

function leerPendientesRaw() {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function escribirPendientes(pendientes) {
  if (typeof window === 'undefined') return;

  try {
    if (!pendientes.length) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pendientes));
  } catch {
    // Ignorar errores de almacenamiento local.
  }
}

export function obtenerPedidosPendientesSync(negocioId = null) {
  const pendientes = leerPendientesRaw();

  if (!negocioId) {
    return pendientes;
  }

  return pendientes.filter((item) => item.negocioId === negocioId);
}

export function guardarPedidoPendienteSync({
  localId,
  payload,
  pedidoOptimista,
  negocioId,
}) {
  if (!localId || typeof window === 'undefined') return;

  const pendientes = leerPendientesRaw().filter((item) => item.localId !== localId);

  pendientes.push({
    localId,
    payload,
    pedidoOptimista,
    negocioId: negocioId ?? null,
    createdAt: new Date().toISOString(),
  });

  escribirPendientes(pendientes);
}

export function eliminarPedidoPendienteSync(localId) {
  if (!localId) return;

  escribirPendientes(leerPendientesRaw().filter((item) => item.localId !== localId));
}
