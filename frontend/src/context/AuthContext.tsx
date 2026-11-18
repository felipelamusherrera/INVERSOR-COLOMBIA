import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import type { UserProfile, RegisterFormData, AuthContextType } from '../types/auth';

export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos de inactividad
export const LAST_ACTIVITY_STORAGE_KEY = 'inversor_colombia_last_activity_ts';
export const SCREENER_SESSION_STORAGE_KEY = 'inversor_colombia_screener_session_v1';
export const OPEN_TABS_SESSION_STORAGE_KEY = 'inversor_colombia_open_tabs_session_v1';

/**
 * Limpia la marca de tiempo de actividad y los estados efímeros de sesión (filtros y pestañas abiertas)
 */
export const clearEphemeralSessionState = () => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
  } catch (err) {
    console.warn('Error al limpiar marca de actividad:', err);
  }
  try {
    sessionStorage.removeItem(SCREENER_SESSION_STORAGE_KEY);
    sessionStorage.removeItem(OPEN_TABS_SESSION_STORAGE_KEY);
  } catch (err) {
    console.warn('Error al limpiar sessionStorage:', err);
  }
};

/**
 * Limpia los hashes y parámetros de URL generados por el flujo de autenticación de Supabase
 * (ej. #access_token=...&type=recovery o ?code=...)
 */
export const cleanAuthUrl = () => {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    let shouldReplace = false;

    // Si hay hash con parámetros de sesión o recuperación
    if (url.hash && (
      url.hash.includes('access_token') ||
      url.hash.includes('type=recovery') ||
      url.hash.includes('error=') ||
      url.hash.includes('refresh_token')
    )) {
      url.hash = '';
      shouldReplace = true;
    }

    // Si hay query params de tipo auth
    if (url.searchParams.has('type') || url.searchParams.has('code') || url.searchParams.has('error')) {
      url.searchParams.delete('type');
      url.searchParams.delete('code');
      url.searchParams.delete('error');
      url.searchParams.delete('error_description');
      shouldReplace = true;
    }

    if (shouldReplace) {
      window.history.replaceState(null, '', url.pathname + (url.search || '') + (url.hash || ''));
    }
  } catch (err) {
    console.warn('Error al limpiar la URL de autenticación:', err);
  }
};

/**
 * Obtiene la URL base limpia para redirecciones de correo de Supabase Auth
 */
export const getAuthRedirectUrl = () => {
  if (typeof window === 'undefined') return '';
  return window.location.href.split('#')[0].split('?')[0];
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecoveryMode, setIsPasswordRecoveryMode] = useState(false);
  const isExplicitSignInRef = React.useRef(false);
  const inactivitySignOutTriggeredRef = React.useRef(false);

  const isSessionInactive = useCallback((sessionUser: User): boolean => {
    if (typeof window === 'undefined') return false;
    try {
      const rawTs = localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY);
      const savedTs = rawTs ? Number(rawTs) : 0;
      if (savedTs > 0 && !Number.isNaN(savedTs)) {
        return Date.now() - savedTs >= INACTIVITY_TIMEOUT_MS;
      }
      if (sessionUser.last_sign_in_at) {
        const signInTs = new Date(sessionUser.last_sign_in_at).getTime();
        if (!Number.isNaN(signInTs) && Date.now() - signInTs >= INACTIVITY_TIMEOUT_MS) {
          return true;
        }
      }
    } catch (err) {
      console.warn('Error comprobando inactividad de sesión:', err);
    }
    return false;
  }, []);

  // Cargar perfil desde public.profiles
  const fetchProfile = useCallback(async (userId: string, userEmail?: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Error fetching profile from public.profiles:', error.message);
        return null;
      }

      if (data) {
        const prof = data as UserProfile;
        // Asignación de fallback por seguridad si coincide con los correos administradores maestros
        if (userEmail && ['neuronata25@gmail.com', 'felipelamusherrera@gmail.com'].includes(userEmail.toLowerCase()) && prof.role !== 'admin') {
          prof.role = 'admin';
        }
        setProfile(prof);
        return prof;
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
    }
    return null;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfile(user.id, user.email);
    }
  }, [user, fetchProfile]);

  // Cerrar Sesión (manual o automática por inactividad)
  const signOut = useCallback(async () => {
    try {
      clearEphemeralSessionState();
      setUser(null);
      setProfile(null);
      setIsPasswordRecoveryMode(false);
      cleanAuthUrl();
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Error signing out:', err);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const handleInactivityRejection = async (showToastMessage: boolean) => {
      const alreadyTriggered = inactivitySignOutTriggeredRef.current;
      inactivitySignOutTriggeredRef.current = true;
      clearEphemeralSessionState();
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Error cerrando sesión por inactividad:', err);
      }
      if (isMounted) {
        setUser(null);
        setProfile(null);
        setIsPasswordRecoveryMode(false);
      }
      if (showToastMessage && !alreadyTriggered) {
        toast.info('Tu sesión se cerró automáticamente tras 30 minutos de inactividad.');
      }
    };

    // 1. Obtener sesión activa al cargar
    async function initAuth() {
      try {
        const hash = window.location.hash || '';
        const search = window.location.search || '';
        const isRecoverySignal = hash.includes('type=recovery') || search.includes('type=recovery');

        if (isRecoverySignal && isMounted) {
          setIsPasswordRecoveryMode(true);
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && isMounted) {
          if (!isRecoverySignal && isSessionInactive(session.user)) {
            await handleInactivityRejection(true);
            return;
          }

          inactivitySignOutTriggeredRef.current = false;
          try {
            localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(Date.now()));
          } catch {
            // noop
          }

          setUser(session.user);
          const prof = await fetchProfile(session.user.id, session.user.email);
          if (prof?.status === 'suspended') {
            await supabase.auth.signOut();
            clearEphemeralSessionState();
            if (isMounted) {
              setUser(null);
              setProfile(prof);
            }
          }
        }
      } catch (err) {
        console.error('Error initializing auth session:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    initAuth();

    // 2. Escuchar cambios de estado en Supabase Auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      const hash = window.location.hash || '';
      const search = window.location.search || '';
      const isRecoverySignal = hash.includes('type=recovery') || search.includes('type=recovery');

      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecoveryMode(true);
      } else if (event === 'SIGNED_IN') {
        if (!hash.includes('type=recovery')) {
          setIsPasswordRecoveryMode(false);
        }
      } else if (event === 'USER_UPDATED') {
        setIsPasswordRecoveryMode(false);
        cleanAuthUrl();
      } else if (event === 'SIGNED_OUT') {
        setIsPasswordRecoveryMode(false);
        clearEphemeralSessionState();
        cleanAuthUrl();
      }

      if (session?.user) {
        if (
          event !== 'PASSWORD_RECOVERY' &&
          !isRecoverySignal &&
          !isExplicitSignInRef.current &&
          isSessionInactive(session.user)
        ) {
          await handleInactivityRejection(true);
          if (isMounted) setLoading(false);
          return;
        }

        try {
          if (!localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY)) {
            localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(Date.now()));
          }
        } catch {
          // noop
        }

        setUser(session.user);
        const prof = await fetchProfile(session.user.id, session.user.email);
        if (prof?.status === 'suspended') {
          await supabase.auth.signOut();
          clearEphemeralSessionState();
          if (isMounted) {
            setUser(null);
            setProfile(prof);
          }
        }
      } else {
        setUser(null);
        setProfile(null);
      }

      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, isSessionInactive]);

  // 3. Vigilancia activa de inactividad de 30 minutos (incluye suspensión o apagado del equipo)
  useEffect(() => {
    if (!user) return;

    const checkAndRecordActivity = (isUserInteraction: boolean) => {
      if (typeof window === 'undefined') return;
      try {
        const rawTs = localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY);
        const lastTs = rawTs ? Number(rawTs) : 0;

        // Verificar primero si ya expiró antes de actualizar el timestamp
        if (lastTs > 0 && !Number.isNaN(lastTs) && Date.now() - lastTs >= INACTIVITY_TIMEOUT_MS) {
          if (!inactivitySignOutTriggeredRef.current) {
            inactivitySignOutTriggeredRef.current = true;
            toast.info('Tu sesión ha expirado por 30 minutos de inactividad.');
            void signOut();
          }
          return;
        }

        if (isUserInteraction && (!lastTs || Date.now() - lastTs > 5000)) {
          localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(Date.now()));
        }
      } catch (err) {
        console.warn('Error verificando inactividad:', err);
      }
    };

    const onUserInteraction = () => checkAndRecordActivity(true);
    const onWakeOrFocus = () => checkAndRecordActivity(false);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkAndRecordActivity(false);
      }
    };

    const activityEvents: (keyof WindowEventMap)[] = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click'
    ];

    activityEvents.forEach(evt => window.addEventListener(evt, onUserInteraction, { passive: true }));
    window.addEventListener('focus', onWakeOrFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    const intervalId = window.setInterval(() => checkAndRecordActivity(false), 15000);

    return () => {
      activityEvents.forEach(evt => window.removeEventListener(evt, onUserInteraction));
      window.removeEventListener('focus', onWakeOrFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, [user, signOut]);

  // Iniciar Sesión con email y contraseña
  const signIn = async (email: string, password: string) => {
    isExplicitSignInRef.current = true;
    inactivitySignOutTriggeredRef.current = false;
    try {
      // Limpiar preventivamente cualquier estado residual, pestañas o hash de recuperación
      cleanAuthUrl();
      clearEphemeralSessionState();
      setIsPasswordRecoveryMode(false);
      try {
        localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(Date.now()));
      } catch {
        // noop
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      });

      if (error) {
        clearEphemeralSessionState();
        return { error };
      }

      if (data.user) {
        try {
          localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(Date.now()));
        } catch {
          // noop
        }
        setIsPasswordRecoveryMode(false);
        setUser(data.user);
        const prof = await fetchProfile(data.user.id, data.user.email);
        if (prof?.status === 'suspended') {
          await supabase.auth.signOut();
          clearEphemeralSessionState();
          setUser(null);
          setProfile(prof);
          return {
            error: new Error('Tu cuenta se encuentra suspendida por el administrador. Contacta al soporte técnico si crees que es un error.')
          };
        }
      }

      return { error: null };
    } catch (err: any) {
      clearEphemeralSessionState();
      return { error: err };
    } finally {
      isExplicitSignInRef.current = false;
    }
  };

  // Registro Autónomo de Usuario
  const signUp = async (data: RegisterFormData) => {
    try {
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email.trim().toLowerCase(),
        password: data.password,
        options: {
          emailRedirectTo: getAuthRedirectUrl(),
          data: {
            full_name: data.fullName.trim(),
            document_type: data.documentType,
            document_number: data.documentNumber.trim(),
            phone: data.phone.trim(),
            country: data.country.trim(),
            city: data.city.trim()
          }
        }
      });

      if (error) return { error };

      // Si Supabase requiere confirmación de email, el usuario se crea pero email_confirmed_at es null
      const needsEmailConfirmation = !authData.user?.email_confirmed_at;

      return { error: null, needsEmailConfirmation };
    } catch (err: any) {
      return { error: err };
    }
  };

  // Enviar correo de restablecimiento de contraseña
  const sendPasswordReset = async (email: string) => {
    try {
      const redirectUrl = getAuthRedirectUrl();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: redirectUrl
      });
      return { error };
    } catch (err: any) {
      return { error: err };
    }
  };

  // Actualizar contraseña del usuario (después del clic en el correo de recuperación)
  const updateUserPassword = async (password: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (!error) {
        setIsPasswordRecoveryMode(false);
        cleanAuthUrl();
        if (user?.id) {
          await fetchProfile(user.id, user.email);
        }
      }
      return { error };
    } catch (err: any) {
      return { error: err };
    }
  };

  // Reenviar correo de confirmación de registro
  const resendConfirmationEmail = async (email: string) => {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: getAuthRedirectUrl()
        }
      });
      return { error };
    } catch (err: any) {
      return { error: err };
    }
  };

  // Validación de estado de confirmación de correo
  // Prioridad a la firma de Supabase Auth (user.email_confirmed_at), con fallback a profile
  const isEmailConfirmed = Boolean(
    user && (user.email_confirmed_at || profile?.email_confirmed_at)
  );

  // Estatus de cuenta suspendida
  const isSuspended = Boolean(profile?.status === 'suspended');

  // Rol Administrador: verificado en profile.role === 'admin' o correos maestros autorizados
  const isAdmin = Boolean(
    profile?.role === 'admin' || ['neuronata25@gmail.com', 'felipelamusherrera@gmail.com'].includes(user?.email?.toLowerCase() || '')
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isAdmin,
        isEmailConfirmed,
        isSuspended,
        isPasswordRecoveryMode,
        signIn,
        signUp,
        signOut,
        sendPasswordReset,
        updateUserPassword,
        resendConfirmationEmail,
        refreshProfile,
        setIsPasswordRecoveryMode,
        cleanAuthUrl
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

