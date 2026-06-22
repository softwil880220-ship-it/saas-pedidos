import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function BotonCerrarSesion() {
  const { cerrarSesion } = useAuth();
  const navigate = useNavigate();

  const handleClick = async () => {
    await cerrarSesion();
    navigate('/login', { replace: true });
  };

  return (
    <button type="button" className="header-logout-btn" onClick={handleClick}>
      Cerrar sesión
    </button>
  );
}
