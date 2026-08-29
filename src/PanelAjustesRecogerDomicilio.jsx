import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { MINUTOS_ANTICIPACION_COCINA_DEFAULT, normalizarMinutosAnticipacionCocina } from './pedidosProgramadosHelpers';
import './PanelAjustesRecogerDomicilio.css';

export default function PanelAjustesRecogerDomicilio({ negocioId }) {
  const [valor, setValor] = useState(MINUTOS_ANTICIPACION_COCINA_DEFAULT);
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
        .select('minutos_anticipacion_cocina')
        .eq('id', negocioId)
        .maybeSingle();

      if (!activo) return;

      if (errorConsulta) {
        setError('No se pudo cargar la configuración de Recoger/Domicilio.');
        setCargando(false);
        return;
      }

      setValor(normalizarMinutosAnticipacionCocina(data?.minutos_anticipacion_cocina));
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

    const minutos = normalizarMinutosAnticipacionCocina(valor);

    const { error: errorGuardado } = await supabase
      .from('negocios')
      .update({ minutos_anticipacion_cocina: minutos })
      .eq('id', negocioId);

    setGuardando(false);

    if (errorGuardado) {
      setError('No se pudo guardar la configuración. Intenta de nuevo.');
      return;
    }

    setValor(minutos);
    setMensajeExito('Configuración guardada correctamente.');
  };

  return (
    <section className="panel-ajustes-recoger-domicilio">
      <div className="panel-ajustes-recoger-domicilio-cabecera">
        <h2 className="panel-ajustes-recoger-domicilio-titulo">Ajustes de Recoger/Domicilio</h2>
        <p className="panel-ajustes-recoger-domicilio-descripcion">
          Configura cuánto antes de la hora prometida un pedido programado pasa a Tiempo real en
          Vista Cocina.
        </p>
      </div>

      {cargando ? (
        <p className="panel-ajustes-recoger-domicilio-estado">Cargando configuración…</p>
      ) : (
        <form className="panel-ajustes-recoger-domicilio-formulario" onSubmit={guardar}>
          <label className="panel-ajustes-recoger-domicilio-campo" htmlFor="minutos-anticipacion-cocina">
            Minutos de anticipación para cocina
            <input
              id="minutos-anticipacion-cocina"
              type="number"
              min="0"
              step="1"
              value={valor}
              onChange={(evento) => setValor(evento.target.value)}
              required
            />
          </label>
          <p className="panel-ajustes-recoger-domicilio-ayuda">
            Ejemplo: con 30 minutos, un pedido programado para las 3:00 p.m. aparecerá en Tiempo
            real a las 2:30 p.m.
          </p>

          {error ? (
            <p className="panel-ajustes-recoger-domicilio-error" role="alert">
              {error}
            </p>
          ) : null}
          {mensajeExito ? (
            <p className="panel-ajustes-recoger-domicilio-exito" role="status">
              {mensajeExito}
            </p>
          ) : null}

          <button
            type="submit"
            className="guardar-btn panel-ajustes-recoger-domicilio-guardar"
            disabled={guardando}
          >
            {guardando ? 'Guardando…' : 'Guardar ajustes'}
          </button>
        </form>
      )}
    </section>
  );
}
