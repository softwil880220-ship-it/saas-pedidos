import { useCallback, useEffect, useRef, useState } from 'react';

export const TIEMPO_REOCULTAR_MONTOS_MS = 15000;

export function useMontosOcultos() {
  const [visibles, setVisibles] = useState(false);
  const timerRef = useRef(null);

  const limpiarTimer = useCallback(() => {
    if (timerRef.current == null) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => {
    if (!visibles) {
      limpiarTimer();
      return undefined;
    }

    limpiarTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setVisibles(false);
    }, TIEMPO_REOCULTAR_MONTOS_MS);

    return limpiarTimer;
  }, [visibles, limpiarTimer]);

  const alternar = useCallback(() => {
    setVisibles((actual) => !actual);
  }, []);

  return { visibles, alternar };
}
