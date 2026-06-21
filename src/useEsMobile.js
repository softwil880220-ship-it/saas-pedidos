import { useEffect, useState } from 'react';

export default function useEsMobile(anchoMaximo = 720) {
  const [esMobile, setEsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(`(max-width: ${anchoMaximo}px)`).matches;
  });

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${anchoMaximo}px)`);
    const actualizar = () => setEsMobile(media.matches);
    actualizar();
    media.addEventListener('change', actualizar);
    return () => media.removeEventListener('change', actualizar);
  }, [anchoMaximo]);

  return esMobile;
}
