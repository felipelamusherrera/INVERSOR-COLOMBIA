import React, { useState, useEffect, useMemo } from 'react';
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
  Filter,
  X
} from 'lucide-react';
import type { StockRecord } from '../types/stock';

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
  lastUpdatedDate
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [marketTime, setMarketTime] = useState('');
  const [isMarketOpen, setIsMarketOpen] = useState(false);

  // Reloj de Wall Street (Hora Nueva York)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const nyTimeStr = now.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setMarketTime(nyTimeStr);

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
      .filter(s => 
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

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      background: 'rgba(7, 9, 14, 0.92)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border-subtle)'
    }}>
      {/* 1. Barra Principal Superior */}
      <div className="navbar-top-bar" style={{
        maxWidth: '1600px',
        margin: '0 auto',
        minHeight: '66px',
        padding: '8px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        {/* Logo / Marca */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flexShrink: 0 }} onClick={() => setCurrentTab('dashboard')}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '9px',
            background: 'linear-gradient(135deg, #10b981, #06b6d4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(16, 185, 129, 0.35)'
          }}>
            <BarChart3 size={20} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '-0.02em', color: '#fff' }}>
                INVERSOR<span style={{ color: 'var(--accent-green)' }}> COLOMBIA</span>
              </span>
              <span style={{
                fontSize: '0.62rem',
                fontWeight: 700,
                background: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--accent-green)',
                padding: '1px 5px',
                borderRadius: '4px',
                border: '1px solid rgba(16, 185, 129, 0.3)'
              }}>
                PRO QUANT
              </span>
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              Inteligencia Cuantitativa de Mercados
            </div>
          </div>
        </div>

        {/* Buscador Rápido de Tickers (No cierra pestañas previas al seleccionar) */}
        <div className="navbar-search-box" style={{ position: 'relative', width: '260px', flexShrink: 0 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: '6px 10px',
            gap: '8px'
          }}>
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
                fontFamily: 'inherit'
              }}
            />
          </div>

          {/* Menú Flotante de Resultados */}
          {showResults && filtered.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '42px',
              left: 0,
              right: 0,
              background: '#0f172a',
              border: '1px solid var(--border-medium)',
              borderRadius: '8px',
              boxShadow: 'var(--shadow-lg)',
              overflow: 'hidden',
              zIndex: 100
            }}>
              {filtered.map((s: StockRecord) => (
                <div
                  key={s.ticker}
                  style={{
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    borderBottom: '1px solid rgba(255,255,255,0.05)'
                  }}
                  className="data-row-hover"
                  onClick={() => {
                    onSelectStock(s);
                    setShowResults(false);
                    setSearchQuery('');
                  }}
                >
                  <div>
                    <span className="font-mono" style={{ fontWeight: 800, color: '#fff', marginRight: '6px' }}>
                      {s.ticker}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {s.company}
                    </span>
                  </div>
                  <div className="font-mono" style={{ fontWeight: 700, color: '#fff', fontSize: '0.8rem' }}>
                    ${s.price?.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Navegación Principal de Módulos */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'nowrap', overflowX: 'auto' }}>
          <button 
            id="nav-btn-dashboard"
            className={`btn ${currentTab === 'dashboard' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '6px 10px', fontSize: '0.78rem' }}
            onClick={() => setCurrentTab('dashboard')}
          >
            <Activity size={14} />
            Dashboard
          </button>

          <button 
            id="nav-btn-screener"
            className={`btn ${currentTab === 'screener' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '6px 10px', fontSize: '0.78rem' }}
            onClick={() => setCurrentTab('screener')}
          >
            <Layers size={14} />
            Screener Quant
          </button>

          {/* Nuevo Módulo: Screener Finviz */}
          <button 
            id="nav-btn-finviz-screener"
            className={`btn ${currentTab === 'finviz-screener' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '6px 10px', fontSize: '0.78rem' }}
            onClick={() => setCurrentTab('finviz-screener')}
          >
            <Filter size={14} color="var(--accent-green)" />
            Screener Finviz
          </button>

          {/* Nuevo Módulo: Maps (Heatmap Finviz) */}
          <button 
            id="nav-btn-maps"
            className={`btn ${currentTab === 'maps' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '6px 10px', fontSize: '0.78rem' }}
            onClick={() => setCurrentTab('maps')}
          >
            <Grid size={14} color="var(--accent-cyan)" />
            Maps
          </button>

          {/* Nuevo Módulo: Estrategia IA Inversor */}
          <button 
            id="nav-btn-ai-strategy"
            className={`btn ${currentTab === 'ai-strategy' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '6px 10px', fontSize: '0.78rem' }}
            onClick={() => setCurrentTab('ai-strategy')}
          >
            <Bot size={14} color="var(--accent-green)" />
            Estrategia IA
          </button>

          <button 
            id="nav-btn-peers"
            className={`btn ${currentTab === 'peers' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '6px 10px', fontSize: '0.78rem' }}
            onClick={() => setCurrentTab('peers')}
          >
            <ArrowRight size={14} />
            Comparador
          </button>

          <button 
            id="nav-btn-watchlist"
            className={`btn ${currentTab === 'watchlist' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '6px 10px', fontSize: '0.78rem' }}
            onClick={() => setCurrentTab('watchlist')}
          >
            <Bookmark size={14} />
            Mi Cartera
          </button>
        </nav>

        {/* Estado de Mercado Wall Street */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'var(--bg-surface)',
          padding: '4px 10px',
          borderRadius: '8px',
          border: '1px solid var(--border-subtle)',
          fontSize: '0.72rem',
          flexShrink: 0
        }}>
          <div style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: isMarketOpen ? 'var(--accent-green)' : 'var(--accent-amber)',
            boxShadow: isMarketOpen ? '0 0 6px #10b981' : '0 0 6px #f59e0b'
          }} />
          <div>
            <div style={{ fontWeight: 700, color: isMarketOpen ? 'var(--accent-green)' : 'var(--accent-amber)' }}>
              {isMarketOpen ? 'Mercado Abierto' : 'Mercado Cerrado'}
            </div>
            <div style={{ color: 'var(--text-muted)' }}>
              <Clock size={10} style={{ display: 'inline', marginRight: '3px' }} />
              {marketTime} EST {lastUpdatedDate ? `• Cierre: ${lastUpdatedDate}` : ''}
            </div>
          </div>
        </div>
      </div>

      {/* 2. SUB-BARRA DE PESTAÑAS MÚLTIPLES PARA ACCIONES ABIERTAS (Sin cerrar las anteriores) */}
      {openStockTabs.length > 0 && (
        <div style={{
          background: 'rgba(15, 23, 42, 0.75)',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          padding: '4px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          overflowX: 'auto'
        }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginRight: '6px' }}>
            Acciones Abiertas:
          </span>

          {openStockTabs.map(ticker => {
            const isActive = currentTab === 'detail' && activeStockTicker === ticker;
            const stockObj = stocks.find(s => s.ticker === ticker);
            const chg = stockObj?.change_pct;

            return (
              <div
                key={ticker}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: isActive ? 'var(--bg-surface-active)' : 'var(--bg-surface)',
                  border: isActive ? '1px solid var(--accent-green)' : '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onClick={() => onSwitchStockTab(ticker)}
              >
                <TrendingUp size={12} color={isActive ? 'var(--accent-green)' : 'var(--text-muted)'} />
                <span className="font-mono" style={{ fontWeight: 800, fontSize: '0.78rem', color: isActive ? '#fff' : 'var(--text-secondary)' }}>
                  {ticker}
                </span>
                {chg !== undefined && chg !== null && (
                  <span style={{ fontSize: '0.68rem', fontWeight: 700 }} className={chg >= 0 ? 'delta-positive' : 'delta-negative'}>
                    {chg >= 0 ? '+' : ''}{chg.toFixed(1)}%
                  </span>
                )}
                {/* Botón de Cierre de Pestaña */}
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
                    marginLeft: '2px'
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
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
