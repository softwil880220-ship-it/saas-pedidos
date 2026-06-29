import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { supabaseAdmin } from './supabaseAdmin';
import { queryConNegocio } from './tenantHelpers';
import useEsMobile from './useEsMobile';
import './PanelCajeros.css';

const ROLES_AGREGAR = [
  { value: 'cajero', label: 'Cajero' },
  { value: 'cocina', label: 'Cocina' },
  { value: 'cocina2', label: 'Cocina 2' },
  { value: 'repartidor', label: 'Repartidor' },
  { value: 'administrador', label: 'Administrador' },
];

const ETIQUETAS_ROL = {
  dueno: 'Dueño',
  administrador: 'Administrador',
  cajero: 'Cajero',
  cocina: 'Cocina',
  cocina2: 'Cocina 2',
  repartidor: 'Repartidor',
  mesero: 'Mesero',
};

function etiquetaRol(rol) {
  return ETIQUETAS_ROL[rol] ?? rol ?? '—';
}

function pinValido(pin) {
  return /^\d{4,6}$/.test(pin);
}

function formularioVacio() {
  return {
    nombre: '',
    email: '',
    rol: 'cajero',
    pin: '',
  };
}

export default function PanelCajeros({ negocioId }) {
  const esMobile = useEsMobile(720);
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [formulario, setFormulario] = useState(formularioVacio);
  const [guardando, setGuardando] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState(null);
  const [actualizandoId, setActualizandoId] = useState(null);

  const cargarUsuarios = useCallback(async () => {
    if (!negocioId) {
      setUsuarios([]);
      setCargando(false);
      return;
    }

    setCargando(true);
    setError(null);

    const { data, error: errorQuery } = await queryConNegocio(
      supabase
        .from('usuarios_negocio')
        .select('id, negocio_id, rol, nombre, email, activo')
        .order('nombre', { ascending: true }),
      negocioId
    );

    if (errorQuery) {
      setError(errorQuery.message);
      setUsuarios([]);
    } else {
      setUsuarios(data ?? []);
    }

    setCargando(false);
  }, [negocioId]);

  useEffect(() => {
    cargarUsuarios();
  }, [cargarUsuarios]);

  const abrirModal = () => {
    setFormulario(formularioVacio());
    setErrorFormulario(null);
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    if (guardando) return;
    setModalAbierto(false);
    setErrorFormulario(null);
  };

  const cambiarActivo = async (usuario, activo) => {
    setActualizandoId(usuario.id);
    setError(null);

    const { error: errorUpdate } = await supabase
      .from('usuarios_negocio')
      .update({ activo })
      .eq('id', usuario.id)
      .eq('negocio_id', negocioId);

    if (errorUpdate) {
      setError(errorUpdate.message);
    } else {
      setUsuarios((prev) =>
        prev.map((item) => (item.id === usuario.id ? { ...item, activo } : item))
      );
    }

    setActualizandoId(null);
  };

  const guardarUsuario = async (event) => {
    event.preventDefault();
    setErrorFormulario(null);

    const nombre = formulario.nombre.trim();
    const email = formulario.email.trim().toLowerCase();
    const { rol, pin } = formulario;

    if (!nombre) {
      setErrorFormulario('El nombre es obligatorio.');
      return;
    }

    if (!email) {
      setErrorFormulario('El correo es obligatorio.');
      return;
    }

    if (!pinValido(pin)) {
      setErrorFormulario('El PIN debe ser numérico de 4 a 6 dígitos.');
      return;
    }

    if (!supabaseAdmin) {
      setErrorFormulario(
        'Falta REACT_APP_SUPABASE_SERVICE_ROLE_KEY (solo DEV).'
      );
      return;
    }

    setGuardando(true);

    const { data: authData, error: errorAuth } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: pin,
        email_confirm: true,
      });

    if (errorAuth) {
      setErrorFormulario(errorAuth.message);
      setGuardando(false);
      return;
    }

    const { error: errorInsert } = await supabase.from('usuarios_negocio').insert({
      negocio_id: negocioId,
      rol,
      nombre,
      email,
      supabase_user_id: authData.user.id,
      pin_hash: pin,
      activo: true,
    });

    if (errorInsert) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      setErrorFormulario(errorInsert.message);
      setGuardando(false);
      return;
    }

    setGuardando(false);
    setModalAbierto(false);
    setFormulario(formularioVacio());
    await cargarUsuarios();
  };

  const renderToggle = (usuario) => (
    <label className="panel-cajeros-toggle">
      <input
        type="checkbox"
        checked={Boolean(usuario.activo)}
        disabled={actualizandoId === usuario.id}
        onChange={(event) => cambiarActivo(usuario, event.target.checked)}
      />
      <span>{usuario.activo ? 'Activo' : 'Inactivo'}</span>
    </label>
  );

  const renderEstado = (usuario) => (
    <span className={`panel-cajeros-estado ${usuario.activo ? 'activo' : 'inactivo'}`}>
      {usuario.activo ? 'Activo' : 'Inactivo'}
    </span>
  );

  return (
    <section className="panel-cajeros">
      <div className="panel-cajeros-cabecera">
        <h2 className="panel-cajeros-titulo">Equipo</h2>
        <button type="button" className="panel-cajeros-agregar-btn" onClick={abrirModal}>
          Agregar usuario
        </button>
      </div>

      {error ? <p className="panel-cajeros-error">{error}</p> : null}

      {cargando ? (
        <p className="panel-cajeros-cargando">Cargando usuarios...</p>
      ) : usuarios.length === 0 ? (
        <div className="panel-cajeros-vacio">
          <p>Aún no tienes usuarios registrados</p>
          <button type="button" className="panel-cajeros-agregar-btn" onClick={abrirModal}>
            Agregar usuario
          </button>
        </div>
      ) : esMobile ? (
        <div className="panel-cajeros-lista-cards">
          {usuarios.map((usuario) => (
            <article key={usuario.id} className="panel-cajeros-card">
              <div className="panel-cajeros-card-fila">
                <span className="panel-cajeros-card-etiqueta">Nombre</span>
                <span className="panel-cajeros-card-valor">{usuario.nombre}</span>
              </div>
              <div className="panel-cajeros-card-fila">
                <span className="panel-cajeros-card-etiqueta">Rol</span>
                <span className="panel-cajeros-card-valor">{etiquetaRol(usuario.rol)}</span>
              </div>
              <div className="panel-cajeros-card-fila">
                <span className="panel-cajeros-card-etiqueta">Email</span>
                <span className="panel-cajeros-card-valor">{usuario.email || '—'}</span>
              </div>
              <div className="panel-cajeros-card-fila">
                <span className="panel-cajeros-card-etiqueta">Estado</span>
                <span className="panel-cajeros-card-valor">{renderEstado(usuario)}</span>
              </div>
              <div className="panel-cajeros-card-fila">
                <span className="panel-cajeros-card-etiqueta">Activar</span>
                <span className="panel-cajeros-card-valor">{renderToggle(usuario)}</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel-cajeros-tabla-wrap">
          <table className="panel-cajeros-tabla">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Rol</th>
                <th>Email</th>
                <th>Estado</th>
                <th>Activar</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((usuario) => (
                <tr key={usuario.id}>
                  <td>{usuario.nombre}</td>
                  <td>{etiquetaRol(usuario.rol)}</td>
                  <td>{usuario.email || '—'}</td>
                  <td>{renderEstado(usuario)}</td>
                  <td>{renderToggle(usuario)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalAbierto ? (
        <div className="panel-cajeros-modal-overlay" onClick={cerrarModal}>
          <div
            className="panel-cajeros-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="panel-cajeros-modal-titulo"
          >
            <h3 id="panel-cajeros-modal-titulo" className="panel-cajeros-modal-titulo">
              Agregar usuario
            </h3>
            <p className="panel-cajeros-modal-aviso">
              DEV: la creación en auth.users usa la service role key en el frontend. Mover a
              Edge Function antes de PROD.
            </p>

            <form onSubmit={guardarUsuario}>
              <label className="panel-cajeros-modal-campo" htmlFor="panel-cajeros-nombre">
                <span>Nombre</span>
                <input
                  id="panel-cajeros-nombre"
                  type="text"
                  value={formulario.nombre}
                  onChange={(event) =>
                    setFormulario((prev) => ({ ...prev, nombre: event.target.value }))
                  }
                  required
                />
              </label>

              <label className="panel-cajeros-modal-campo" htmlFor="panel-cajeros-email">
                <span>Email</span>
                <input
                  id="panel-cajeros-email"
                  type="email"
                  autoComplete="off"
                  value={formulario.email}
                  onChange={(event) =>
                    setFormulario((prev) => ({ ...prev, email: event.target.value }))
                  }
                  required
                />
              </label>

              <label className="panel-cajeros-modal-campo" htmlFor="panel-cajeros-rol">
                <span>Rol</span>
                <select
                  id="panel-cajeros-rol"
                  value={formulario.rol}
                  onChange={(event) =>
                    setFormulario((prev) => ({ ...prev, rol: event.target.value }))
                  }
                >
                  {ROLES_AGREGAR.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="panel-cajeros-modal-campo" htmlFor="panel-cajeros-pin">
                <span>PIN (4-6 dígitos)</span>
                <input
                  id="panel-cajeros-pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  pattern="\d{4,6}"
                  maxLength={6}
                  value={formulario.pin}
                  onChange={(event) =>
                    setFormulario((prev) => ({
                      ...prev,
                      pin: event.target.value.replace(/\D/g, '').slice(0, 6),
                    }))
                  }
                  required
                />
              </label>

              {errorFormulario ? (
                <p className="panel-cajeros-error">{errorFormulario}</p>
              ) : null}

              <div className="panel-cajeros-modal-acciones">
                <button
                  type="button"
                  className="panel-cajeros-modal-cancelar"
                  onClick={cerrarModal}
                  disabled={guardando}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="panel-cajeros-modal-guardar"
                  disabled={guardando}
                >
                  {guardando ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
