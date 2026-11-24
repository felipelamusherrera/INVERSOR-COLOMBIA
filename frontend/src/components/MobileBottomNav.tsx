import React, { useState } from 'react';
import {
  Activity,
  Layers,
  Bot,
  Bookmark,
  Sparkles,
  MoreHorizontal,
  Grid,
  ArrowRight,
  Users,
  TrendingUp,
  X,
} from 'lucide-react';
import { useViewport } from '../context/ViewportContext';

interface MobileBottomNavProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  isAdmin?: boolean;
  onToggleAgentDrawer?: () => void;
  isAgentDrawerOpen?: boolean;
  activeStockTicker?: string | null;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentTab,
  setCurrentTab,
  isAdmin = false,
  onToggleAgentDrawer,
  isAgentDrawerOpen = false,
  activeStockTicker = null,
}) => {
  const { isMobile } = useViewport();
  const [showMoreSheet, setShowMoreSheet] = useState(false);

  if (!isMobile) return null;

  const isMoreActive =
    currentTab === 'maps' ||
    currentTab === 'peers' ||
    currentTab === 'user-admin';

  const handleNavigate = (tab: string) => {
    setShowMoreSheet(false);
    setCurrentTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      {/* Hoja Inferior "Más Módulos" */}
      {showMoreSheet && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 95,
            background: 'rgba(3, 7, 18, 0.72)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
          }}
          onClick={() => setShowMoreSheet(false)}
        >
          <div
            style={{
              background: 'linear-gradient(180deg, #0f172a 0%, #090d16 100%)',
              borderTop: '1px solid rgba(255, 255, 255, 0.12)',
              borderTopLeftRadius: '18px',
              borderTopRightRadius: '18px',
              padding: '14px 16px',
              paddingBottom: 'calc(var(--mobile-bottom-nav-h, 64px) + env(safe-area-inset-bottom, 0px) + 14px)',
              boxShadow: '0 -12px 36px rgba(0, 0, 0, 0.65)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: '36px',
                height: '4px',
                borderRadius: '999px',
                background: 'rgba(148, 163, 184, 0.35)',
                margin: '0 auto 12px auto',
              }}
            />

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
              }}
            >
              <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#f8fafc' }}>
                Módulos Adicionales
              </span>
              <button
                type="button"
                onClick={() => setShowMoreSheet(false)}
                aria-label="Cerrar menú"
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  color: 'var(--text-secondary)',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {activeStockTicker && (
                <button
                  type="button"
                  onClick={() => handleNavigate('detail')}
                  style={{
                    gridColumn: '1 / -1',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    background:
                      currentTab === 'detail'
                        ? 'rgba(16, 185, 129, 0.18)'
                        : 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    color: '#fff',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <TrendingUp size={18} color="#34d399" />
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800 }}>
                      Ficha Activa: <span className="font-mono">{activeStockTicker}</span>
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                      Volver al análisis detallado de la acción
                    </div>
                  </div>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleNavigate('maps')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px',
                  borderRadius: '12px',
                  background:
                    currentTab === 'maps'
                      ? 'rgba(6, 182, 212, 0.18)'
                      : 'rgba(255, 255, 255, 0.04)',
                  border:
                    currentTab === 'maps'
                      ? '1px solid rgba(6, 182, 212, 0.45)'
                      : '1px solid var(--border-subtle)',
                  color: '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <Grid size={18} color="var(--accent-cyan)" />
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>Maps</div>
                  <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                    Mapa sectorial
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleNavigate('peers')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px',
                  borderRadius: '12px',
                  background:
                    currentTab === 'peers'
                      ? 'rgba(16, 185, 129, 0.18)'
                      : 'rgba(255, 255, 255, 0.04)',
                  border:
                    currentTab === 'peers'
                      ? '1px solid rgba(16, 185, 129, 0.45)'
                      : '1px solid var(--border-subtle)',
                  color: '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <ArrowRight size={18} color="#34d399" />
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>Comparador</div>
                  <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                    Pares frente a frente
                  </div>
                </div>
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleNavigate('user-admin')}
                  style={{
                    gridColumn: '1 / -1',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    background:
                      currentTab === 'user-admin'
                        ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
                        : 'rgba(6, 182, 212, 0.10)',
                    border: '1px solid rgba(6, 182, 212, 0.35)',
                    color: '#fff',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <Users size={18} color="var(--accent-cyan)" />
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>
                      Gestión de Usuarios (Admin)
                    </div>
                    <div style={{ fontSize: '0.66rem', color: 'rgba(255,255,255,0.75)' }}>
                      Control de accesos, roles y estado de cuentas
                    </div>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Barra Inferior Fija de Navegación Móvil */}
      <nav
        aria-label="Navegación móvil principal"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          background: 'rgba(7, 10, 17, 0.96)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.09)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          boxShadow: '0 -6px 24px rgba(0, 0, 0, 0.55)',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            height: 'var(--mobile-bottom-nav-h, 64px)',
            alignItems: 'stretch',
          }}
        >
          {[
            {
              id: 'dashboard',
              label: 'Inicio',
              icon: Activity,
              active: currentTab === 'dashboard' && !isAgentDrawerOpen,
              onClick: () => handleNavigate('dashboard'),
            },
            {
              id: 'screener',
              label: 'Screener',
              icon: Layers,
              active:
                (currentTab === 'screener' || currentTab === 'finviz-screener') &&
                !isAgentDrawerOpen,
              onClick: () => handleNavigate('screener'),
            },
            {
              id: 'ai-strategy',
              label: 'Estrategia',
              icon: Bot,
              active: currentTab === 'ai-strategy' && !isAgentDrawerOpen,
              onClick: () => handleNavigate('ai-strategy'),
            },
            {
              id: 'watchlist',
              label: 'Cartera',
              icon: Bookmark,
              active: currentTab === 'watchlist' && !isAgentDrawerOpen,
              onClick: () => handleNavigate('watchlist'),
            },
            {
              id: 'agent',
              label: 'Agente IA',
              icon: Sparkles,
              active: isAgentDrawerOpen,
              accent: true,
              onClick: () => {
                setShowMoreSheet(false);
                onToggleAgentDrawer?.();
              },
            },
            {
              id: 'more',
              label: 'Más',
              icon: MoreHorizontal,
              active: showMoreSheet || (isMoreActive && !isAgentDrawerOpen),
              onClick: () => setShowMoreSheet((prev) => !prev),
            },
          ].map((item) => {
            const IconComp = item.icon;
            const activeColor = item.accent ? '#38bdf8' : '#10b981';

            return (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                style={{
                  position: 'relative',
                  background: 'transparent',
                  border: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '3px',
                  padding: '4px 2px',
                  cursor: 'pointer',
                  color: item.active
                    ? '#ffffff'
                    : item.accent
                    ? '#34d399'
                    : 'var(--text-muted)',
                  transition: 'color 0.15s ease',
                  minWidth: 0,
                }}
              >
                {item.active && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '26px',
                      height: '2.5px',
                      borderRadius: '0 0 4px 4px',
                      background: activeColor,
                      boxShadow: `0 0 8px ${activeColor}`,
                    }}
                  />
                )}
                <IconComp
                  size={19}
                  color={
                    item.active
                      ? activeColor
                      : item.accent
                      ? '#34d399'
                      : 'currentColor'
                  }
                />
                <span
                  style={{
                    fontSize: '0.62rem',
                    fontWeight: item.active || item.accent ? 800 : 600,
                    letterSpacing: '-0.01em',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '100%',
                  }}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
