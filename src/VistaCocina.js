import VistaCocinaBase from './VistaCocinaBase';
import { COCINAS } from './pedidosShared';

export default function VistaCocina() {
  return (
    <VistaCocinaBase
      cocina={COCINAS.COCINA1}
      titulo="Cocina 1"
      channelName="cocina1-pedidos"
      claseVista="vista-cocina"
    />
  );
}
