import { useEffect, useMemo, useState } from 'react';
import './App.css';
import './VistaClientes.css';
import './VistaInventario.css';
import DashboardHeaderReservaMovil from './DashboardHeaderReservaMovil';
import DashboardNav from './DashboardNav';
import PanelInsumos from './PanelInsumos';
import PanelEmpleados from './PanelEmpleados';
import { useAuth } from './AuthContext';

const INVENTARIO_TABS = [
  { value: 'insumos', label: 'Catálogo de insumos' },
  { value: 'empleados', label: 'Catálogo de empleados' },
];

const STORAGE_KEY_TAB_INVENTARIO = 'pos_tab_inventario';

function valoresTabInventarioValidos() {
  return new Set(INVENTARIO_TABS.map(({ value }) => value));
}

function persistirTabInventario(tab) {
  if (typeof window === 'undefined' || !valoresTabInventarioValidos().has(tab)) return;

  try {
    window.localStorage.setItem(STORAGE_KEY_TAB_INVENTARIO, tab);
  } catch {
    // Ignorar errores de almacenamiento local.
  }
}

function cargarTabInventario() {
  const validos = valoresTabInventarioValidos();
  if (typeof window === 'undefined') return 'insumos';

  try {
    const tab = window.localStorage.getItem(STORAGE_KEY_TAB_INVENTARIO);
    return validos.has(tab) ? tab : 'insumos';
  } catch {
    return 'insumos';
  }
}

export default function VistaInventario() {
  const { negocioId, rol } = useAuth();
  const [tabActivo, setTabActivo] = useState(() => cargarTabInventario());

  const tabs = useMemo(() => INVENTARIO_TABS, []);

  useEffect(() => {
    persistirTabInventario(tabActivo);
  }, [tabActivo]);

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
        {tabActivo === 'empleados' ? <PanelEmpleados negocioId={negocioId} /> : null}
      </main>
    </div>
  );
}
