import { formatearMoneda } from './pedidosShared';

export const TEXTO_MONTO_OCULTO = '$ ••••';

export function formatearMontoOcultable(visibles, valor) {
  return visibles ? formatearMoneda(valor) : TEXTO_MONTO_OCULTO;
}
