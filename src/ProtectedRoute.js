import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, rutaPorRol } from './AuthContext';

export default function ProtectedRoute({
  children,
  rolesPermitidos,
  requiereHabilitarClientes = false,
}) {
  const { session, usuario, rol, cargando, modulosNegocio } = useAuth();
  const location = useLocation();

  if (cargando) {
    return (
      <div className="auth-cargando">
        <p>Cargando sesión...</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!usuario?.negocio_id) {
    return (
      <div className="auth-cargando">
        <p>No se encontró un negocio asociado a este usuario.</p>
      </div>
    );
  }

  if (rolesPermitidos && !rolesPermitidos.includes(rol)) {
    return <Navigate to={rutaPorRol(rol)} replace />;
  }

  if (requiereHabilitarClientes && !modulosNegocio.habilitar_clientes) {
    return <Navigate to={rutaPorRol(rol)} replace />;
  }

  return children;
}
