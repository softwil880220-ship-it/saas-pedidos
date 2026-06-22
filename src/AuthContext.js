import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';

const AuthContext = createContext(null);

async function cargarUsuario(authUserId) {
  if (!authUserId) return null;

  const { data, error } = await supabase
    .from('usuarios')
    .select('id, negocio_id, rol')
    .eq('id', authUserId)
    .maybeSingle();

  if (error) {
    console.error('Error al cargar usuario:', error.message);
    return null;
  }

  return data;
}

export function AuthProvider({ children }) {
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

  const iniciarSesion = async (email, password) => {
    setErrorAuth(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setErrorAuth(error.message);
      return { error };
    }

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
