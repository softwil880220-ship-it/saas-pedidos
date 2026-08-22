import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export const DASHBOARD_NAV_ITEMS = [
  { id: 'pedidos', label: 'Pedidos', path: '/', rolesPermitidos: ['dueno', 'administrador', 'cajero'] },
  { id: 'catalogo', label: 'Catálogo de productos', path: '/catalogo', rolesPermitidos: ['dueno', 'administrador'] },
  { id: 'clientes', label: 'Clientes', path: '/clientes', rolesPermitidos: ['dueno', 'administrador'] },
  { id: 'reportes', label: 'Reportes', path: '/reportes', rolesPermitidos: ['dueno', 'administrador'] },
  { id: 'equipo', label: 'Equipo', path: '/equipo', rolesPermitidos: ['dueno', 'administrador'] },
];

export default function DashboardNav({ activo, rol }) {
  const navigate = useNavigate();
  const { modulosNegocio } = useAuth();
  const items = DASHBOARD_NAV_ITEMS.filter((item) => {
    if (!rol || !item.rolesPermitidos.includes(rol)) return false;
    if (item.id === 'clientes') return modulosNegocio.habilitar_clientes === true;
    return true;
  });

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
