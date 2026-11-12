import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Mail, 
  User, 
  FileText, 
  Phone, 
  Globe, 
  MapPin, 
  ArrowRight, 
  Loader2, 
  CheckCircle2, 
  MailCheck, 
  LogOut,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { PasswordResetModal } from './PasswordResetModal';
import type { RegisterFormData } from '../types/auth';

interface AuthViewProps {
  initialMode?: 'login' | 'register';
  emailUnconfirmed?: boolean;
}

export const AuthView: React.FC<AuthViewProps> = ({ 
  initialMode = 'login',
  emailUnconfirmed = false 
}) => {
  const { 
    signIn, 
    signUp, 
    signOut, 
    user, 
    resendConfirmationEmail, 
    refreshProfile, 
    isPasswordRecoveryMode 
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [loading, setLoading] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [justRegisteredEmail, setJustRegisteredEmail] = useState<string | null>(null);

  // Formulario Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Formulario Registro Autónomo
  const [regData, setRegData] = useState<RegisterFormData>({
    fullName: '',
    email: '',
    documentType: 'CC',
    documentNumber: '',
    phone: '',
    country: 'Colombia',
    city: '',
    password: '',
    confirmPassword: ''
  });

  // 1. Manejar Inicio de Sesión
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    setLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setLoading(false);

    if (error) {
      if (error.message.includes('Email not confirmed')) {
        toast.error('Tu correo aún no ha sido confirmado. Por favor revisa tu bandeja de entrada.');
      } else if (error.message.includes('Invalid login credentials')) {
        toast.error('Credenciales incorrectas. Verifica tu correo y contraseña.');
      } else {
        toast.error(error.message || 'Error al iniciar sesión');
      }
    } else {
      toast.success('¡Bienvenido a Inversor Colombia!');
    }
  };

  // 2. Manejar Registro Autónomo
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!regData.fullName.trim()) {
      toast.error('Por favor ingresa tu nombre completo');
      return;
    }
    if (!regData.documentNumber.trim()) {
      toast.error('Por favor ingresa tu número de identificación');
      return;
    }
    if (!regData.city.trim()) {
      toast.error('Por favor ingresa tu ciudad de residencia');
      return;
    }
    if (regData.password.length < 6) {
      toast.error('La contraseña debe tener mínimo 6 caracteres');
      return;
    }
    if (regData.password !== regData.confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);
    const { error, needsEmailConfirmation } = await signUp(regData);
    setLoading(false);

    if (error) {
      if (error.message.includes('User already registered')) {
        toast.error('Este correo ya se encuentra registrado. Intenta iniciar sesión.');
      } else {
        toast.error(error.message || 'Error al crear la cuenta');
      }
    } else {
      if (needsEmailConfirmation) {
        setJustRegisteredEmail(regData.email);
        toast.success('Cuenta creada exitosamente. Revisa tu correo para validarla.');
      } else {
        toast.success('¡Cuenta creada y validada exitosamente!');
      }
    }
  };

  // 3. Reenviar correo de confirmación
  const handleResendConfirmation = async (targetEmail: string) => {
    setResendingEmail(true);
    const { error } = await resendConfirmationEmail(targetEmail);
    setResendingEmail(false);

    if (error) {
      toast.error(error.message || 'Error al reenviar el correo. Intenta de nuevo en unos minutos.');
    } else {
      toast.success(`Enlace de confirmación reenviado a ${targetEmail}`);
    }
  };

  // VISTA ESPECIAL: Usuario registrado con correo pendiente de confirmación
  const isAwaitingVerification = emailUnconfirmed || Boolean(justRegisteredEmail);
  const targetEmail = user?.email || justRegisteredEmail || '';

  if (isAwaitingVerification) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'radial-gradient(ellipse at top, #0f172a 0%, #030712 100%)'
      }}>
        <div className="glass-panel" style={{
          maxWidth: '520px',
          width: '100%',
          padding: '40px 32px',
          borderRadius: '20px',
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(245, 158, 11, 0.4)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
          textAlign: 'center'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(245, 158, 11, 0.15)',
            border: '2px solid rgba(245, 158, 11, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            color: '#f59e0b'
          }}>
            <MailCheck size={32} />
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff', marginBottom: '10px' }}>
            Verificación de Correo Requerida
          </h2>

          <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>
            Para garantizar la seguridad de la plataforma y proteger tu cuenta, hemos enviado un enlace de confirmación a:
            <br />
            <strong style={{ color: 'var(--accent-cyan)', fontSize: '1rem', display: 'inline-block', marginTop: '6px' }}>
              {targetEmail}
            </strong>
          </p>

          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '12px',
            padding: '16px',
            textAlign: 'left',
            marginBottom: '26px',
            border: '1px solid rgba(255, 255, 255, 0.06)'
          }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <CheckCircle2 size={18} color="var(--accent-green)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                1. Abre tu bandeja de entrada (o carpeta de spam).<br />
                2. Haz clic en el botón <strong>"Confirm your mail"</strong>.<br />
                3. Una vez confirmado, vuelve aquí y presiona <strong>"Ya confirmé mi correo"</strong>.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={async () => {
                await refreshProfile();
                window.location.reload();
              }}
              className="btn btn-primary"
              style={{
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontWeight: 800
              }}
            >
              <RefreshCw size={16} /> Ya Confirmé Mi Correo (Actualizar)
            </button>

            <button
              onClick={() => handleResendConfirmation(targetEmail)}
              disabled={resendingEmail}
              className="btn btn-secondary"
              style={{
                padding: '11px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {resendingEmail ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
              Reenviar Correo de Confirmación
            </button>

            <button
              onClick={async () => {
                await signOut();
                setJustRegisteredEmail(null);
                setMode('login');
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                marginTop: '10px'
              }}
            >
              <LogOut size={14} /> Volver a la pantalla de acceso
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'radial-gradient(ellipse at top, #0b1528 0%, #030712 100%)'
    }}>
      <div style={{ maxWidth: mode === 'register' ? '620px' : '440px', width: '100%', transition: 'max-width 0.3s ease' }}>
        
        {/* Encabezado Institucional de Marca */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #06b6d4 0%, #10b981 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 4px 18px rgba(6, 182, 212, 0.4)'
            }}>
              <ShieldCheck size={24} />
            </div>
            <span style={{ fontSize: '1.45rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>
              INVERSOR COLOMBIA
            </span>
            <span style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#fff',
              fontSize: '0.68rem',
              fontWeight: 800,
              padding: '2px 7px',
              borderRadius: '6px',
              letterSpacing: '0.05em'
            }}>
              PRO QUANT
            </span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
            Inteligencia Cuantitativa de Mercados & Análisis Institucional
          </p>
        </div>

        {/* Panel Contenedor de Formularios */}
        <div className="glass-panel" style={{
          padding: '32px',
          borderRadius: '20px',
          background: 'rgba(11, 17, 32, 0.88)',
          backdropFilter: 'blur(20px)',
          border: '1px solid var(--border-medium)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7)'
        }}>

          {/* Selector de Pestañas: Iniciar Sesión vs Registro */}
          <div style={{
            display: 'flex',
            background: 'rgba(255, 255, 255, 0.04)',
            padding: '4px',
            borderRadius: '10px',
            marginBottom: '26px'
          }}>
            <button
              type="button"
              onClick={() => setMode('login')}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '8px',
                border: 'none',
                background: mode === 'login' ? 'var(--accent-cyan)' : 'transparent',
                color: mode === 'login' ? '#000' : 'var(--text-muted)',
                fontWeight: mode === 'login' ? 800 : 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '8px',
                border: 'none',
                background: mode === 'register' ? 'var(--accent-cyan)' : 'transparent',
                color: mode === 'register' ? '#000' : 'var(--text-muted)',
                fontWeight: mode === 'register' ? 800 : 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Crear Cuenta (Registro)
            </button>
          </div>

          {/* ======================================================== */}
          {/* FORMULARIO DE INICIO DE SESIÓN                           */}
          {/* ======================================================== */}
          {mode === 'login' ? (
            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                  Correo Electrónico
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '14px' }} />
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    placeholder="usuario@correo.com"
                    style={{
                      width: '100%',
                      padding: '12px 14px 12px 36px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid var(--border-subtle)',
                      color: '#fff',
                      fontSize: '0.9rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    Contraseña
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowResetModal(true)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--accent-cyan)',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '14px' }} />
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{
                      width: '100%',
                      padding: '12px 14px 12px 36px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid var(--border-subtle)',
                      color: '#fff',
                      fontSize: '0.9rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '13px',
                  marginTop: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontWeight: 800,
                  fontSize: '0.95rem'
                }}
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : (
                  <>
                    Ingresar a la Plataforma <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* ======================================================== */
            /* FORMULARIO DE REGISTRO AUTÓNOMO                           */
            /* ======================================================== */
            <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* Nombre Completo */}
              <div>
                <label style={{ display: 'block', fontSize: '0.80rem', color: 'var(--text-secondary)', marginBottom: '5px', fontWeight: 600 }}>
                  Nombre Completo
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '13px' }} />
                  <input
                    type="text"
                    required
                    value={regData.fullName}
                    onChange={e => setRegData(prev => ({ ...prev, fullName: e.target.value }))}
                    placeholder="Ej: Andrés Felipe Pérez"
                    style={{
                      width: '100%',
                      padding: '10px 14px 10px 36px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid var(--border-subtle)',
                      color: '#fff',
                      fontSize: '0.88rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Fila Dual: Tipo y Número de Documento */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.80rem', color: 'var(--text-secondary)', marginBottom: '5px', fontWeight: 600 }}>
                    Tipo Doc.
                  </label>
                  <select
                    value={regData.documentType}
                    onChange={e => setRegData(prev => ({ ...prev, documentType: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '8px',
                      background: '#0f172a',
                      border: '1px solid var(--border-subtle)',
                      color: '#fff',
                      fontSize: '0.85rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="CC">C.C. (Cédula)</option>
                    <option value="CE">C.E. (Extranjería)</option>
                    <option value="PASAPORTE">Pasaporte</option>
                    <option value="OTRO">Otro</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.80rem', color: 'var(--text-secondary)', marginBottom: '5px', fontWeight: 600 }}>
                    Número de Documento
                  </label>
                  <div style={{ position: 'relative' }}>
                    <FileText size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '13px' }} />
                    <input
                      type="text"
                      required
                      value={regData.documentNumber}
                      onChange={e => setRegData(prev => ({ ...prev, documentNumber: e.target.value }))}
                      placeholder="Ej: 1020304050"
                      style={{
                        width: '100%',
                        padding: '10px 14px 10px 36px',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid var(--border-subtle)',
                        color: '#fff',
                        fontSize: '0.88rem',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Fila Dual: Correo y Teléfono */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.80rem', color: 'var(--text-secondary)', marginBottom: '5px', fontWeight: 600 }}>
                    Correo Electrónico (Usuario)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '13px' }} />
                    <input
                      type="email"
                      required
                      value={regData.email}
                      onChange={e => setRegData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="usuario@correo.com"
                      style={{
                        width: '100%',
                        padding: '10px 14px 10px 36px',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid var(--border-subtle)',
                        color: '#fff',
                        fontSize: '0.88rem',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.80rem', color: 'var(--text-secondary)', marginBottom: '5px', fontWeight: 600 }}>
                    Teléfono / WhatsApp
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Phone size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '13px' }} />
                    <input
                      type="tel"
                      value={regData.phone}
                      onChange={e => setRegData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+57 300 123 4567"
                      style={{
                        width: '100%',
                        padding: '10px 14px 10px 36px',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid var(--border-subtle)',
                        color: '#fff',
                        fontSize: '0.88rem',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Fila Dual: País y Ciudad */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.80rem', color: 'var(--text-secondary)', marginBottom: '5px', fontWeight: 600 }}>
                    País
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Globe size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '13px' }} />
                    <input
                      type="text"
                      required
                      value={regData.country}
                      onChange={e => setRegData(prev => ({ ...prev, country: e.target.value }))}
                      placeholder="Colombia"
                      style={{
                        width: '100%',
                        padding: '10px 14px 10px 36px',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid var(--border-subtle)',
                        color: '#fff',
                        fontSize: '0.88rem',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.80rem', color: 'var(--text-secondary)', marginBottom: '5px', fontWeight: 600 }}>
                    Ciudad
                  </label>
                  <div style={{ position: 'relative' }}>
                    <MapPin size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '13px' }} />
                    <input
                      type="text"
                      required
                      value={regData.city}
                      onChange={e => setRegData(prev => ({ ...prev, city: e.target.value }))}
                      placeholder="Ej: Bogotá, Medellín, Cali"
                      style={{
                        width: '100%',
                        padding: '10px 14px 10px 36px',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid var(--border-subtle)',
                        color: '#fff',
                        fontSize: '0.88rem',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Fila Dual: Contraseñas */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.80rem', color: 'var(--text-secondary)', marginBottom: '5px', fontWeight: 600 }}>
                    Contraseña (mínimo 6)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '13px' }} />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={regData.password}
                      onChange={e => setRegData(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="••••••••"
                      style={{
                        width: '100%',
                        padding: '10px 14px 10px 36px',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid var(--border-subtle)',
                        color: '#fff',
                        fontSize: '0.88rem',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.80rem', color: 'var(--text-secondary)', marginBottom: '5px', fontWeight: 600 }}>
                    Confirmar Contraseña
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '13px' }} />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={regData.confirmPassword}
                      onChange={e => setRegData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="••••••••"
                      style={{
                        width: '100%',
                        padding: '10px 14px 10px 36px',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid var(--border-subtle)',
                        color: '#fff',
                        fontSize: '0.88rem',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Nota sobre confirmación por correo */}
              <div style={{
                background: 'rgba(6, 182, 212, 0.08)',
                border: '1px solid rgba(6, 182, 212, 0.25)',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '0.78rem',
                color: 'var(--accent-cyan)',
                lineHeight: 1.4
              }}>
                ℹ️ Al registrarte, recibirás un correo de verificación. Deberás confirmar tu enlace para ingresar de ahí en adelante.
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '12px',
                  marginTop: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontWeight: 800,
                  fontSize: '0.92rem'
                }}
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : (
                  <>
                    <Sparkles size={16} /> Completar Registro Autónomo
                  </>
                )}
              </button>
            </form>
          )}

        </div>

      </div>

      {/* Modal de Restablecimiento de Contraseña */}
      <PasswordResetModal
        isOpen={showResetModal || isPasswordRecoveryMode}
        onClose={() => setShowResetModal(false)}
        isRecoveryMode={isPasswordRecoveryMode}
      />
    </div>
  );
};

