import { useMemo, useState } from 'react';
import './App.css';
import './VistaClientes.css';
import DashboardHeaderReservaMovil from './DashboardHeaderReservaMovil';
import DashboardNav from './DashboardNav';
import PanelClientes from './PanelClientes';
import PanelZonas from './PanelZonas';
import { useAuth } from './AuthContext';

const CLIENTES_TABS = [
  { value: 'clientes', label: 'Clientes' },
  { value: 'zonas', label: 'Zonas de entrega' },
];

export default function VistaClientes() {
  const { negocioId, rol } = useAuth();
  const [tabActivo, setTabActivo] = useState('clientes');

  const tabs = useMemo(() => CLIENTES_TABS, []);

  return (
    <div className="dashboard">
      <DashboardHeaderReservaMovil />

      <main className="dashboard-main">
        <DashboardNav activo="clientes" rol={rol} />

        <nav className="clientes-seccion-nav" aria-label="Secciones de clientes">
          {tabs.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={`clientes-seccion-tab${tabActivo === value ? ' activo' : ''}`}
              onClick={() => setTabActivo(value)}
            >
              {label}
            </button>
          ))}
        </nav>

        {tabActivo === 'clientes' ? <PanelClientes negocioId={negocioId} /> : null}
        {tabActivo === 'zonas' ? <PanelZonas negocioId={negocioId} /> : null}
      </main>
    </div>
  );
}
