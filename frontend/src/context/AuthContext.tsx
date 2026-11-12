import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { UserProfile, RegisterFormData, AuthContextType } from '../types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecoveryMode, setIsPasswordRecoveryMode] = useState(false);

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
        // Asignación de fallback por seguridad si coincide con el correo administrador maestro
        if (userEmail && userEmail.toLowerCase() === 'neuronata25@gmail.com' && prof.role !== 'admin') {
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

  useEffect(() => {
    let isMounted = true;

    // 1. Obtener sesión activa al cargar
    async function initAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && isMounted) {
          setUser(session.user);
          await fetchProfile(session.user.id, session.user.email);
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

      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecoveryMode(true);
      }

      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id, session.user.email);
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
  }, [fetchProfile]);

  // Iniciar Sesión con email y contraseña
  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      });

      if (error) return { error };

      if (data.user) {
        setUser(data.user);
        await fetchProfile(data.user.id, data.user.email);
      }

      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  };

  // Registro Autónomo de Usuario
  const signUp = async (data: RegisterFormData) => {
    try {
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email.trim().toLowerCase(),
        password: data.password,
        options: {
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

  // Cerrar Sesión
  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setIsPasswordRecoveryMode(false);
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  // Enviar correo de restablecimiento de contraseña
  const sendPasswordReset = async (email: string) => {
    try {
      const redirectUrl = window.location.origin;
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
        email: email.trim().toLowerCase()
      });
      return { error };
    } catch (err: any) {
      return { error: err };
    }
  };

  // Validación de estado de confirmación de correo
  // Un usuario está confirmado si user.email_confirmed_at tiene fecha o profile.email_confirmed_at tiene fecha
  const isEmailConfirmed = Boolean(
    user && (user.email_confirmed_at || profile?.email_confirmed_at)
  );

  // Rol Administrador: verificado en profile.role === 'admin' o correo maestro neuronata25@gmail.com
  const isAdmin = Boolean(
    profile?.role === 'admin' || user?.email?.toLowerCase() === 'neuronata25@gmail.com'
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isAdmin,
        isEmailConfirmed,
        isPasswordRecoveryMode,
        signIn,
        signUp,
        signOut,
        sendPasswordReset,
        updateUserPassword,
        resendConfirmationEmail,
        refreshProfile,
        setIsPasswordRecoveryMode
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
