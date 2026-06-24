import { useEffect, useState } from 'react';
import BotonCerrarSesion from './BotonCerrarSesion';
import { useAuth } from './AuthContext';
import { supabase } from './supabase';

export default function DashboardHeaderReservaMovil({ nombreNegocio: nombreNegocioProp = '' }) {
  const { negocioId } = useAuth();
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
          <span className="header-stat-fecha">{nombreNegocio}</span>
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
