import { useState } from 'react';
import { supabase } from './supabase';
import './PanelPinSeguridad.css';

function pinAutorizacionValido(pin) {
  return /^\d{4}$/.test(pin);
}

function formularioVacio() {
  return {
    pinNuevo: '',
    pinConfirmar: '',
  };
}

export default function PanelPinSeguridad() {
  const [formulario, setFormulario] = useState(formularioVacio);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [mensajeExito, setMensajeExito] = useState(null);

  const actualizarPin = (campo, valor) => {
    setFormulario((prev) => ({
      ...prev,
      [campo]: valor.replace(/\D/g, '').slice(0, 4),
    }));
  };

  const guardarPin = async (event) => {
    event.preventDefault();
    setError(null);
    setMensajeExito(null);

    const pinNuevo = formulario.pinNuevo.trim();
    const pinConfirmar = formulario.pinConfirmar.trim();

    if (!pinAutorizacionValido(pinNuevo) || !pinAutorizacionValido(pinConfirmar)) {
      setError('Ambos campos deben tener exactamente 4 dígitos numéricos.');
      return;
    }

    if (pinNuevo !== pinConfirmar) {
      setError('Los PIN no coinciden.');
      return;
    }

    setGuardando(true);

    const { data, error: errorInvoke } = await supabase.functions.invoke('panel-pin-autorizacion', {
      body: {
        action: 'configurar',
        pin: pinNuevo,
      },
    });

    if (errorInvoke || data?.success === false) {
      setError('No se pudo guardar el PIN. Intenta de nuevo.');
      setGuardando(false);
      return;
    }

    setGuardando(false);
    setFormulario(formularioVacio());
    setMensajeExito('PIN actualizado correctamente');
  };

  return (
    <section className="panel-pin-seguridad">
      <div className="panel-pin-seguridad-cabecera">
        <h2 className="panel-pin-seguridad-titulo">PIN de seguridad</h2>
        <p className="panel-pin-seguridad-descripcion">
          Configura tu PIN de autorización de 4 dígitos para acciones sensibles como fondo fijo,
          retiros y arqueos.
        </p>
      </div>

      <form className="panel-pin-seguridad-formulario" onSubmit={guardarPin}>
        <label className="panel-pin-seguridad-campo" htmlFor="panel-pin-seguridad-nuevo">
          <span>Nuevo PIN</span>
          <input
            id="panel-pin-seguridad-nuevo"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            pattern="\d{4}"
            maxLength={4}
            value={formulario.pinNuevo}
            onChange={(event) => actualizarPin('pinNuevo', event.target.value)}
            required
          />
        </label>

        <label className="panel-pin-seguridad-campo" htmlFor="panel-pin-seguridad-confirmar">
          <span>Confirmar PIN</span>
          <input
            id="panel-pin-seguridad-confirmar"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            pattern="\d{4}"
            maxLength={4}
            value={formulario.pinConfirmar}
            onChange={(event) => actualizarPin('pinConfirmar', event.target.value)}
            required
          />
        </label>

        {error ? <p className="panel-pin-seguridad-error">{error}</p> : null}
        {mensajeExito ? <p className="panel-pin-seguridad-exito">{mensajeExito}</p> : null}

        <div className="panel-pin-seguridad-acciones">
          <button
            type="submit"
            className="panel-pin-seguridad-guardar"
            disabled={guardando}
          >
            {guardando ? 'Guardando…' : 'Guardar PIN'}
          </button>
        </div>
      </form>
    </section>
  );
}
