import { useState } from 'react';
import MesaRondaDesglose from './MesaRondaDesglose.jsx';
import MesaRondaEditor from './MesaRondaEditor.jsx';
import ModalAutorizacionPin from './ModalAutorizacionPin.jsx';
import {
  extraerNumeroRondaMesa,
  formatearFechaHoraCocina,
} from './pedidosShared';
import { tituloAutorizacionPinPedido } from './pedidoEdicionHelpers';
import { decrementarNumeroRondaSiguienteFolio } from './pedidoCarritoStorage';
import { queryConNegocio } from './tenantHelpers';
import { supabase } from './supabase';
import { useRondasMesaEnviadas } from './useRondasMesaEnviadas';

function etiquetaResumenRondas(cantidad) {
  if (cantidad === 1) {
    return '1 ronda enviada';
  }

  return `${cantidad} rondas enviadas`;
}

export default function MesaRondasEnviadas({
  negocioId,
  numeroMesa,
  abiertaEn,
  visible,
  productos,
  productosOrdenados,
  frecuenciaCategorias,
  frecuenciaLista,
  variantesCtx,
  usuarioId,
  folioId,
  onRondasCambiadas,
}) {
  const [expandido, setExpandido] = useState(false);
  const [editandoRondaId, setEditandoRondaId] = useState(null);
  const [eliminandoRondaId, setEliminandoRondaId] = useState(null);
  const [modalPinAbierto, setModalPinAbierto] = useState(false);
  const [rondaPendienteAutorizacion, setRondaPendienteAutorizacion] = useState(null);
  const [accionPendientePin, setAccionPendientePin] = useState(null);

  const { rondas, cargando, resolverNombreCaptura } = useRondasMesaEnviadas({
    negocioId,
    numeroMesa,
    abiertaEn,
    activo: visible && Boolean(abiertaEn),
  });

  if (!visible) {
    return null;
  }

  if (!cargando && rondas.length === 0) {
    return null;
  }

  const cantidad = rondas.length;

  const cerrarPin = () => {
    setModalPinAbierto(false);
    setRondaPendienteAutorizacion(null);
    setAccionPendientePin(null);
  };

  const solicitarAutorizacion = (ronda, accion) => {
    setRondaPendienteAutorizacion(ronda);
    setAccionPendientePin(accion);
    setModalPinAbierto(true);
  };

  const eliminarRonda = async (ronda, autorizadoPor) => {
    setEliminandoRondaId(ronda.id);

    const { error } = await queryConNegocio(
      supabase
        .from('pedidos')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: usuarioId ?? null,
          autorizado_por: autorizadoPor ?? null,
        })
        .eq('id', ronda.id)
        .select('id'),
      negocioId
    );

    if (!error && editandoRondaId === ronda.id) {
      setEditandoRondaId(null);
    }

    setEliminandoRondaId(null);

    if (!error) {
      if (folioId) {
        decrementarNumeroRondaSiguienteFolio(folioId);
      }
      onRondasCambiadas?.();
    }
  };

  const onAutorizadoPin = ({ autorizado_por }) => {
    const ronda = rondaPendienteAutorizacion;
    const accion = accionPendientePin;

    if (!ronda) return;

    if (accion === 'eliminar') {
      void eliminarRonda(ronda, autorizado_por ?? null);
      return;
    }

    if (accion === 'editar') {
      setEditandoRondaId(ronda.id);
      setExpandido(true);
    }
  };

  const tituloPin = tituloAutorizacionPinPedido(
    accionPendientePin,
    rondaPendienteAutorizacion
  );

  return (
    <>
      <section className="mesa-rondas-enviadas" aria-label="Rondas enviadas a cocina">
        <button
          type="button"
          className="mesa-rondas-enviadas-resumen"
          aria-expanded={expandido}
          onClick={() => setExpandido((prev) => !prev)}
        >
          <span>
            {cargando && cantidad === 0
              ? 'Cargando rondas enviadas...'
              : etiquetaResumenRondas(cantidad)}
          </span>
          <span className="mesa-rondas-enviadas-chevron" aria-hidden="true">
            {expandido ? '▴' : '▾'}
          </span>
        </button>

        {expandido ? (
          <div className="mesa-rondas-enviadas-detalle">
            {rondas.map((ronda, indice) => {
              const numeroRonda =
                extraerNumeroRondaMesa(ronda.referencia) ?? indice + 1;
              const nombreCaptura = resolverNombreCaptura(ronda);
              const estaEditando = editandoRondaId === ronda.id;
              const otraEditando =
                editandoRondaId !== null && editandoRondaId !== ronda.id;

              return (
                <article key={ronda.id} className="mesa-rondas-enviadas-item">
                  <header className="mesa-rondas-enviadas-item-cabecera">
                    <h4 className="mesa-rondas-enviadas-item-titulo">
                      Ronda {numeroRonda}
                    </h4>
                    <time
                      className="mesa-rondas-enviadas-item-hora"
                      dateTime={ronda.created_at}
                    >
                      {formatearFechaHoraCocina(ronda.created_at)}
                    </time>
                  </header>

                  {nombreCaptura ? (
                    <p className="mesa-rondas-enviadas-item-captura">
                      Capturado por: <span>{nombreCaptura}</span>
                    </p>
                  ) : null}

                  {estaEditando ? (
                    <MesaRondaEditor
                      ronda={ronda}
                      productos={productos}
                      productosOrdenados={productosOrdenados}
                      frecuenciaCategorias={frecuenciaCategorias}
                      frecuenciaLista={frecuenciaLista}
                      variantesCtx={variantesCtx}
                      negocioId={negocioId}
                      onGuardar={() => {
                        setEditandoRondaId(null);
                        onRondasCambiadas?.();
                      }}
                      onCancelar={() => setEditandoRondaId(null)}
                    />
                  ) : (
                    <>
                      <MesaRondaDesglose
                        pedido={ronda}
                        productos={productos}
                        variantesCtx={variantesCtx}
                      />

                      <div className="mesa-rondas-enviadas-acciones">
                        <button
                          type="button"
                          className="editar-btn"
                          disabled={
                            otraEditando ||
                            eliminandoRondaId === ronda.id
                          }
                          onClick={() => solicitarAutorizacion(ronda, 'editar')}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="eliminar-btn"
                          disabled={
                            otraEditando ||
                            eliminandoRondaId === ronda.id
                          }
                          onClick={() => solicitarAutorizacion(ronda, 'eliminar')}
                        >
                          {eliminandoRondaId === ronda.id ? 'Eliminando...' : 'Eliminar'}
                        </button>
                      </div>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        ) : null}
      </section>

      <ModalAutorizacionPin
        visible={modalPinAbierto}
        titulo={tituloPin}
        onClose={cerrarPin}
        onAutorizado={onAutorizadoPin}
      />
    </>
  );
}
