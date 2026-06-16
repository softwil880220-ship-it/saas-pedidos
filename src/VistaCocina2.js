import VistaCocinaBase from './VistaCocinaBase';
import { COCINAS } from './pedidosShared';

export default function VistaCocina2() {
  return (
    <VistaCocinaBase
      cocina={COCINAS.COCINA2}
      titulo="Cocina 2"
      channelName="cocina2-pedidos"
      claseVista="vista-cocina2"
    />
  );
}
