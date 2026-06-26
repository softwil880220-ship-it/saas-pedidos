import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BotonCerrarSesion from './BotonCerrarSesion';
import { useAuth } from './AuthContext';
import { supabase } from './supabase';
import useEsMobile from './useEsMobile';

const PADDING_HEADER_CERRAR_SESION = '7.75rem';

const estiloBotonCerrarSesionMovil = {
  position: 'static',
  padding: '0.4rem 0.75rem',
  border: '1px solid rgba(255, 255, 255, 0.5)',
  borderRadius: 6,
  background: 'transparent',
  color: '#fff',
  fontSize: '0.85rem',
  fontWeight: 500,
  cursor: 'pointer',
};

const estiloHeaderDelgadoMovil = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: '0.5rem',
};

const estiloFilaCerrarSesionMovil = {
  display: 'flex',
  justifyContent: 'flex-end',
  width: '100%',
};

function estiloNombreNegocioMovilSegundaLinea() {
  return {
    display: 'block',
    width: '100%',
    color: '#fff',
    fontSize: '13px',
    fontWeight: 600,
    lineHeight: 1.35,
    textAlign: 'left',
    whiteSpace: 'normal',
    wordBreak: 'break-word',
  };
}

function estiloNombreNegocioHeaderDelgadoWeb() {
  return {
    flex: 1,
    minWidth: 0,
    paddingRight: PADDING_HEADER_CERRAR_SESION,
    color: '#fff',
    fontWeight: 600,
    fontSize: '1.25rem',
    lineHeight: 1.35,
    display: 'block',
    whiteSpace: 'normal',
    wordBreak: 'break-word',
  };
}

export default function DashboardHeaderReservaMovil({ nombreNegocio: nombreNegocioProp = '' }) {
  const { negocioId, cerrarSesion } = useAuth();
  const navigate = useNavigate();
  const esMobile = useEsMobile(720);
  const [nombreNegocioLocal, setNombreNegocioLocal] = useState('');

  useEffect(() => {
    let activo = true;

    if (nombreNegocioProp || !negocioId) {
      setNombreNegocioLocal('');
      return undefined;
    }

    const cargarNombreNegocio = async () => {
      const { data, error } = await supabase
        .from('negocios')
        .select('nombre')
        .eq('id', negocioId)
        .maybeSingle();

      if (!activo) return;

      setNombreNegocioLocal(!error && data?.nombre?.trim() ? data.nombre.trim() : '');
    };

    cargarNombreNegocio();

    return () => {
      activo = false;
    };
  }, [negocioId, nombreNegocioProp]);

  const nombreNegocio = nombreNegocioProp || nombreNegocioLocal;

  const handleCerrarSesion = async () => {
    await cerrarSesion();
    navigate('/login', { replace: true });
  };

  if (esMobile) {
    return (
      <header className="dashboard-header" style={estiloHeaderDelgadoMovil}>
        <div style={estiloFilaCerrarSesionMovil}>
          <button type="button" style={estiloBotonCerrarSesionMovil} onClick={handleCerrarSesion}>
            Cerrar sesión
          </button>
        </div>
        {nombreNegocio ? (
          <span style={estiloNombreNegocioMovilSegundaLinea()}>{nombreNegocio}</span>
        ) : null}
      </header>
    );
  }

  return (
    <header className="dashboard-header">
      <div className="header-top">
        {nombreNegocio ? (
          <span style={estiloNombreNegocioHeaderDelgadoWeb()}>{nombreNegocio}</span>
        ) : null}
        <div className="dashboard-header-reserva-movil" aria-hidden="true">
          <div className="header-top">
            <h1>Reportes</h1>
            <p className="reportes-periodo-activo">
              Semana actual (junio 2026) 01 jun 2026 - 15 jun 2026
            </p>
          </div>
        </div>
      </div>
      <BotonCerrarSesion />
    </header>
  );
}
