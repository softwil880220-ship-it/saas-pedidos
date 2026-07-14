import { useMemo, useState } from 'react';
import './App.css';
import './VistaEquipo.css';
import DashboardHeaderReservaMovil from './DashboardHeaderReservaMovil';
import DashboardNav from './DashboardNav';
import PanelCajeros from './PanelCajeros';
import PanelPinSeguridad from './PanelPinSeguridad';
import PanelAjustesMostrador from './PanelAjustesMostrador';
import { useAuth } from './AuthContext';

const ROLES_PIN_SEGURIDAD = ['dueno', 'administrador'];
const ROLES_AJUSTES_MOSTRADOR = ['dueno', 'administrador'];

export default function VistaEquipo() {
  const { negocioId, rol } = useAuth();
  const [tabEquipo, setTabEquipo] = useState('usuarios');

  const puedeConfigurarPin = ROLES_PIN_SEGURIDAD.includes(rol);
  const puedeConfigurarMostrador = ROLES_AJUSTES_MOSTRADOR.includes(rol);

  const tabsEquipo = useMemo(() => {
    const tabs = [{ value: 'usuarios', label: 'Usuarios' }];
    if (puedeConfigurarPin) {
      tabs.push({ value: 'pin-seguridad', label: 'PIN de seguridad' });
    }
    if (puedeConfigurarMostrador) {
      tabs.push({ value: 'ajustes-mostrador', label: 'Ajustes de Mostrador' });
    }
    return tabs;
  }, [puedeConfigurarPin, puedeConfigurarMostrador]);

  const tabActivo = tabsEquipo.some((tab) => tab.value === tabEquipo)
    ? tabEquipo
    : 'usuarios';

  return (
    <div className="dashboard">
      <DashboardHeaderReservaMovil />

      <main className="dashboard-main">
        <DashboardNav activo="equipo" rol={rol} />

        {tabsEquipo.length > 1 ? (
          <nav className="equipo-seccion-nav" aria-label="Secciones de equipo">
            {tabsEquipo.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={`equipo-seccion-tab${tabActivo === value ? ' activo' : ''}`}
                onClick={() => setTabEquipo(value)}
              >
                {label}
              </button>
            ))}
          </nav>
        ) : null}

        {tabActivo === 'usuarios' ? <PanelCajeros negocioId={negocioId} /> : null}
        {tabActivo === 'pin-seguridad' && puedeConfigurarPin ? <PanelPinSeguridad /> : null}
        {tabActivo === 'ajustes-mostrador' && puedeConfigurarMostrador ? (
          <PanelAjustesMostrador negocioId={negocioId} />
        ) : null}
      </main>
    </div>
  );
}
