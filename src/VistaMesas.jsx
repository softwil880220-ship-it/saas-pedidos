import { useCallback, useEffect, useMemo, useState } from 'react';
import { cargarCarritosMesasAbiertos } from './pedidoCarritoStorage';
import MesaCarritoPanel from './MesaCarritoPanel';

export const CANTIDAD_MESAS = 10;

function folioIdDesdeNumeroMesa(numero) {
  return String(numero);
}

export default function VistaMesas({
  productos,
  productosOrdenados,
  frecuenciaCategorias,
  frecuenciaLista,
  variantesCtx,
}) {
  const [carritosAbiertos, setCarritosAbiertos] = useState(() => cargarCarritosMesasAbiertos());
  const [folioActivo, setFolioActivo] = useState(null);

  const recargarCarritosAbiertos = useCallback(() => {
    setCarritosAbiertos(cargarCarritosMesasAbiertos());
  }, []);

  useEffect(() => {
    recargarCarritosAbiertos();
  }, [recargarCarritosAbiertos]);

  const mesas = useMemo(
    () =>
      Array.from({ length: CANTIDAD_MESAS }, (_, indice) => {
        const numero = indice + 1;
        const folioId = folioIdDesdeNumeroMesa(numero);
        const ocupada = Object.prototype.hasOwnProperty.call(carritosAbiertos, folioId);

        return { numero, folioId, ocupada };
      }),
    [carritosAbiertos]
  );

  const numeroMesaActiva = folioActivo ? parseInt(folioActivo, 10) : null;

  const abrirMesa = (folioId) => {
    setFolioActivo(folioId);
  };

  const cerrarPanel = () => {
    setFolioActivo(null);
    recargarCarritosAbiertos();
  };

  return (
    <section className="vista-mesas">
      <h2 className="formulario-titulo">Mesas</h2>
      <p className="vista-mesas-descripcion">
        Selecciona una mesa para abrir o continuar un pedido.
      </p>

      <div className="vista-mesas-grilla" role="list" aria-label="Mesas del local">
        {mesas.map(({ numero, folioId, ocupada }) => (
          <button
            key={folioId}
            type="button"
            role="listitem"
            className={`mesa-tarjeta${ocupada ? ' mesa-tarjeta-ocupada' : ' mesa-tarjeta-disponible'}${
              folioActivo === folioId ? ' mesa-tarjeta-activa' : ''
            }`}
            onClick={() => abrirMesa(folioId)}
            aria-pressed={folioActivo === folioId}
          >
            <span className="mesa-tarjeta-numero">Mesa {numero}</span>
            <span className="mesa-tarjeta-estado">{ocupada ? 'Ocupada' : 'Disponible'}</span>
          </button>
        ))}
      </div>

      {folioActivo && numeroMesaActiva ? (
        <MesaCarritoPanel
          key={folioActivo}
          folioId={folioActivo}
          numeroMesa={numeroMesaActiva}
          productos={productos}
          productosOrdenados={productosOrdenados}
          frecuenciaCategorias={frecuenciaCategorias}
          frecuenciaLista={frecuenciaLista}
          variantesCtx={variantesCtx}
          onCerrar={cerrarPanel}
        />
      ) : null}
    </section>
  );
}
