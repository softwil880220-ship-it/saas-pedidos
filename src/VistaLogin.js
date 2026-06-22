import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import './App.css';
import { useAuth } from './AuthContext';

export default function VistaLogin() {
  const { session, usuario, cargando, errorAuth, iniciarSesion } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [errorLocal, setErrorLocal] = useState(null);

  const destino = location.state?.from?.pathname || '/';

  if (!cargando && session && usuario?.negocio_id) {
    return <Navigate to={destino} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorLocal(null);
    setEnviando(true);

    const { error } = await iniciarSesion(email.trim(), password);

    setEnviando(false);

    if (error) {
      setErrorLocal('Correo o contraseña incorrectos.');
      return;
    }

    navigate(destino, { replace: true });
  };

  return (
    <div className="login-vista">
      <div className="login-tarjeta">
        <h1 className="login-titulo">Iniciar sesión</h1>
        <p className="login-subtitulo">Accede a tu negocio</p>

        <form className="login-formulario" onSubmit={handleSubmit}>
          <label className="login-campo" htmlFor="login-email">
            <span>Correo</span>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="login-campo" htmlFor="login-password">
            <span>Contraseña</span>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {errorLocal || errorAuth ? (
            <p className="login-error" role="alert">
              {errorLocal || errorAuth}
            </p>
          ) : null}

          <button type="submit" className="login-btn" disabled={enviando || cargando}>
            {enviando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
