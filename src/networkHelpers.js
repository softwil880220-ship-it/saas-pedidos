export const TIMEOUT_OPERACION_MS = 15000;

export class TimeoutError extends Error {
  constructor(message = 'TIMEOUT') {
    super(message);
    this.name = 'TimeoutError';
  }
}

export function esErrorRed(error) {
  if (!error) return false;

  if (error instanceof TimeoutError || error.name === 'TimeoutError') {
    return true;
  }

  const mensaje = String(error.message ?? '').toLowerCase();
  return (
    mensaje.includes('failed to fetch') ||
    mensaje.includes('network') ||
    mensaje.includes('timeout') ||
    mensaje.includes('time-out')
  );
}

export function ejecutarConTimeout(promise, ms = TIMEOUT_OPERACION_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new TimeoutError()), ms);
    }),
  ]);
}

export function mensajeErrorOperacionRed(error) {
  if (error instanceof TimeoutError || error?.name === 'TimeoutError') {
    return 'La acción tardó demasiado. Verifica tu conexión e intenta de nuevo.';
  }

  return 'No se pudo guardar. Verifica tu conexión e intenta de nuevo.';
}
