import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function ProtectedRoute({ children }) {
  const { session, usuario, cargando } = useAuth();
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

  return children;
}
