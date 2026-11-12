import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  ShieldCheck, 
  Search, 
  Filter, 
  RefreshCw, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  UserX, 
  UserCheck, 
  Shield, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  ArrowUpDown,
  Download
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { UserProfile } from '../types/auth';

export const UserAdminModule: React.FC = () => {
  const { user: currentAuthUser, profile: currentAuthProfile } = useAuth();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended' | 'verified' | 'unverified'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Cargar lista de usuarios desde public.profiles
  const loadProfiles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        toast.error('Error consultando usuarios: ' + error.message);
      } else if (data) {
        setProfiles(data as UserProfile[]);
      }
    } catch (err) {
      console.error('Error loading profiles:', err);
      toast.error('Error de conexión al cargar la lista de usuarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  // Métricas KPI
  const stats = useMemo(() => {
    const total = profiles.length;
    const verified = profiles.filter(p => p.email_confirmed_at).length;
    const pending = profiles.filter(p => !p.email_confirmed_at).length;
    const admins = profiles.filter(p => p.role === 'admin').length;
    const active = profiles.filter(p => p.status === 'active').length;
    const suspended = profiles.filter(p => p.status === 'suspended').length;
    const verifiedPct = total > 0 ? Math.round((verified / total) * 100) : 0;

    return { total, verified, pending, admins, active, suspended, verifiedPct };
  }, [profiles]);

  // Filtrado reactivo en vivo
  const filteredProfiles = useMemo(() => {
    return profiles.filter(p => {
      // 1. Filtro texto libre
      const term = searchTerm.toLowerCase().trim();
      if (term) {
        const matchesName = (p.full_name || '').toLowerCase().includes(term);
        const matchesEmail = (p.email || '').toLowerCase().includes(term);
        const matchesDoc = (p.document_number || '').toLowerCase().includes(term);
        const matchesCity = (p.city || '').toLowerCase().includes(term);
        const matchesCountry = (p.country || '').toLowerCase().includes(term);
        if (!matchesName && !matchesEmail && !matchesDoc && !matchesCity && !matchesCountry) {
          return false;
        }
      }

      // 2. Filtro estatus
      if (statusFilter === 'active' && p.status !== 'active') return false;
      if (statusFilter === 'suspended' && p.status !== 'suspended') return false;
      if (statusFilter === 'verified' && !p.email_confirmed_at) return false;
      if (statusFilter === 'unverified' && p.email_confirmed_at) return false;

      // 3. Filtro rol
      if (roleFilter !== 'all' && p.role !== roleFilter) return false;

      return true;
    });
  }, [profiles, searchTerm, statusFilter, roleFilter]);

  // Cambiar estatus de cuenta: active <-> suspended
  const handleToggleStatus = async (target: UserProfile) => {
    if (target.id === currentAuthUser?.id) {
      toast.error('No puedes suspender tu propia cuenta de administrador.');
      return;
    }

    const nextStatus = target.status === 'active' ? 'suspended' : 'active';
    setUpdatingId(target.id);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', target.id);

      if (error) {
        toast.error('Error al actualizar estatus: ' + error.message);
      } else {
        toast.success(`Usuario ${target.email} marcado como ${nextStatus === 'active' ? 'ACTIVO' : 'SUSPENDIDO'}`);
        setProfiles(prev => prev.map(p => p.id === target.id ? { ...p, status: nextStatus } : p));
      }
    } catch (err) {
      toast.error('Error al contactar con la base de datos');
    } finally {
      setUpdatingId(null);
    }
  };

  // Cambiar rol: user <-> admin
  const handleToggleRole = async (target: UserProfile) => {
    if (target.id === currentAuthUser?.id) {
      toast.error('No puedes cambiar tu propio rol.');
      return;
    }

    const nextRole = target.role === 'admin' ? 'user' : 'admin';
    const confirmMsg = nextRole === 'admin'
      ? `¿Deseas otorgar permisos de ADMINISTRADOR a ${target.email}?`
      : `¿Deseas revocar los permisos de administrador a ${target.email}?`;

    if (!window.confirm(confirmMsg)) return;

    setUpdatingId(target.id);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: nextRole, updated_at: new Date().toISOString() })
        .eq('id', target.id);

      if (error) {
        toast.error('Error al actualizar rol: ' + error.message);
      } else {
        toast.success(`Rol de ${target.email} actualizado a ${nextRole.toUpperCase()}`);
        setProfiles(prev => prev.map(p => p.id === target.id ? { ...p, role: nextRole } : p));
      }
    } catch (err) {
      toast.error('Error al contactar con la base de datos');
    } finally {
      setUpdatingId(null);
    }
  };

  // Exportar lista plana a CSV
  const handleExportCSV = () => {
    if (profiles.length === 0) return;
    const headers = ['ID', 'Email', 'Nombre', 'Tipo Doc', 'Numero Doc', 'Telefono', 'Pais', 'Ciudad', 'Rol', 'Estatus', 'Email Confirmado', 'Fecha Registro'];
    const rows = profiles.map(p => [
      p.id,
      p.email,
      p.full_name || '',
      p.document_type || '',
      p.document_number || '',
      p.phone || '',
      p.country || '',
      p.city || '',
      p.role,
      p.status,
      p.email_confirmed_at ? 'Si' : 'No',
      p.created_at
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `usuarios_inversor_colombia_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Archivo CSV exportado exitosamente');
  };

  const formatDateTime = (isoStr: string) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('es-CO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px' }} className="animate-fade-in">
      
      {/* 1. Encabezado del Módulo de Administración */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '26px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #06b6d4 0%, #10b981 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 18px rgba(6, 182, 212, 0.35)'
          }}>
            <Users size={26} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>
                Administración de Usuarios
              </h1>
              <span style={{
                background: 'rgba(6, 182, 212, 0.15)',
                color: 'var(--accent-cyan)',
                border: '1px solid rgba(6, 182, 212, 0.35)',
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <ShieldCheck size={13} /> ACCESO ADMIN
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
              Identificación, verificación de correo electrónico y control de acceso institucional en Supabase
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={handleExportCSV}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
            title="Exportar a CSV"
          >
            <Download size={15} /> Exportar CSV
          </button>

          <button
            onClick={loadProfiles}
            disabled={loading}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Actualizar Datos
          </button>
        </div>
      </div>

      {/* 2. Tarjetas KPI de Métricas */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '26px'
      }}>
        {/* Total Usuarios */}
        <div className="glass-panel" style={{ padding: '20px', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Registrados</span>
            <Users size={18} color="var(--accent-cyan)" />
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#fff' }}>
            {stats.total}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {stats.active} activos · {stats.suspended} suspendidos
          </div>
        </div>

        {/* Correos Verificados */}
        <div className="glass-panel" style={{ padding: '20px', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Correos Verificados</span>
            <CheckCircle2 size={18} color="var(--accent-green)" />
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: 900, color: 'var(--accent-green)' }}>
            {stats.verified}
            <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 600, marginLeft: '6px' }}>
              ({stats.verifiedPct}%)
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Con acceso pleno habilitado
          </div>
        </div>

        {/* Pendientes de Validación */}
        <div className="glass-panel" style={{ padding: '20px', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Pendientes Verificación</span>
            <Clock size={18} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#f59e0b' }}>
            {stats.pending}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Aún no han confirmado su enlace
          </div>
        </div>

        {/* Administradores */}
        <div className="glass-panel" style={{ padding: '20px', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Administradores</span>
            <Shield size={18} color="var(--accent-cyan)" />
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: 900, color: 'var(--accent-cyan)' }}>
            {stats.admins}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Privilegios de gestión de usuarios
          </div>
        </div>
      </div>

      {/* 3. Barra de Búsqueda y Filtros */}
      <div className="glass-panel" style={{
        padding: '16px 20px',
        borderRadius: '14px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px',
        border: '1px solid var(--border-subtle)'
      }}>
        {/* Buscador */}
        <div style={{ position: 'relative', flex: '1', minWidth: '260px' }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, correo, cédula, ciudad..."
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-subtle)',
              color: '#fff',
              fontSize: '0.85rem',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Selectores de Filtro */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Filtro Estatus */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={14} color="var(--text-muted)" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                background: '#0f172a',
                border: '1px solid var(--border-subtle)',
                color: '#fff',
                fontSize: '0.82rem',
                outline: 'none'
              }}
            >
              <option value="all">Todos los estatus</option>
              <option value="active">Activos</option>
              <option value="suspended">Suspendidos</option>
              <option value="verified">Correo Verificado</option>
              <option value="unverified">Correo Pendiente</option>
            </select>
          </div>

          {/* Filtro Rol */}
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value as any)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              background: '#0f172a',
              border: '1px solid var(--border-subtle)',
              color: '#fff',
              fontSize: '0.82rem',
              outline: 'none'
            }}
          >
            <option value="all">Todos los roles</option>
            <option value="admin">Administradores</option>
            <option value="user">Usuarios Estándar</option>
          </select>
        </div>
      </div>

      {/* 4. Tabla de Usuarios */}
      <div className="glass-panel" style={{
        borderRadius: '16px',
        overflow: 'hidden',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-md)'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--border-medium)' }}>
                <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 700 }}>Usuario</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 700 }}>Identificación</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 700 }}>Ubicación</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 700 }}>Teléfono</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 700 }}>Fecha Registro</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 700 }}>Estatus Correo</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 700 }}>Cuenta</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 700 }}>Rol</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px', display: 'block', color: 'var(--accent-cyan)' }} />
                    Cargando usuarios desde Supabase...
                  </td>
                </tr>
              ) : filteredProfiles.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Users size={32} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.4 }} />
                    No se encontraron usuarios que coincidan con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredProfiles.map((p, idx) => {
                  const isSelf = p.id === currentAuthUser?.id;
                  const isVerified = Boolean(p.email_confirmed_at);
                  const isUpdating = updatingId === p.id;

                  // Iniciales para avatar
                  const initials = (p.full_name || p.email)
                    .split(' ')
                    .map(n => n.charAt(0))
                    .join('')
                    .toUpperCase()
                    .slice(0, 2);

                  return (
                    <tr 
                      key={p.id}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.01)',
                        transition: 'background 0.2s ease'
                      }}
                    >
                      {/* Usuario */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '8px',
                            background: p.role === 'admin' 
                              ? 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)' 
                              : 'rgba(255, 255, 255, 0.08)',
                            color: '#fff',
                            fontWeight: 800,
                            fontSize: '0.8rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            {initials}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {p.full_name || 'Sin nombre registrado'}
                              {isSelf && (
                                <span style={{ fontSize: '0.68rem', color: 'var(--accent-cyan)', background: 'rgba(6, 182, 212, 0.15)', padding: '1px 5px', borderRadius: '4px' }}>
                                  Tú
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                              {p.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Identificación */}
                      <td style={{ padding: '14px 18px' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {p.document_type || 'CC'}:
                        </span>{' '}
                        <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>
                          {p.document_number || '—'}
                        </span>
                      </td>

                      {/* Ubicación */}
                      <td style={{ padding: '14px 18px', color: 'var(--text-secondary)' }}>
                        {p.city ? `${p.city}, ${p.country || 'Colombia'}` : (p.country || '—')}
                      </td>

                      {/* Teléfono */}
                      <td style={{ padding: '14px 18px', color: 'var(--text-secondary)' }}>
                        {p.phone ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Phone size={12} color="var(--text-muted)" /> {p.phone}
                          </span>
                        ) : '—'}
                      </td>

                      {/* Fecha de Registro */}
                      <td style={{ padding: '14px 18px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        {formatDateTime(p.created_at)}
                      </td>

                      {/* Estatus de Correo */}
                      <td style={{ padding: '14px 18px' }}>
                        {isVerified ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'rgba(16, 185, 129, 0.12)',
                            color: 'var(--accent-green)',
                            border: '1px solid rgba(16, 185, 129, 0.28)',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '6px'
                          }}>
                            <CheckCircle2 size={12} /> Confirmado
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'rgba(245, 158, 11, 0.12)',
                            color: '#f59e0b',
                            border: '1px solid rgba(245, 158, 11, 0.28)',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '6px'
                          }}>
                            <Clock size={12} /> Pendiente
                          </span>
                        )}
                      </td>

                      {/* Estatus de Cuenta */}
                      <td style={{ padding: '14px 18px' }}>
                        {p.status === 'active' ? (
                          <span style={{ color: 'var(--accent-green)', fontWeight: 700, fontSize: '0.8rem' }}>
                            ● Activo
                          </span>
                        ) : (
                          <span style={{ color: '#f87171', fontWeight: 700, fontSize: '0.8rem' }}>
                            ● Suspendido
                          </span>
                        )}
                      </td>

                      {/* Rol */}
                      <td style={{ padding: '14px 18px' }}>
                        {p.role === 'admin' ? (
                          <span style={{
                            background: 'rgba(6, 182, 212, 0.15)',
                            color: 'var(--accent-cyan)',
                            border: '1px solid rgba(6, 182, 212, 0.3)',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '2px 7px',
                            borderRadius: '5px'
                          }}>
                            Admin
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                            Usuario
                          </span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          {/* Botón Suspender / Activar */}
                          <button
                            onClick={() => handleToggleStatus(p)}
                            disabled={isSelf || isUpdating}
                            style={{
                              background: p.status === 'active' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                              border: p.status === 'active' ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(16, 185, 129, 0.25)',
                              color: p.status === 'active' ? '#f87171' : 'var(--accent-green)',
                              borderRadius: '6px',
                              padding: '5px 8px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: isSelf ? 'not-allowed' : 'pointer',
                              opacity: isSelf ? 0.3 : 1
                            }}
                            title={isSelf ? 'No puedes suspender tu propia cuenta' : (p.status === 'active' ? 'Suspender cuenta' : 'Reactivar cuenta')}
                          >
                            {p.status === 'active' ? 'Suspender' : 'Activar'}
                          </button>

                          {/* Botón Cambiar Rol */}
                          <button
                            onClick={() => handleToggleRole(p)}
                            disabled={isSelf || isUpdating}
                            style={{
                              background: 'rgba(255, 255, 255, 0.04)',
                              border: '1px solid var(--border-subtle)',
                              color: p.role === 'admin' ? 'var(--text-muted)' : 'var(--accent-cyan)',
                              borderRadius: '6px',
                              padding: '5px 8px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: isSelf ? 'not-allowed' : 'pointer',
                              opacity: isSelf ? 0.3 : 1
                            }}
                            title={isSelf ? 'No puedes cambiar tu propio rol' : (p.role === 'admin' ? 'Quitar rol admin' : 'Hacer admin')}
                          >
                            {p.role === 'admin' ? 'Hacer Usuario' : 'Hacer Admin'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pie de tabla con conteo */}
        <div style={{
          padding: '12px 18px',
          background: 'rgba(255, 255, 255, 0.02)',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: '0.78rem',
          color: 'var(--text-muted)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>Mostrando {filteredProfiles.length} de {profiles.length} usuarios registrados</span>
          <span>Base de datos: Supabase <code>public.profiles</code></span>
        </div>
      </div>

    </div>
  );
};
