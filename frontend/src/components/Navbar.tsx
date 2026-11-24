import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  BarChart3,
  Search,
  Clock,
  Layers,
  TrendingUp,
  Bookmark,
  Activity,
  ArrowRight,
  Grid,
  Bot,
  Sparkles,
  Users,
  LogOut,
  X,
} from 'lucide-react';
import type { StockRecord } from '../types/stock';
import { useAuth } from '../context/AuthContext';
import { useViewport } from '../context/ViewportContext';
import { toast } from 'sonner';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  stocks: StockRecord[];
  onSelectStock: (stock: StockRecord) => void;
  selectedStock?: StockRecord | null;
  openStockTabs: string[];
  activeStockTicker: string | null;
  onSwitchStockTab: (ticker: string) => void;
  onCloseStockTab: (ticker: string) => void;
  lastUpdatedDate?: string | null;
  onToggleAgentDrawer?: () => void;
  isAgentDrawerOpen?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  stocks,
  onSelectStock,
  selectedStock: _selectedStock,
  openStockTabs,
  activeStockTicker,
  onSwitchStockTab,
  onCloseStockTab,
  lastUpdatedDate,
  onToggleAgentDrawer,
  isAgentDrawerOpen,
}) => {
  const { user, profile, isAdmin, signOut } = useAuth();
  const { isMobile, isTablet } = useViewport();
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [marketTime, setMarketTime] = useState('');
  const [marketTimeShort, setMarketTimeShort] = useState('');
  const [isMarketOpen, setIsMarketOpen] = useState(false);
  const searchWrapperRef = useRef<HTMLDivElement | null>(null);
  const mobileInputRef = useRef<HTMLInputElement | null>(null);

  // Cerrar resultados de búsqueda al tocar fuera
  useEffect(() => {
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, []);

  useEffect(() => {
    if (mobileSearchOpen && mobileInputRef.current) {
      mobileInputRef.current.focus();
    }
  }, [mobileSearchOpen]);

  // Reloj de Wall Street (Hora Nueva York)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const nyTimeStr = now.toLocaleTimeString('en-US', {
        timeZone: 'America/New_York',
        hour12: true,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const nyShortStr = now.toLocaleTimeString('en-US', {
        timeZone: 'America/New_York',
        hour12: true,
        hour: '2-digit',
        minute: '2-digit',
      });
      setMarketTime(nyTimeStr);
      setMarketTimeShort(nyShortStr);

      const nyDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      const day = nyDate.getDay();
      const hours = nyDate.getHours();
      const minutes = nyDate.getMinutes();
      const totalMinutes = hours * 60 + minutes;

      const isWeekday = day >= 1 && day <= 5;
      const isOpen = isWeekday && totalMinutes >= 570 && totalMinutes < 960; // 9:30 AM to 4:00 PM EST
      setIsMarketOpen(isOpen);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase().trim();

    return stocks
      .filter(
        (s) =>
          s.ticker.toLowerCase().includes(query) ||
          (s.company && s.company.toLowerCase().includes(query))
      )
      .sort((a, b) => {
        const aTick = a.ticker.toLowerCase();
        const bTick = b.ticker.toLowerCase();

        if (aTick === query && bTick !== query) return -1;
        if (bTick === query && aTick !== query) return 1;

        const aStarts = aTick.startsWith(query);
        const bStarts = bTick.startsWith(query);
        if (aStarts && !bStarts) return -1;
        if (bStarts && !aStarts) return 1;

        return (b.market_cap || 0) - (a.market_cap || 0);
      })
      .slice(0, 8);
  }, [stocks, searchQuery]);

  const renderSearchResultsDropdown = () => {
    if (!showResults || filtered.length === 0) return null;
    return (
      <div
        style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          right: 0,
          background: '#0f172a',
          border: '1px solid var(--border-medium)',
          borderRadius: '10px',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          zIndex: 120,
          maxHeight: '340px',
          overflowY: 'auto',
        }}
      >
        {filtered.map((s: StockRecord) => (
          <div
            key={s.ticker}
            style={{
              padding: isMobile ? '10px 12px' : '8px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              cursor: 'pointer',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}
            className="data-row-hover"
            onClick={() => {
              onSelectStock(s);
              setShowResults(false);
              setSearchQuery('');
              setMobileSearchOpen(false);
            }}
          >
            <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <span className="font-mono" style={{ fontWeight: 800, color: '#fff', marginRight: '6px' }}>
                {s.ticker}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {s.company}
              </span>
            </div>
            <div className="font-mono" style={{ fontWeight: 700, color: '#fff', fontSize: '0.8rem', flexShrink: 0 }}>
              ${s.price?.toFixed(2)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(7, 9, 14, 0.94)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      {/* ============================================================
          MODO CELULAR (< 768px): HEADER COMPACTO DE 1 FILA (~54px)
          ============================================================ */}
      {isMobile ? (
        <div ref={searchWrapperRef} style={{ padding: '8px 12px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              minHeight: '38px',
            }}
          >
            {/* Marca Compacta + Punto de Mercado */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                minWidth: 0,
              }}
              onClick={() => setCurrentTab('dashboard')}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 12px rgba(16, 185, 129, 0.35)',
                  flexShrink: 0,
                }}
              >
                <BarChart3 size={17} color="#ffffff" />
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span
                    style={{
                      fontWeight: 800,
                      fontSize: '0.88rem',
                      letterSpacing: '-0.02em',
                      color: '#fff',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    INVERSOR<span style={{ color: 'var(--accent-green)' }}> CO</span>
                  </span>
                  <span
                    style={{
                      fontSize: '0.55rem',
                      fontWeight: 800,
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: 'var(--accent-green)',
                      padding: '1px 4px',
                      borderRadius: '4px',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    PRO
                  </span>
                </div>

                {/* Indicador compacto de Wall Street */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.62rem',
                    color: 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: isMarketOpen ? 'var(--accent-green)' : 'var(--accent-amber)',
                      boxShadow: isMarketOpen ? '0 0 5px #10b981' : '0 0 5px #f59e0b',
                      display: 'inline-block',
                    }}
                  />
                  <span
                    style={{
                      fontWeight: 700,
                      color: isMarketOpen ? 'var(--accent-green)' : 'var(--accent-amber)',
                    }}
                  >
                    {isMarketOpen ? 'Abierto' : 'Cerrado'}
                  </span>
                  <span>• {marketTimeShort} EST</span>
                </div>
              </div>
            </div>

            {/* Acciones Derecha: Botón Lupa + Avatar + Salir */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              <button
                type="button"
                aria-label="Buscar acción"
                onClick={() => setMobileSearchOpen((prev) => !prev)}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  background: mobileSearchOpen
                    ? 'rgba(16, 185, 129, 0.18)'
                    : 'var(--bg-surface)',
                  border: mobileSearchOpen
                    ? '1px solid rgba(16, 185, 129, 0.45)'
                    : '1px solid var(--border-subtle)',
                  color: mobileSearchOpen ? '#34d399' : '#e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                {mobileSearchOpen ? <X size={16} /> : <Search size={16} />}
              </button>

              {user && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    background: 'var(--bg-surface)',
                    padding: '3px 6px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div
                    style={{
                      width: '25px',
                      height: '25px',
                      borderRadius: '6px',
                      background: isAdmin
                        ? 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)'
                        : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: '0.7rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title={`${profile?.full_name || user.email || ''} (${isAdmin ? 'ADMIN' : 'USUARIO'})`}
                  >
                    {(profile?.full_name || user.email || 'U').charAt(0).toUpperCase()}
                  </div>

                  <button
                    type="button"
                    aria-label="Cerrar sesión"
                    onClick={() => {
                      signOut();
                      toast.info('Sesión cerrada correctamente');
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title="Cerrar sesión"
                  >
                    <LogOut size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Barra desplegable de búsqueda rápida en móvil */}
          {mobileSearchOpen && (
            <div style={{ position: 'relative', marginTop: '8px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--accent-green-border)',
                  borderRadius: '8px',
                  padding: '7px 10px',
                  gap: '8px',
                }}
              >
                <Search size={15} color="var(--accent-green)" />
                <input
                  ref={mobileInputRef}
                  type="search"
                  placeholder="Buscar ticker o empresa (ej: NVDA, AAPL)..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowResults(true);
                  }}
                  onFocus={() => setShowResults(true)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#fff',
                    fontSize: '0.88rem',
                    width: '100%',
                    fontFamily: 'inherit',
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      padding: '2px',
                      display: 'flex',
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              {renderSearchResultsDropdown()}
            </div>
          )}
        </div>
      ) : (
        /* ============================================================
           MODO COMPUTADORA & TABLET (>= 768px): BARRA INSTITUCIONAL
           ============================================================ */
        <div
          className="navbar-top-bar"
          style={{
            maxWidth: '1600px',
            margin: '0 auto',
            minHeight: '64px',
            padding: isTablet ? '8px 16px' : '8px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          {/* Logo / Marca */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              flexShrink: 0,
            }}
            onClick={() => setCurrentTab('dashboard')}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '9px',
                background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 16px rgba(16, 185, 129, 0.35)',
              }}
            >
              <BarChart3 size={20} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    fontWeight: 800,
                    fontSize: '1.02rem',
                    letterSpacing: '-0.02em',
                    color: '#fff',
                  }}
                >
                  INVERSOR<span style={{ color: 'var(--accent-green)' }}> COLOMBIA</span>
                </span>
                <span
                  style={{
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: 'var(--accent-green)',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                  }}
                >
                  PRO QUANT
                </span>
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                Inteligencia Cuantitativa de Mercados
              </div>
            </div>
          </div>

          {/* Buscador Rápido de Tickers */}
          <div
            ref={searchWrapperRef}
            className="navbar-search-box"
            style={{
              position: 'relative',
              width: isTablet ? '220px' : '250px',
              flex: isTablet ? '1 1 200px' : '0 1 250px',
              maxWidth: isTablet ? '320px' : '270px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '6px 10px',
                gap: '8px',
              }}
            >
              <Search size={15} color="var(--text-muted)" />
              <input
                id="search-ticker-input"
                type="text"
                placeholder="Buscar ticker (ej: NVDA, MU)..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowResults(true);
                }}
                onFocus={() => setShowResults(true)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#fff',
                  fontSize: '0.82rem',
                  width: '100%',
                  fontFamily: 'inherit',
                }}
              />
            </div>
            {renderSearchResultsDropdown()}
          </div>

          {/* Navegación Principal de Módulos */}
          <nav
            className="hide-scrollbar"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              flexWrap: 'nowrap',
              overflowX: 'auto',
              order: isTablet ? 4 : 0,
              width: isTablet ? '100%' : 'auto',
              paddingTop: isTablet ? '4px' : 0,
              borderTop: isTablet ? '1px solid rgba(255,255,255,0.04)' : 'none',
            }}
          >
            <button
              id="nav-btn-dashboard"
              className={`btn ${currentTab === 'dashboard' ? 'btn-active' : 'btn-secondary'}`}
              style={{ padding: '6px 10px', fontSize: '0.77rem' }}
              onClick={() => setCurrentTab('dashboard')}
            >
              <Activity size={14} />
              Dashboard
            </button>

            <button
              id="nav-btn-screener"
              className={`btn ${
                currentTab === 'screener' || currentTab === 'finviz-screener'
                  ? 'btn-active'
                  : 'btn-secondary'
              }`}
              style={{ padding: '6px 10px', fontSize: '0.77rem' }}
              onClick={() => setCurrentTab('screener')}
            >
              <Layers size={14} color="var(--accent-green)" />
              Screener acciones
            </button>

            <button
              id="nav-btn-maps"
              className={`btn ${currentTab === 'maps' ? 'btn-active' : 'btn-secondary'}`}
              style={{ padding: '6px 10px', fontSize: '0.77rem' }}
              onClick={() => setCurrentTab('maps')}
            >
              <Grid size={14} color="var(--accent-cyan)" />
              Maps
            </button>

            <button
              id="nav-btn-ai-strategy"
              className={`btn ${currentTab === 'ai-strategy' ? 'btn-active' : 'btn-secondary'}`}
              style={{ padding: '6px 10px', fontSize: '0.77rem' }}
              onClick={() => setCurrentTab('ai-strategy')}
            >
              <Bot size={14} color="var(--accent-green)" />
              Estrategia IA
            </button>

            <button
              id="nav-btn-peers"
              className={`btn ${currentTab === 'peers' ? 'btn-active' : 'btn-secondary'}`}
              style={{ padding: '6px 10px', fontSize: '0.77rem' }}
              onClick={() => setCurrentTab('peers')}
            >
              <ArrowRight size={14} />
              Comparador
            </button>

            <button
              id="nav-btn-watchlist"
              className={`btn ${currentTab === 'watchlist' ? 'btn-active' : 'btn-secondary'}`}
              style={{ padding: '6px 10px', fontSize: '0.77rem' }}
              onClick={() => setCurrentTab('watchlist')}
            >
              <Bookmark size={14} />
              Mi Cartera
            </button>

            {isAdmin && (
              <button
                id="nav-btn-user-admin"
                className={`btn ${currentTab === 'user-admin' ? 'btn-active' : 'btn-secondary'}`}
                style={{
                  padding: '6px 11px',
                  fontSize: '0.77rem',
                  fontWeight: 800,
                  background:
                    currentTab === 'user-admin'
                      ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
                      : 'rgba(6, 182, 212, 0.12)',
                  border: '1px solid rgba(6, 182, 212, 0.35)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
                onClick={() => setCurrentTab('user-admin')}
                title="Panel Administrativo de Usuarios"
              >
                <Users size={14} color="var(--accent-cyan)" />
                Gestión Usuarios
              </button>
            )}

            {onToggleAgentDrawer && (
              <button
                id="nav-btn-agent-drawer"
                onClick={onToggleAgentDrawer}
                className="btn"
                style={{
                  padding: '6px 12px',
                  fontSize: '0.77rem',
                  fontWeight: 800,
                  background: isAgentDrawerOpen
                    ? 'linear-gradient(135deg, #059669 0%, #0284c7 100%)'
                    : 'rgba(16, 185, 129, 0.14)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  marginLeft: '4px',
                }}
                title="Abrir panel del Agente Inversor IA"
              >
                <Sparkles size={14} color="#34d399" />
                Agente IA
              </button>
            )}
          </nav>

          {/* Derecha: Estado de Mercado + Perfil Usuario */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'var(--bg-surface)',
                padding: '4px 10px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.71rem',
              }}
            >
              <div
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: isMarketOpen ? 'var(--accent-green)' : 'var(--accent-amber)',
                  boxShadow: isMarketOpen ? '0 0 6px #10b981' : '0 0 6px #f59e0b',
                }}
              />
              <div>
                <div
                  style={{
                    fontWeight: 700,
                    color: isMarketOpen ? 'var(--accent-green)' : 'var(--accent-amber)',
                  }}
                >
                  {isMarketOpen ? 'Mercado Abierto' : 'Mercado Cerrado'}
                </div>
                <div style={{ color: 'var(--text-muted)' }}>
                  <Clock size={10} style={{ display: 'inline', marginRight: '3px' }} />
                  {marketTime} EST{' '}
                  {!isTablet && lastUpdatedDate ? `• Cierre: ${lastUpdatedDate}` : ''}
                </div>
              </div>
            </div>

            {user && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'var(--bg-surface)',
                  padding: '4px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '7px',
                    background: isAdmin
                      ? 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)'
                      : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '0.74rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {(profile?.full_name || user.email || 'U').charAt(0).toUpperCase()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '110px' }}>
                  <span
                    style={{
                      fontSize: '0.74rem',
                      color: '#fff',
                      fontWeight: 700,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {profile?.full_name?.split(' ')[0] || user.email?.split('@')[0]}
                  </span>
                  <span
                    style={{
                      fontSize: '0.6rem',
                      color: isAdmin ? 'var(--accent-cyan)' : 'var(--accent-green)',
                      fontWeight: 800,
                    }}
                  >
                    {isAdmin ? 'ADMIN' : 'USUARIO'}
                  </span>
                </div>
                <button
                  onClick={() => {
                    signOut();
                    toast.info('Sesión cerrada correctamente');
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    marginLeft: '2px',
                  }}
                  title="Cerrar sesión"
                >
                  <LogOut size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. SUB-BARRA DE PESTAÑAS MÚLTIPLES PARA ACCIONES ABIERTAS */}
      {openStockTabs.length > 0 && (
        <div
          className="hide-scrollbar"
          style={{
            background: 'rgba(15, 23, 42, 0.78)',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            padding: isMobile ? '4px 12px' : '4px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {!isMobile && (
            <span
              style={{
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
                fontWeight: 600,
                textTransform: 'uppercase',
                marginRight: '6px',
                flexShrink: 0,
              }}
            >
              Acciones Abiertas:
            </span>
          )}

          {openStockTabs.map((ticker) => {
            const isActive = currentTab === 'detail' && activeStockTicker === ticker;
            const stockObj = stocks.find((s) => s.ticker === ticker);
            const chg = stockObj?.change_pct;

            return (
              <div
                key={ticker}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: isActive ? 'var(--bg-surface-active)' : 'var(--bg-surface)',
                  border: isActive
                    ? '1px solid var(--accent-green)'
                    : '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  padding: isMobile ? '3px 7px' : '3px 8px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
                onClick={() => onSwitchStockTab(ticker)}
              >
                <TrendingUp
                  size={12}
                  color={isActive ? 'var(--accent-green)' : 'var(--text-muted)'}
                />
                <span
                  className="font-mono"
                  style={{
                    fontWeight: 800,
                    fontSize: isMobile ? '0.74rem' : '0.78rem',
                    color: isActive ? '#fff' : 'var(--text-secondary)',
                  }}
                >
                  {ticker}
                </span>
                {chg !== undefined && chg !== null && (
                  <span
                    style={{ fontSize: '0.66rem', fontWeight: 700 }}
                    className={chg >= 0 ? 'delta-positive' : 'delta-negative'}
                  >
                    {chg >= 0 ? '+' : ''}
                    {chg.toFixed(1)}%
                  </span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseStockTab(ticker);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    marginLeft: '1px',
                  }}
                  title={`Cerrar pestaña de ${ticker}`}
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </header>
  );
};
