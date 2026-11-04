import { act, renderHook } from '@testing-library/react';
import { TIEMPO_REOCULTAR_MONTOS_MS, useMontosOcultos } from './useMontosOcultos';

const TIEMPO_AUN_VISIBLE_MS = TIEMPO_REOCULTAR_MONTOS_MS - 100;
const TIEMPO_PARCIAL_MS = TIEMPO_REOCULTAR_MONTOS_MS / 3;

describe('useMontosOcultos', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('arranca oculto', () => {
    const { result } = renderHook(() => useMontosOcultos());
    expect(result.current.visibles).toBe(false);
  });

  test('alternar muestra los montos', () => {
    const { result } = renderHook(() => useMontosOcultos());

    act(() => {
      result.current.alternar();
    });

    expect(result.current.visibles).toBe(true);
  });

  test('a los 15 s vuelve a ocultar', () => {
    const { result } = renderHook(() => useMontosOcultos());

    act(() => {
      result.current.alternar();
    });
    expect(result.current.visibles).toBe(true);

    act(() => {
      jest.advanceTimersByTime(TIEMPO_AUN_VISIBLE_MS);
    });
    expect(result.current.visibles).toBe(true);

    act(() => {
      jest.advanceTimersByTime(TIEMPO_REOCULTAR_MONTOS_MS - TIEMPO_AUN_VISIBLE_MS);
    });
    expect(result.current.visibles).toBe(false);
  });

  test('reinicia el timer al volver a mostrar', () => {
    const { result } = renderHook(() => useMontosOcultos());

    act(() => {
      result.current.alternar();
    });
    act(() => {
      jest.advanceTimersByTime(TIEMPO_PARCIAL_MS);
    });
    act(() => {
      result.current.alternar();
    });
    expect(result.current.visibles).toBe(false);

    act(() => {
      result.current.alternar();
    });
    expect(result.current.visibles).toBe(true);

    act(() => {
      jest.advanceTimersByTime(TIEMPO_AUN_VISIBLE_MS);
    });
    expect(result.current.visibles).toBe(true);

    act(() => {
      jest.advanceTimersByTime(TIEMPO_REOCULTAR_MONTOS_MS - TIEMPO_AUN_VISIBLE_MS);
    });
    expect(result.current.visibles).toBe(false);
  });

  test('unmount limpia el timer', () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    const { result, unmount } = renderHook(() => useMontosOcultos());

    act(() => {
      result.current.alternar();
    });
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    act(() => {
      jest.runOnlyPendingTimers();
    });
  });

  test('no escribe en localStorage ni sessionStorage', () => {
    const localSetItem = jest.spyOn(Storage.prototype, 'setItem');
    const { result } = renderHook(() => useMontosOcultos());

    act(() => {
      result.current.alternar();
    });
    act(() => {
      result.current.alternar();
    });

    expect(localSetItem).not.toHaveBeenCalled();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });
});
