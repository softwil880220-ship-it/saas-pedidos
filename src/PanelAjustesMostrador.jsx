import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import './PanelAjustesMostrador.css';

const OPCIONES_FLUJO = [
  {
    value: 0,
    label:
      'La cajera o el mesero recibe el producto directamente y lo entrega al cliente, sin que cocina intervenga en el sistema.',
  },
  {
    value: 1,
    label:
      'Cocina prepara el pedido y avisa cuando termina; la cajera o el mesero recoge el producto y lo entrega al cliente.',
  },
  {
    value: 2,
    label:
      'Una persona coordina con cocina y recibe el producto cuando está listo, pero la cajera o el mesero hace la entrega final al cliente.',
  },
  {
    value: 3,
    label:
      'Una misma persona coordina con cocina, recibe el producto y lo entrega directamente al cliente.',
  },
];

export default function PanelAjustesMostrador({ negocioId }) {
  const [valor, setValor] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [mensajeExito, setMensajeExito] = useState(null);

  useEffect(() => {
    if (!negocioId) {
      setCargando(false);
      return;
    }

    let activo = true;

    const cargar = async () => {
      setCargando(true);
      setError(null);

      const { data, error: errorConsulta } = await supabase
        .from('negocios')
        .select('mostrador_flujo_cocina')
        .eq('id', negocioId)
        .maybeSingle();

      if (!activo) return;

      if (errorConsulta) {
        setError('No se pudo cargar la configuración de Mostrador.');
        setCargando(false);
        return;
      }

      const flujo = Number(data?.mostrador_flujo_cocina);
      setValor(Number.isFinite(flujo) && flujo >= 0 && flujo <= 3 ? flujo : 0);
      setCargando(false);
    };

    void cargar();

    return () => {
      activo = false;
    };
  }, [negocioId]);

  const guardar = async (event) => {
    event.preventDefault();
    if (!negocioId) return;

    setGuardando(true);
    setError(null);
    setMensajeExito(null);

    const { error: errorGuardado } = await supabase
      .from('negocios')
      .update({ mostrador_flujo_cocina: valor })
      .eq('id', negocioId);

    setGuardando(false);

    if (errorGuardado) {
      setError('No se pudo guardar la configuración. Intenta de nuevo.');
      return;
    }

    setMensajeExito('Configuración guardada correctamente.');
  };

  return (
    <section className="panel-ajustes-mostrador">
      <div className="panel-ajustes-mostrador-cabecera">
        <h2 className="panel-ajustes-mostrador-titulo">Ajustes de Mostrador</h2>
        <p className="panel-ajustes-mostrador-descripcion">
          Define quién completa la entrega del pedido al cliente en ventas de mostrador.
        </p>
      </div>

      {cargando ? (
        <p className="panel-ajustes-mostrador-estado">Cargando configuración…</p>
      ) : (
        <form className="panel-ajustes-mostrador-formulario" onSubmit={guardar}>
          <fieldset className="panel-ajustes-mostrador-opciones">
            <legend className="panel-ajustes-mostrador-pregunta">
              ¿Quién completa la entrega del pedido al cliente?
            </legend>
            {OPCIONES_FLUJO.map((opcion) => (
              <label key={opcion.value} className="panel-ajustes-mostrador-opcion">
                <input
                  type="radio"
                  name="mostrador-flujo-cocina"
                  value={opcion.value}
                  checked={valor === opcion.value}
                  onChange={() => setValor(opcion.value)}
                />
                <span>{opcion.label}</span>
              </label>
            ))}
          </fieldset>

          {error ? (
            <p className="panel-ajustes-mostrador-error" role="alert">
              {error}
            </p>
          ) : null}
          {mensajeExito ? (
            <p className="panel-ajustes-mostrador-exito" role="status">
              {mensajeExito}
            </p>
          ) : null}

          <button
            type="submit"
            className="guardar-btn panel-ajustes-mostrador-guardar"
            disabled={guardando}
          >
            {guardando ? 'Guardando…' : 'Guardar ajustes'}
          </button>
        </form>
      )}
    </section>
  );
}
