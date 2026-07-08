import { useCallback, useEffect, useMemo, useState } from 'react';
import { cargarCarritosMesasAbiertos } from './pedidoCarritoStorage';
import MesaCarritoPanel from './MesaCarritoPanel';

export const CANTIDAD_MESAS = 10;

function folioIdDesdeNumeroMesa(numero) {
  return String(numero);
}

function foliosOcupadosDesdeStorage() {
  return new Set(Object.keys(cargarCarritosMesasAbiertos()));
}

export default function VistaMesas({
  productos,
  productosOrdenados,
  frecuenciaCategorias,
  frecuenciaLista,
  variantesCtx,
}) {
  const [foliosOcupados, setFoliosOcupados] = useState(foliosOcupadosDesdeStorage);
  const [folioActivo, setFolioActivo] = useState(null);

  const sincronizarFoliosOcupados = useCallback(() => {
    setFoliosOcupados(foliosOcupadosDesdeStorage());
  }, []);

  const restablecerVistaGrilla = useCallback(() => {
    setFolioActivo(null);
    sincronizarFoliosOcupados();
  }, [sincronizarFoliosOcupados]);

  useEffect(() => {
    restablecerVistaGrilla();
  }, [restablecerVistaGrilla]);

  useEffect(() => {
    const restablecerPanelAlMostrarPagina = (evento) => {
      if (evento.persisted) {
        restablecerVistaGrilla();
      }
    };

    window.addEventListener('pageshow', restablecerPanelAlMostrarPagina);
    return () => window.removeEventListener('pageshow', restablecerPanelAlMostrarPagina);
  }, [restablecerVistaGrilla]);

  const actualizarOcupacionMesa = useCallback((folioId, ocupada) => {
    setFoliosOcupados((prev) => {
      const next = new Set(prev);
      if (ocupada) {
        next.add(folioId);
      } else {
        next.delete(folioId);
      }
      return next;
    });
  }, []);

  const mesas = useMemo(
    () =>
      Array.from({ length: CANTIDAD_MESAS }, (_, indice) => {
        const numero = indice + 1;
        const folioId = folioIdDesdeNumeroMesa(numero);
        const ocupada = foliosOcupados.has(folioId);

        return { numero, folioId, ocupada };
      }),
    [foliosOcupados]
  );

  const numeroMesaActiva = folioActivo ? parseInt(folioActivo, 10) : null;

  const abrirMesa = (folioId) => {
    setFolioActivo(folioId);
  };

  const cerrarPanel = () => {
    restablecerVistaGrilla();
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
          onOcupacionMesaChange={actualizarOcupacionMesa}
        />
      ) : null}
    </section>
  );
}
