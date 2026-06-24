import { useEffect, useState } from 'react';
import BotonCerrarSesion from './BotonCerrarSesion';
import { useAuth } from './AuthContext';
import { supabase } from './supabase';
import useEsMobile from './useEsMobile';

const PADDING_HEADER_CERRAR_SESION = '7.75rem';

function estiloNombreNegocioHeaderDelgado(esMobile) {
  return {
    flex: 1,
    minWidth: 0,
    paddingRight: PADDING_HEADER_CERRAR_SESION,
    color: '#fff',
    fontSize: esMobile ? '1.05rem' : '1.25rem',
    fontWeight: 600,
    lineHeight: 1.35,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: esMobile ? 2 : 1,
    WebkitBoxOrient: 'vertical',
    wordBreak: 'break-word',
  };
}

export default function DashboardHeaderReservaMovil({ nombreNegocio: nombreNegocioProp = '' }) {
  const { negocioId } = useAuth();
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

  return (
    <header className="dashboard-header">
      <div className="header-top">
        {nombreNegocio ? (
          <span style={estiloNombreNegocioHeaderDelgado(esMobile)}>{nombreNegocio}</span>
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
