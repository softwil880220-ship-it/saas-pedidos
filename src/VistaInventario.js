import { useMemo, useState } from 'react';
import './App.css';
import './VistaClientes.css';
import './VistaInventario.css';
import DashboardHeaderReservaMovil from './DashboardHeaderReservaMovil';
import DashboardNav from './DashboardNav';
import PanelInsumos from './PanelInsumos';
import { useAuth } from './AuthContext';

const INVENTARIO_TABS = [{ value: 'insumos', label: 'Catálogo de insumos' }];

export default function VistaInventario() {
  const { negocioId, rol } = useAuth();
  const [tabActivo, setTabActivo] = useState('insumos');

  const tabs = useMemo(() => INVENTARIO_TABS, []);

  return (
    <div className="dashboard">
      <DashboardHeaderReservaMovil />

      <main className="dashboard-main">
        <DashboardNav activo="inventario" rol={rol} />

        <nav className="clientes-seccion-nav" aria-label="Secciones de inventario">
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

        {tabActivo === 'insumos' ? <PanelInsumos negocioId={negocioId} /> : null}
      </main>
    </div>
  );
}
