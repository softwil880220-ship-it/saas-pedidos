import { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from './supabase';
import './ModalAutorizacionPin.css';

const TITULO_DEFAULT = 'Ingresa el PIN de autorización';

function pinAutorizacionValido(pin) {
  return /^\d{4}$/.test(pin);
}

function formatearTiempoRestante(segundos) {
  const minutos = Math.floor(segundos / 60);
  const segundosRestantes = segundos % 60;
  return `${minutos}:${String(segundosRestantes).padStart(2, '0')}`;
}

export default function ModalAutorizacionPin({
  visible,
  onClose,
  onAutorizado,
  titulo = TITULO_DEFAULT,
}) {
  const { negocioId } = useAuth();
  const [pin, setPin] = useState('');
  const [verificando, setVerificando] = useState(false);
  const [error, setError] = useState(null);
  const [bloqueadoHasta, setBloqueadoHasta] = useState(null);
  const [segundosRestantes, setSegundosRestantes] = useState(0);

  useEffect(() => {
    if (!visible) {
      setPin('');
      setError(null);
      setVerificando(false);
      setBloqueadoHasta(null);
      setSegundosRestantes(0);
    }
  }, [visible]);

  useEffect(() => {
    if (!bloqueadoHasta) {
      setSegundosRestantes(0);
      return undefined;
    }

    const actualizarRestante = () => {
      const restanteMs = new Date(bloqueadoHasta).getTime() - Date.now();
      const restanteSegundos = Math.max(0, Math.ceil(restanteMs / 1000));
      setSegundosRestantes(restanteSegundos);

      if (restanteSegundos <= 0) {
        setBloqueadoHasta(null);
        setError(null);
      }
    };

    actualizarRestante();
    const intervalo = setInterval(actualizarRestante, 1000);
    return () => clearInterval(intervalo);
  }, [bloqueadoHasta]);

  if (!visible) {
    return null;
  }

  const estaBloqueado = Boolean(bloqueadoHasta) && segundosRestantes > 0;

  const cerrarModal = () => {
    if (verificando) return;
    setPin('');
    setError(null);
    setBloqueadoHasta(null);
    setSegundosRestantes(0);
    onClose();
  };

  const autorizar = async (event) => {
    event.preventDefault();
    if (estaBloqueado) return;

    setError(null);

    const pinIngresado = pin.trim();

    if (!pinAutorizacionValido(pinIngresado)) {
      setError('El PIN debe tener exactamente 4 dígitos numéricos.');
      return;
    }

    if (!negocioId) {
      setError('PIN incorrecto');
      return;
    }

    setVerificando(true);

    const { data, error: errorInvoke } = await supabase.functions.invoke('panel-pin-autorizacion', {
      body: {
        action: 'verificar',
        negocio_id: negocioId,
        pin: pinIngresado,
      },
    });

    setVerificando(false);

    if (errorInvoke || data?.success === false) {
      setPin('');
      setError('PIN incorrecto');
      return;
    }

    if (data?.data?.bloqueado === true && data?.data?.bloqueado_hasta) {
      setPin('');
      setBloqueadoHasta(data.data.bloqueado_hasta);
      return;
    }

    if (data?.data?.autorizado === true) {
      onAutorizado({
        autorizado_por: data.data.autorizado_por,
        nombre: data.data.nombre,
      });
      setPin('');
      setError(null);
      setBloqueadoHasta(null);
      setSegundosRestantes(0);
      onClose();
      return;
    }

    setPin('');
    setError('PIN incorrecto');
  };

  return (
    <div className="modal-autorizacion-pin-overlay" onClick={cerrarModal}>
      <div
        className="modal-autorizacion-pin"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-autorizacion-pin-titulo"
      >
        <h3 id="modal-autorizacion-pin-titulo" className="modal-autorizacion-pin-titulo">
          {titulo}
        </h3>

        <form onSubmit={autorizar}>
          <label className="modal-autorizacion-pin-campo" htmlFor="modal-autorizacion-pin-input">
            <span>PIN de autorización</span>
            <input
              id="modal-autorizacion-pin-input"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              pattern="\d{4}"
              maxLength={4}
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
              disabled={verificando || estaBloqueado}
              required
            />
          </label>

          {estaBloqueado ? (
            <p className="modal-autorizacion-pin-bloqueo" role="alert">
              Alcanzaste el límite de intentos. Intenta de nuevo en{' '}
              {formatearTiempoRestante(segundosRestantes)}.
            </p>
          ) : null}

          {!estaBloqueado && error ? (
            <p className="modal-autorizacion-pin-error">{error}</p>
          ) : null}

          <div className="modal-autorizacion-pin-acciones">
            <button
              type="button"
              className="modal-autorizacion-pin-cancelar"
              onClick={cerrarModal}
              disabled={verificando}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="modal-autorizacion-pin-autorizar"
              disabled={verificando || estaBloqueado}
            >
              {verificando ? 'Verificando…' : 'Autorizar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
