import { useNavigate } from 'react-router-dom';

export const DASHBOARD_NAV_ITEMS = [
  { id: 'pedidos', label: 'Pedidos', path: '/', rolesPermitidos: ['dueno', 'administrador', 'cajero'] },
  { id: 'catalogo', label: 'Catálogo de productos', path: '/catalogo', rolesPermitidos: ['dueno', 'administrador'] },
  { id: 'reportes', label: 'Reportes', path: '/reportes', rolesPermitidos: ['dueno', 'administrador'] },
  { id: 'equipo', label: 'Equipo', path: '/equipo', rolesPermitidos: ['dueno'] },
];

export default function DashboardNav({ activo, rol }) {
  const navigate = useNavigate();
  const items = DASHBOARD_NAV_ITEMS.filter((item) =>
    rol ? item.rolesPermitidos.includes(rol) : false
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
