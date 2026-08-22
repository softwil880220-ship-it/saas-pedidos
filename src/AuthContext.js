import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabase';

const AuthContext = createContext(null);

const MODULOS_NEGOCIO_VACIOS = {
  habilitar_caja: false,
  habilitar_mostrador: false,
  habilitar_recoger_domicilio: false,
  habilitar_mesas: false,
  habilitar_clientes: false,
};

function modulosNegocioDesdeFila(negocio) {
  if (!negocio) return { ...MODULOS_NEGOCIO_VACIOS };

  return {
    habilitar_caja: negocio.habilitar_caja === true,
    habilitar_mostrador: negocio.habilitar_mostrador === true,
    habilitar_recoger_domicilio: negocio.habilitar_recoger_domicilio === true,
    habilitar_mesas: negocio.habilitar_mesas === true,
    habilitar_clientes: negocio.habilitar_clientes === true,
  };
}

export function rutaPorRol(rol) {
  switch (rol) {
    case 'dueno':
    case 'administrador':
    case 'cajero':
      return '/';
    case 'cocina':
      return '/cocina';
    case 'cocina2':
      return '/cocina2';
    case 'repartidor':
      return '/repartidor';
    default:
      return '/login';
  }
}

async function cargarUsuario(authUserId) {
  if (!authUserId) return null;

  console.log('[cargarUsuario] authUserId recibido:', authUserId);

  const { data, error } = await supabase
    .from('usuarios_negocio')
    .select(
      `
      id,
      negocio_id,
      rol,
      nombre,
      activo,
      negocios (
        habilitar_caja,
        habilitar_mostrador,
        habilitar_recoger_domicilio,
        habilitar_mesas,
        habilitar_clientes
      )
    `
    )
    .eq('supabase_user_id', authUserId)
    .maybeSingle();

  console.log('[cargarUsuario] resultado del query:', { data, error });

  if (error) {
    console.error('Error al cargar usuario:', error.message);
    return null;
  }

  if (!data || !data.activo) return null;

  const { negocios, ...usuario } = data;

  return {
    ...usuario,
    modulosNegocio: modulosNegocioDesdeFila(negocios),
  };
}

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [errorAuth, setErrorAuth] = useState(null);

  useEffect(() => {
    let activo = true;

    const inicializar = async () => {
      const { data } = await supabase.auth.getSession();
      if (!activo) return;

      const sesionActual = data.session ?? null;
      setSession(sesionActual);
      setUsuario(await cargarUsuario(sesionActual?.user?.id));
      setCargando(false);
    };

    inicializar();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, sesionActual) => {
      setSession(sesionActual);
      setCargando(true);
      setErrorAuth(null);

      cargarUsuario(sesionActual?.user?.id).then((perfil) => {
        if (activo) {
          setUsuario(perfil);
          setCargando(false);
        }
      });
    });

    return () => {
      activo = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (cargando || window.location.pathname !== '/login') return;

    if (!session) return;

    navigate(rutaPorRol(usuario?.rol ?? null), { replace: true });
  }, [cargando, session, usuario, navigate]);

  const iniciarSesion = async (email, password) => {
    setErrorAuth(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setErrorAuth(error.message);
      return { error };
    }

    const authUserId = data.session?.user?.id ?? data.user?.id;
    const perfil = await cargarUsuario(authUserId);
    setUsuario(perfil);
    navigate(rutaPorRol(perfil?.rol ?? null), { replace: true });

    return { error: null };
  };

  const cerrarSesion = async () => {
    setErrorAuth(null);
    await supabase.auth.signOut();
  };

  const value = useMemo(
    () => ({
      session,
      usuario,
      negocioId: usuario?.negocio_id ?? null,
      rol: usuario?.rol ?? null,
      modulosNegocio: usuario?.modulosNegocio ?? MODULOS_NEGOCIO_VACIOS,
      cargando,
      errorAuth,
      iniciarSesion,
      cerrarSesion,
    }),
    [session, usuario, cargando, errorAuth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
}
