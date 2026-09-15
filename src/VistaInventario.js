import { useEffect, useMemo, useState } from 'react';
import './App.css';
import './VistaClientes.css';
import './VistaInventario.css';
import DashboardHeaderReservaMovil from './DashboardHeaderReservaMovil';
import DashboardNav from './DashboardNav';
import PanelInsumos from './PanelInsumos';
import PanelEmpleados from './PanelEmpleados';
import PanelCargaDiaria from './PanelCargaDiaria';
import { useAuth } from './AuthContext';

const ROLES_CATALOGO_INVENTARIO = ['dueno', 'administrador'];

const INVENTARIO_TABS = [
  {
    value: 'insumos',
    label: 'Catálogo de insumos',
    rolesPermitidos: ROLES_CATALOGO_INVENTARIO,
  },
  {
    value: 'empleados',
    label: 'Catálogo de empleados',
    rolesPermitidos: ROLES_CATALOGO_INVENTARIO,
  },
  {
    value: 'carga-diaria',
    label: 'Carga diaria',
    rolesPermitidos: ['dueno', 'administrador', 'cajero'],
  },
];

const STORAGE_KEY_TAB_INVENTARIO = 'pos_tab_inventario';

function tabsInventarioVisibles(rol) {
  if (!rol) return [];

  return INVENTARIO_TABS.filter((tab) => tab.rolesPermitidos.includes(rol));
}

function tabInventarioDefault(rol) {
  if (rol === 'cajero') return 'carga-diaria';
  return 'insumos';
}

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

function cargarTabInventario(rol) {
  const visibles = tabsInventarioVisibles(rol);
  const validos = new Set(visibles.map(({ value }) => value));
  const fallback = tabInventarioDefault(rol);

  if (typeof window === 'undefined') return fallback;

  try {
    const tab = window.localStorage.getItem(STORAGE_KEY_TAB_INVENTARIO);
    return validos.has(tab) ? tab : fallback;
  } catch {
    return fallback;
  }
}

export default function VistaInventario() {
  const { negocioId, rol } = useAuth();
  const [tabActivo, setTabActivo] = useState(() => cargarTabInventario(rol));

  const tabs = useMemo(() => tabsInventarioVisibles(rol), [rol]);
  const puedeVerCatalogos = ROLES_CATALOGO_INVENTARIO.includes(rol);

  useEffect(() => {
    const permitidos = new Set(tabs.map(({ value }) => value));

    if (permitidos.has(tabActivo)) {
      return;
    }

    setTabActivo(tabs[0]?.value ?? tabInventarioDefault(rol));
  }, [rol, tabActivo, tabs]);

  useEffect(() => {
    persistirTabInventario(tabActivo);
  }, [tabActivo]);

  return (
    <div className="dashboard">
      <DashboardHeaderReservaMovil />

      <main className="dashboard-main">
        <DashboardNav activo="inventario" rol={rol} />

        {tabs.length > 1 ? (
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
        ) : null}

        {tabActivo === 'insumos' && puedeVerCatalogos ? (
          <PanelInsumos negocioId={negocioId} />
        ) : null}
        {tabActivo === 'empleados' && puedeVerCatalogos ? (
          <PanelEmpleados negocioId={negocioId} />
        ) : null}
        {tabActivo === 'carga-diaria' ? (
          <PanelCargaDiaria negocioId={negocioId} rol={rol} />
        ) : null}
      </main>
    </div>
  );
}
