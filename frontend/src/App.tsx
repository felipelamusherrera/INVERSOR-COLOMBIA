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
import { GlobalAIAgentDrawer } from './components/GlobalAIAgentDrawer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthView } from './components/AuthView';
import { UserAdminModule } from './components/UserAdminModule';
import type { AgentIntentType, ScreenerUIFilterPayload } from './types/agent';
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
  | 'watchlist'
  | 'user-admin';

function AppContent() {
  const { user, loading: authLoading, isEmailConfirmed, isAdmin } = useAuth();

  const [stocks, setStocks] = useState<StockRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState<MainTabType>('dashboard');
  const [snapshotDate, setSnapshotDate] = useState<string | null>(null);

  // Redirigir si un usuario no administrador intenta entrar a la pestaña de administración
  useEffect(() => {
    if (currentTab === 'user-admin' && !isAdmin) {
      setCurrentTab('dashboard');
    }
  }, [currentTab, isAdmin]);

  // Sistema de Pestañas Múltiples de Acciones (No cierra la ventana de la acción anterior)
  const [openStockTabs, setOpenStockTabs] = useState<string[]>(['MU']);
  const [activeStockTicker, setActiveStockTicker] = useState<string | null>('MU');

  // Estado del Drawer Flotante Global del Agente Inversor IA (Fase 2 & Fase 3)
  const [isAgentDrawerOpen, setIsAgentDrawerOpen] = useState(false);
  const [agentExternalTrigger, setAgentExternalTrigger] = useState<{
    prompt: string;
    intent?: AgentIntentType;
    timestamp: number;
  } | null>(null);
  const [externalScreenerFilters, setExternalScreenerFilters] = useState<{
    filters: ScreenerUIFilterPayload;
    timestamp: number;
  } | null>(null);

  const handleTriggerAgentPrompt = (prompt: string, intent?: AgentIntentType) => {
    setIsAgentDrawerOpen(true);
    setAgentExternalTrigger({
      prompt,
      intent,
      timestamp: Date.now(),
    });
  };

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
    // Cargar datos del mercado solo si el usuario está autenticado y confirmado
    if (user && isEmailConfirmed) {
      loadStocks();
    }
  }, [user, isEmailConfirmed]);

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

  // Cerrar una pestaña de acción abierta
  const handleCloseStockTab = (tickerToClose: string) => {
    const updated = openStockTabs.filter(t => t !== tickerToClose);
    setOpenStockTabs(updated);

    if (activeStockTicker === tickerToClose) {
      if (updated.length > 0) {
        setActiveStockTicker(updated[updated.length - 1]);
      } else {
        setActiveStockTicker(null);
        setCurrentTab('screener');
      }
    }
  };

  // Acción activa actual
  const currentActiveStock = stocks.find(s => s.ticker === activeStockTicker) || 
    (stocks.length > 0 ? stocks[0] : null);

  // 1. PANTALLA DE CARGA DE SESIÓN
  if (authLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#030712',
        color: '#fff',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{
          width: '52px',
          height: '52px',
          borderRadius: '14px',
          background: 'linear-gradient(135deg, #06b6d4 0%, #10b981 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 30px rgba(6, 182, 212, 0.45)'
        }}>
          <ShieldCheck size={30} color="#fff" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.92rem', color: 'var(--text-secondary)' }}>
          <RefreshCw size={16} className="animate-spin" color="var(--accent-cyan)" />
          Cargando Inversor Colombia...
        </div>
      </div>
    );
  }

  // 2. USUARIO NO AUTENTICADO: MOSTRAR FORMULARIO DE ACCESO (LOGIN / REGISTRO)
  if (!user) {
    return (
      <>
        <Toaster position="top-right" richColors theme="dark" />
        <AuthView initialMode="login" />
      </>
    );
  }

  // 3. USUARIO CON CORREO NO CONFIRMADO: MOSTRAR BLOQUEO HASTA VALIDACIÓN
  if (!isEmailConfirmed) {
    return (
      <>
        <Toaster position="top-right" richColors theme="dark" />
        <AuthView emailUnconfirmed={true} />
      </>
    );
  }

  // 4. USUARIO AUTENTICADO Y CONFIRMADO: ACCESO COMPLETO A LA PLATAFORMA
  return (
    <div className="app-container">
      <Toaster position="top-right" richColors theme="dark" />

      {/* Barra de Navegación Institucional */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={(tab) => setCurrentTab(tab as MainTabType)}
        stocks={stocks}
        onSelectStock={handleSelectStock}
        selectedStock={currentActiveStock}
        openStockTabs={openStockTabs}
        activeStockTicker={activeStockTicker}
        onSwitchStockTab={handleSwitchStockTab}
        onCloseStockTab={handleCloseStockTab}
        lastUpdatedDate={snapshotDate}
        onToggleAgentDrawer={() => setIsAgentDrawerOpen(!isAgentDrawerOpen)}
        isAgentDrawerOpen={isAgentDrawerOpen}
      />

      {/* Contenedor Principal de Vistas */}
      <main className="main-content">
        {loading && stocks.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '60vh',
            gap: '16px'
          }}>
            <RefreshCw size={36} className="animate-spin" color="var(--accent-cyan)" />
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Cargando métricas de mercado en tiempo real desde Supabase...
            </div>
          </div>
        ) : error && stocks.length === 0 ? (
          <div style={{
            maxWidth: '600px',
            margin: '60px auto',
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

            {/* 2. Screener Acciones Unificado (Finviz Filters + Screener Quant Styling + Fase 3 Natural Language Filter) */}
            {(currentTab === 'screener' || currentTab === 'finviz-screener') && (
              <StockScreener
                stocks={stocks}
                onSelectStock={handleSelectStock}
                selectedStock={currentActiveStock}
                externalAIFilters={externalScreenerFilters}
                onOpenAgentDrawerWithQuery={(query: string) => handleTriggerAgentPrompt(query, 'screener_query')}
              />
            )}

            {/* 3. Maps Heatmap / Matriz Sectorial */}
            {currentTab === 'maps' && (
              <FinvizMap
                stocks={stocks}
                onSelectStock={handleSelectStock}
              />
            )}

            {/* 4. Estrategia IA Inversor (Feed / Muro + Registro de Posiciones) */}
            {currentTab === 'ai-strategy' && (
              <StrategyAIModule
                stocks={stocks}
                onSelectStock={handleSelectStock}
                onAddToWatchlist={handleToggleWatchlist}
              />
            )}

            {/* 5. Análisis Detallado (Multi-Pestaña) */}
            {currentTab === 'detail' && currentActiveStock && (
              <ErrorBoundary fallbackTitle={`Error al cargar el análisis de ${currentActiveStock.ticker}`} onReset={() => setCurrentTab('screener')}>
                <StockDetail
                  key={currentActiveStock.ticker}
                  stock={currentActiveStock}
                  onBack={() => setCurrentTab('screener')}
                  onToggleWatchlist={handleToggleWatchlist}
                  isWatchlisted={watchlist.includes(currentActiveStock.ticker)}
                  allStocks={stocks}
                  onTriggerAgentPrompt={handleTriggerAgentPrompt}
                />
              </ErrorBoundary>
            )}

            {/* 6. Comparador de Acciones */}
            {currentTab === 'peers' && (
              <PeersComparison
                stocks={stocks}
                selectedStock={currentActiveStock}
                onSelectStock={handleSelectStock}
                onToggleWatchlist={handleToggleWatchlist}
                watchlist={watchlist}
              />
            )}

            {/* 7. Mi Cartera Mejorada (Posiciones Long/Short, P&L en vivo, Gráfico Multi-temporal y Auditoría IA Fase 3) */}
            {currentTab === 'watchlist' && (
              <Watchlist
                stocks={stocks}
                watchlist={watchlist}
                onToggleWatchlist={handleToggleWatchlist}
                onSelectStock={handleSelectStock}
                onGoToScreener={() => setCurrentTab('screener')}
                onAuditPortfolioWithAI={() =>
                  handleTriggerAgentPrompt(
                    'Audita el estado actual de mi cartera: posiciones abiertas, peso porcentual por acción, concentración sectorial y liquidez en efectivo disponible.',
                    'portfolio_audit'
                  )
                }
              />
            )}

            {/* 8. Módulo de Administración de Usuarios (Exclusivo Administradores) */}
            {currentTab === 'user-admin' && (
              isAdmin ? (
                <UserAdminModule />
              ) : (
                <MarketOverview
                  stocks={stocks}
                  onSelectStock={handleSelectStock}
                  onGoToScreener={() => setCurrentTab('screener')}
                  snapshotDate={snapshotDate}
                />
              )
            )}
          </>
        )}
      </main>

      {/* Panel Flotante y Drawer Global del Agente Inversor IA */}
      <GlobalAIAgentDrawer
        isOpen={isAgentDrawerOpen}
        onClose={() => setIsAgentDrawerOpen(false)}
        onOpen={() => setIsAgentDrawerOpen(true)}
        stocks={stocks}
        activeStock={currentActiveStock}
        currentTab={currentTab}
        onSelectStock={handleSelectStock}
        onNavigateTab={(tab: string) => setCurrentTab(tab as MainTabType)}
        externalPromptTrigger={agentExternalTrigger}
        onApplyScreenerFilters={(filters) => {
          setExternalScreenerFilters({ filters, timestamp: Date.now() });
          toast.success('Filtros del Agente Inversor IA sincronizados en el Screener Acciones');
        }}
      />

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
              Control de Acceso & Perfiles RLS
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
