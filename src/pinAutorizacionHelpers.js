import { esErrorRed, ejecutarConTimeout } from './networkHelpers';

export const TIMEOUT_AUTORIZACION_PIN_MS = 20000;

const MENSAJE_PIN_INCORRECTO = 'PIN incorrecto.';
const MENSAJE_SIN_NEGOCIO = 'No se pudo verificar. Recarga la página.';
const MENSAJE_SESION_INVALIDA =
  'Tu sesión expiró o no es válida. Cierra sesión e inicia de nuevo.';
const MENSAJE_SIN_PERMISO = 'No tienes permiso para autorizar esta acción.';
const MENSAJE_RED = 'Problema de conexión. Verifica tu red e intenta de nuevo.';
const MENSAJE_SERVIDOR = 'Error del servidor. Intenta de nuevo en unos segundos.';

function statusHttpErrorInvoke(errorInvoke) {
  if (!errorInvoke) return null;

  const contexto = errorInvoke.context;
  if (contexto && typeof contexto.status === 'number') {
    return contexto.status;
  }

  if (typeof errorInvoke.status === 'number') {
    return errorInvoke.status;
  }

  return null;
}

function esErrorSesionEnTexto(texto) {
  const valor = String(texto ?? '').toLowerCase();
  return (
    valor.includes('token') ||
    valor.includes('authorization') ||
    valor.includes('expirado') ||
    valor.includes('sesión') ||
    valor.includes('sesion')
  );
}

export function clasificarErrorAutorizacionPin({ errorInvoke, data, negocioId }) {
  if (!negocioId) {
    return { tipo: 'config', mensaje: MENSAJE_SIN_NEGOCIO };
  }

  if (errorInvoke) {
    if (esErrorRed(errorInvoke)) {
      return { tipo: 'red', mensaje: MENSAJE_RED };
    }

    const status = statusHttpErrorInvoke(errorInvoke);
    if (status === 401) {
      return { tipo: 'auth', mensaje: MENSAJE_SESION_INVALIDA };
    }
    if (status === 403) {
      return { tipo: 'permiso', mensaje: MENSAJE_SIN_PERMISO };
    }
    if (status != null && status >= 500) {
      return { tipo: 'servidor', mensaje: MENSAJE_SERVIDOR };
    }

    return { tipo: 'red', mensaje: MENSAJE_RED };
  }

  if (data?.success === false) {
    if (esErrorSesionEnTexto(data.error)) {
      return { tipo: 'auth', mensaje: MENSAJE_SESION_INVALIDA };
    }
    return { tipo: 'servidor', mensaje: MENSAJE_SERVIDOR };
  }

  return { tipo: 'pin', mensaje: MENSAJE_PIN_INCORRECTO };
}

export async function invocarAutorizacionPinConTimeout(invokeFn, ms = TIMEOUT_AUTORIZACION_PIN_MS) {
  return ejecutarConTimeout(invokeFn(), ms);
}

export { MENSAJE_PIN_INCORRECTO };
