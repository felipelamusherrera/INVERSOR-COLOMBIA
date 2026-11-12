import React, { useState } from 'react';
import { KeyRound, Mail, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth, cleanAuthUrl } from '../context/AuthContext';

interface PasswordResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  isRecoveryMode?: boolean; // true si viene de un enlace de correo
}

export const PasswordResetModal: React.FC<PasswordResetModalProps> = ({
  isOpen,
  onClose,
  isRecoveryMode = false
}) => {
  const { sendPasswordReset, updateUserPassword, setIsPasswordRecoveryMode } = useAuth();
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Si no está abierto, no renderizar bajo ninguna circunstancia
  if (!isOpen) return null;

  // 1. Enviar correo de restablecimiento
  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      toast.error('Por favor ingresa un correo electrónico válido');
      return;
    }

    setLoading(true);
    const { error } = await sendPasswordReset(email);
    setLoading(false);

    if (error) {
      toast.error(error.message || 'Error al enviar el correo de recuperación.');
    } else {
      setEmailSent(true);
      toast.success('Enlace de recuperación enviado. Revisa tu bandeja de entrada.');
    }
  };

  // 2. Actualizar contraseña (modo recuperación)
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    const { error } = await updateUserPassword(newPassword);
    setLoading(false);

    if (error) {
      // Manejar el caso donde el usuario ya la actualizó previamente en la sesión
      if (error.message?.includes('different from the old password') || error.message?.includes('should be different')) {
        toast.info('Tu contraseña ya ha sido registrada exitosamente con este valor. Puedes cerrar esta ventana e ingresar.');
        handleClose();
      } else {
        toast.error(error.message || 'Error al actualizar la contraseña.');
      }
    } else {
      toast.success('¡Contraseña actualizada exitosamente! Ahora tienes acceso.');
      handleClose();
    }
  };

  const handleClose = () => {
    setIsPasswordRecoveryMode(false);
    cleanAuthUrl();
    setEmailSent(false);
    setEmail('');
    setNewPassword('');
    setConfirmPassword('');
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.78)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 3000,
      padding: '20px'
    }}>
      <div className="glass-panel" style={{
        maxWidth: '460px',
        width: '100%',
        padding: '30px',
        borderRadius: '16px',
        background: '#0b1120',
        border: '1px solid var(--border-medium)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        position: 'relative'
      }}>
        {/* Botón cerrar siempre disponible */}
        <button
          type="button"
          onClick={handleClose}
          aria-label="Cerrar modal"
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.2s ease'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <X size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            background: 'rgba(6, 182, 212, 0.12)',
            border: '1px solid rgba(6, 182, 212, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-cyan)'
          }}>
            <KeyRound size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#fff' }}>
              {isRecoveryMode ? 'Establecer Nueva Contraseña' : 'Recuperar Contraseña'}
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {isRecoveryMode 
                ? 'Ingresa tu nueva clave de acceso para continuar' 
                : 'Te enviaremos un enlace seguro a tu correo'}
            </p>
          </div>
        </div>

        {/* CASO A: Viene del enlace del correo (Establecer nueva clave) */}
        {isRecoveryMode ? (
          <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                Nueva Contraseña
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                style={{
                  width: '100%',
                  padding: '11px 14px',
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

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                Confirmar Nueva Contraseña
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repite tu contraseña"
                style={{
                  width: '100%',
                  padding: '11px 14px',
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

            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={handleClose}
                className="btn btn-secondary"
                style={{ flex: 1, padding: '12px' }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{
                  flex: 2,
                  padding: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontWeight: 700
                }}
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : 'Guardar Nueva Contraseña'}
              </button>
            </div>
          </form>
        ) : emailSent ? (
          /* CASO B: Correo ya enviado */
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-green)',
              margin: '0 auto 16px'
            }}>
              <CheckCircle2 size={28} />
            </div>
            <h4 style={{ color: '#fff', fontSize: '1.05rem', margin: '0 0 8px 0', fontWeight: 700 }}>
              ¡Enlace Enviado con Éxito!
            </h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5, margin: '0 0 20px 0' }}>
              Hemos enviado las instrucciones para restablecer tu contraseña a <strong>{email}</strong>. Revisa tu bandeja de entrada o carpeta de spam.
            </p>
            <button
              onClick={handleClose}
              className="btn btn-secondary"
              style={{ width: '100%', padding: '10px' }}
            >
              Cerrar y Volver
            </button>
          </div>
        ) : (
          /* CASO C: Solicitar enlace */
          <form onSubmit={handleSendEmail} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                Correo Electrónico Registrado
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '14px' }} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  style={{
                    width: '100%',
                    padding: '11px 14px 11px 36px',
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

            <div style={{ display: 'flex', gap: '8px', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '2px', color: '#f59e0b' }} />
              <span>Te llegará un correo con un enlace temporal que expirará en 1 hora.</span>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={handleClose}
                className="btn btn-secondary"
                style={{ flex: 1, padding: '11px' }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{
                  flex: 2,
                  padding: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontWeight: 700
                }}
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : 'Enviar Enlace'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

