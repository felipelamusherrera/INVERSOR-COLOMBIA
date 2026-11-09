import { useState, useEffect } from 'react';
import './App.css';
import { supabase } from './lib/supabase';
import type { StockRecord } from './types/stock';
import { Navbar } from './components/Navbar';
import { MarketOverview } from './components/MarketOverview';
import { StockScreener } from './components/StockScreener';
import { StockDetail } from './components/StockDetail';
import { PeersComparison } from './components/PeersComparison';
import { Watchlist } from './components/Watchlist';
import { FinvizMap } from './components/FinvizMap';
import { StrategyAIModule } from './components/StrategyAIModule';
import { Toaster, toast } from 'sonner';
import { AlertCircle, RefreshCw, Database, ShieldCheck } from 'lucide-react';

export type MainTabType = 
  | 'dashboard' 
  | 'screener' 
  | 'finviz-screener' 
  | 'maps' 
  | 'ai-strategy' 
  | 'detail' 
  | 'peers' 
  | 'watchlist';

export function App() {
  const [stocks, setStocks] = useState<StockRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState<MainTabType>('dashboard');
  const [snapshotDate, setSnapshotDate] = useState<string | null>(null);

  // Sistema de Pestañas Múltiples de Acciones (No cierra la ventana de la acción anterior)
  const [openStockTabs, setOpenStockTabs] = useState<string[]>(['MU']);
  const [activeStockTicker, setActiveStockTicker] = useState<string | null>('MU');

  // Watchlist persistida en localStorage
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('inversor_colombia_watchlist');
      return saved ? JSON.parse(saved) : ['NVDA', 'PSX', 'AAPL', 'MSFT'];
    } catch {
      return ['NVDA', 'PSX'];
    }
  });

  const saveWatchlist = (newList: string[]) => {
    setWatchlist(newList);
    try {
      localStorage.setItem('inversor_colombia_watchlist', JSON.stringify(newList));
    } catch (err) {
      console.error('Error saving watchlist:', err);
    }
  };

  const handleToggleWatchlist = (ticker: string) => {
    if (watchlist.includes(ticker)) {
      saveWatchlist(watchlist.filter(t => t !== ticker));
      toast.info(`Removido de Mi Cartera: ${ticker}`);
    } else {
      saveWatchlist([...watchlist, ticker]);
      toast.success(`Añadido a Mi Cartera: ${ticker}`);
    }
  };

  // Carga de datos desde Supabase
  const loadStocks = async () => {
    setLoading(true);
    setError(null);
    try {
      let allData: StockRecord[] = [];
      let from = 0;
      const step = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error: fetchErr } = await supabase
          .from('inversor_colombia_latest')
          .select('*')
          .range(from, from + step - 1);

        if (fetchErr) {
          console.warn('Error fetching from inversor_colombia_latest:', fetchErr);
          break;
        }

        if (data && data.length > 0) {
          allData = allData.concat(data as StockRecord[]);
          if (data.length < step) {
            hasMore = false;
          } else {
            from += step;
          }
        } else {
          hasMore = false;
        }
      }

      let finalStocks = allData;

      if (finalStocks.length === 0) {
        console.warn('Fallback to base table inversor_colombia_stocks...');
        const baseRes = await supabase
          .from('inversor_colombia_stocks')
          .select('*')
          .order('snapshot_date', { ascending: false })
          .limit(1000);

        if (baseRes.error) {
          throw baseRes.error;
        }

        const map = new Map<string, StockRecord>();
        (baseRes.data || []).forEach((row: StockRecord) => {
          if (!map.has(row.ticker)) {
            map.set(row.ticker, row);
          }
        });
        finalStocks = Array.from(map.values());
      }

      if (finalStocks.length > 0) {
        setStocks(finalStocks);
        const dates = finalStocks.map((s: StockRecord) => s.snapshot_date).filter(Boolean);
        if (dates.length > 0) {
          dates.sort().reverse();
          setSnapshotDate(dates[0]);
        }
      } else {
        setStocks([]);
      }
    } catch (err: any) {
      console.error('Error loading stocks from Supabase:', err);
      setError(err.message || 'Error de conexión con la base de datos de Supabase.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStocks();
  }, []);

  // Seleccionar stock y abrirlo en una nueva pestaña sin cerrar las anteriores
  const handleSelectStock = (stock: StockRecord) => {
    const tick = stock.ticker.toUpperCase();
    if (!openStockTabs.includes(tick)) {
      setOpenStockTabs(prev => [...prev, tick]);
    }
    setActiveStockTicker(tick);
    setCurrentTab('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Cambiar entre pestañas de acciones abiertas
  const handleSwitchStockTab = (ticker: string) => {
    setActiveStockTicker(ticker);
    setCurrentTab('detail');
  };

  // Cerrar pestaña de una acción
  const handleCloseStockTab = (ticker: string) => {
    const filtered = openStockTabs.filter(t => t !== ticker);
    setOpenStockTabs(filtered);

    if (activeStockTicker === ticker) {
      if (filtered.length > 0) {
        setActiveStockTicker(filtered[filtered.length - 1]);
        setCurrentTab('detail');
      } else {
        setActiveStockTicker(null);
        setCurrentTab('screener');
      }
    }
  };

  // Acción activa actual
  const currentActiveStock = stocks.find(s => s.ticker === activeStockTicker) || stocks[0] || null;

  return (
    <div className="app-container">
      {/* Toast Notifier Sonner */}
      <Toaster position="top-right" richColors />

      {/* Barra de Navegación Global con Sistema Multi-Pestaña */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={(tab: any) => setCurrentTab(tab)}
        stocks={stocks}
        onSelectStock={handleSelectStock}
        selectedStock={currentActiveStock}
        openStockTabs={openStockTabs}
        activeStockTicker={activeStockTicker}
        onSwitchStockTab={handleSwitchStockTab}
        onCloseStockTab={handleCloseStockTab}
        lastUpdatedDate={snapshotDate}
      />

      {/* Contenido Principal */}
      <main className="main-content">
        {loading ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '65vh',
            gap: '16px'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              border: '3px solid rgba(56, 189, 248, 0.1)',
              borderTopColor: 'var(--brand-primary)',
              animation: 'spin 1s linear infinite'
            }} />
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '1rem' }}>
              Sincronizando modelos cuantitativos desde Supabase...
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Procesando más de 100 métricas financieras de Finviz y Factor Grades
            </div>
            <style>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        ) : error ? (
          <div style={{
            maxWidth: '600px',
            margin: '80px auto',
            padding: '32px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: '16px',
            textAlign: 'center'
          }}>
            <AlertCircle size={42} color="#ef4444" style={{ margin: '0 auto 16px auto' }} />
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0 0 8px 0', color: '#fff' }}>
              No se pudo conectar a Supabase
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.5, marginBottom: '20px' }}>
              {error}
            </p>
            <button onClick={loadStocks} className="btn btn-primary" style={{ margin: '0 auto' }}>
              <RefreshCw size={15} />
              Reintentar Conexión
            </button>
          </div>
        ) : (
          <>
            {/* 1. Dashboard Principal */}
            {currentTab === 'dashboard' && (
              <MarketOverview
                stocks={stocks}
                onSelectStock={handleSelectStock}
                onGoToScreener={() => setCurrentTab('screener')}
                snapshotDate={snapshotDate}
              />
            )}

            {/* 2. Screener Acciones Unificado (Finviz Filters + Screener Quant Styling) */}
            {(currentTab === 'screener' || currentTab === 'finviz-screener') && (
              <StockScreener
                stocks={stocks}
                onSelectStock={handleSelectStock}
                selectedStock={currentActiveStock}
              />
            )}

            {/* 4. NUEVO MÓDULO: Maps Heatmap / Matriz Sectorial (Imagen 3) */}
            {currentTab === 'maps' && (
              <FinvizMap
                stocks={stocks}
                onSelectStock={handleSelectStock}
              />
            )}

            {/* 5. NUEVO MÓDULO: Estrategia IA Inversor (Feed / Muro + Registro de Posiciones) */}
            {currentTab === 'ai-strategy' && (
              <StrategyAIModule
                stocks={stocks}
                onSelectStock={handleSelectStock}
                onAddToWatchlist={handleToggleWatchlist}
              />
            )}

            {/* 6. Análisis Detallado (Multi-Pestaña) */}
            {currentTab === 'detail' && currentActiveStock && (
              <StockDetail
                key={currentActiveStock.ticker}
                stock={currentActiveStock}
                onBack={() => setCurrentTab('screener')}
                onToggleWatchlist={handleToggleWatchlist}
                isWatchlisted={watchlist.includes(currentActiveStock.ticker)}
                allStocks={stocks}
              />
            )}

            {/* 7. Comparador de Acciones */}
            {currentTab === 'peers' && (
              <PeersComparison
                stocks={stocks}
                selectedStock={currentActiveStock}
                onSelectStock={handleSelectStock}
                onToggleWatchlist={handleToggleWatchlist}
                watchlist={watchlist}
              />
            )}

            {/* 8. Mi Cartera Mejorada (Posiciones Long/Short, P&L en vivo y Gráfico Multi-temporal) */}
            {currentTab === 'watchlist' && (
              <Watchlist
                stocks={stocks}
                watchlist={watchlist}
                onToggleWatchlist={handleToggleWatchlist}
                onSelectStock={handleSelectStock}
                onGoToScreener={() => setCurrentTab('screener')}
              />
            )}
          </>
        )}
      </main>

      {/* Footer Institucional */}
      <footer className="footer">
        <div style={{ maxWidth: '1600px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--state-success)' }} />
            <span style={{ fontWeight: 600, color: '#fff' }}>Inversor Colombia</span>
            <span>— Modelo Cuantitativo Factorial & Comité de 4 Agentes de Inversión</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.78rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Database size={13} color="var(--brand-primary)" />
              Supabase PostgreSQL (103 métricas Finviz)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ShieldCheck size={13} color="var(--state-success)" />
              Histórico móvil 30 días
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
