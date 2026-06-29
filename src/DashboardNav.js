import { useNavigate } from 'react-router-dom';

export const DASHBOARD_NAV_ITEMS = [
  { id: 'pedidos', label: 'Pedidos', path: '/' },
  { id: 'catalogo', label: 'Catálogo de productos', path: '/catalogo' },
  { id: 'reportes', label: 'Reportes', path: '/reportes' },
  { id: 'equipo', label: 'Equipo', path: '/equipo', soloDueno: true },
];

export default function DashboardNav({ activo, rol }) {
  const navigate = useNavigate();
  const items = DASHBOARD_NAV_ITEMS.filter(
    (item) => !item.soloDueno || rol === 'dueno'
  );

  return (
    <nav className="dashboard-nav">
      {items.map(({ id, label, path }) => (
        <button
          key={id}
          type="button"
          className={`nav-btn${activo === id ? ' activo' : ''}`}
          onClick={() => navigate(path)}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
