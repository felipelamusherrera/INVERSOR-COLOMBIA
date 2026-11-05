import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  Search, 
  Clock, 
  Layers, 
  TrendingUp, 
  Bookmark, 
  Activity, 
  ArrowRight
} from 'lucide-react';
import type { StockRecord } from '../types/stock';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  stocks: StockRecord[];
  onSelectStock: (stock: StockRecord) => void;
  selectedStock: StockRecord | null;
  lastUpdatedDate: string | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  stocks,
  onSelectStock,
  selectedStock,
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
      // Hora en New York (Eastern Time)
      const nyTimeStr = now.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setMarketTime(nyTimeStr);

      // Determinar si el mercado está abierto (Lunes a Viernes 9:30 AM - 4:00 PM EST)
      const nyDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      const day = nyDate.getDay();
      const hours = nyDate.getHours();
      const minutes = nyDate.getMinutes();
      const totalMinutes = hours * 60 + minutes;

      const isWeekday = day >= 1 && day <= 5;
      const isOpen = isWeekday && totalMinutes >= 570 && totalMinutes < 960; // 9:30 AM to 4:00 PM
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
        const aComp = (a.company || '').toLowerCase();
        const bComp = (b.company || '').toLowerCase();

        if (aTick === query && bTick !== query) return -1;
        if (bTick === query && aTick !== query) return 1;

        const aStarts = aTick.startsWith(query);
        const bStarts = bTick.startsWith(query);
        if (aStarts && !bStarts) return -1;
        if (bStarts && !aStarts) return 1;

        const aCompStarts = aComp.startsWith(query);
        const bCompStarts = bComp.startsWith(query);
        if (aCompStarts && !bCompStarts) return -1;
        if (bCompStarts && !aCompStarts) return 1;

        return (b.market_cap || 0) - (a.market_cap || 0);
      })
      .slice(0, 8);
  }, [stocks, searchQuery]);

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      background: 'rgba(7, 9, 14, 0.85)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border-subtle)',
      padding: '0 24px',
    }}>
      <div style={{
        maxWidth: '1440px',
        margin: '0 auto',
        height: '70px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '20px'
      }}>
        {/* Logo / Marca */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => setCurrentTab('dashboard')}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #10b981, #06b6d4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(16, 185, 129, 0.35)'
          }}>
            <BarChart3 size={24} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 800, fontSize: '1.15rem', letterSpacing: '-0.02em', color: '#fff' }}>
                INVERSOR<span style={{ color: 'var(--accent-green)' }}> COLOMBIA</span>
              </span>
              <span style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                background: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--accent-green)',
                padding: '2px 6px',
                borderRadius: '4px',
                border: '1px solid rgba(16, 185, 129, 0.3)'
              }}>
                PRO QUANT
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Inteligencia Cuantitativa de Mercados Globales
            </div>
          </div>
        </div>

        {/* Barra de Búsqueda Rápida */}
        <div style={{ position: 'relative', width: '320px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '8px 12px',
            gap: '8px'
          }}>
            <Search size={16} color="var(--text-muted)" />
            <input
              id="search-ticker-input"
              type="text"
              placeholder="Buscar ticker (ej: PSX, NVDA, AAPL)..."
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
                fontSize: '0.85rem',
                width: '100%',
                fontFamily: 'inherit'
              }}
            />
          </div>

          {/* Menú de Resultados de Búsqueda */}
          {showResults && filtered.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '46px',
              left: 0,
              right: 0,
              background: '#0f172a',
              border: '1px solid var(--border-medium)',
              borderRadius: '10px',
              boxShadow: 'var(--shadow-lg)',
              overflow: 'hidden',
              zIndex: 100
            }}>
              {filtered.map((s: StockRecord) => (
                <div
                  key={s.ticker}
                  style={{
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    transition: 'background var(--transition-fast)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  onClick={() => {
                    onSelectStock(s);
                    setCurrentTab('detail');
                    setShowResults(false);
                    setSearchQuery('');
                  }}
                >
                  <div>
                    <span className="font-mono" style={{ fontWeight: 700, color: '#fff', marginRight: '8px' }}>
                      {s.ticker}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {s.company}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="font-mono" style={{ fontWeight: 600, color: '#fff', fontSize: '0.85rem' }}>
                      ${s.price?.toFixed(2)}
                    </div>
                    {s.change_pct !== undefined && s.change_pct !== null && (
                      <span style={{ fontSize: '0.75rem' }} className={s.change_pct >= 0 ? 'delta-positive' : 'delta-negative'}>
                        {s.change_pct >= 0 ? '+' : ''}{s.change_pct.toFixed(2)}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Navegación Principal */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button 
            id="nav-btn-dashboard"
            className={`btn ${currentTab === 'dashboard' ? 'btn-active' : 'btn-secondary'}`}
            onClick={() => setCurrentTab('dashboard')}
          >
            <Activity size={16} />
            Dashboard
          </button>

          <button 
            id="nav-btn-screener"
            className={`btn ${currentTab === 'screener' ? 'btn-active' : 'btn-secondary'}`}
            onClick={() => setCurrentTab('screener')}
          >
            <Layers size={16} />
            Screener Quant ({stocks.length})
          </button>

          {selectedStock && (
            <button 
              id="nav-btn-detail"
              className={`btn ${currentTab === 'detail' ? 'btn-active' : 'btn-secondary'}`}
              onClick={() => setCurrentTab('detail')}
            >
              <TrendingUp size={16} />
              {selectedStock.ticker} (Análisis)
            </button>
          )}

          <button 
            id="nav-btn-peers"
            className={`btn ${currentTab === 'peers' ? 'btn-active' : 'btn-secondary'}`}
            onClick={() => setCurrentTab('peers')}
          >
            <ArrowRight size={16} />
            Comparador
          </button>

          <button 
            id="nav-btn-watchlist"
            className={`btn ${currentTab === 'watchlist' ? 'btn-active' : 'btn-secondary'}`}
            onClick={() => setCurrentTab('watchlist')}
          >
            <Bookmark size={16} />
            Mi Cartera
          </button>
        </nav>

        {/* Estado de Mercado Wall Street */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: 'var(--bg-surface)',
          padding: '6px 12px',
          borderRadius: '8px',
          border: '1px solid var(--border-subtle)',
          fontSize: '0.78rem'
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: isMarketOpen ? 'var(--accent-green)' : 'var(--accent-amber)',
            boxShadow: isMarketOpen ? '0 0 8px #10b981' : '0 0 8px #f59e0b'
          }} />
          <div>
            <div style={{ fontWeight: 600, color: isMarketOpen ? 'var(--accent-green)' : 'var(--accent-amber)' }}>
              {isMarketOpen ? 'Mercado Abierto' : 'Mercado Cerrado'}
            </div>
            <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={11} /> {marketTime} EST {lastUpdatedDate && `• Cierre: ${lastUpdatedDate}`}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
