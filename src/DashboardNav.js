import { useNavigate } from 'react-router-dom';

export const DASHBOARD_NAV_ITEMS = [
  { id: 'pedidos', label: 'Pedidos', path: '/' },
  { id: 'catalogo', label: 'Catálogo de productos', path: '/catalogo' },
  { id: 'reportes', label: 'Reportes', path: '/reportes' },
];

export default function DashboardNav({ activo }) {
  const navigate = useNavigate();

  return (
    <nav className="dashboard-nav">
      {DASHBOARD_NAV_ITEMS.map(({ id, label, path }) => (
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
