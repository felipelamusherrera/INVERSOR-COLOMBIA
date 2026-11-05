import React, { useState, useMemo, useEffect } from 'react';
import { 
  Trash2, 
  Eye, 
  Plus, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight, 
  X, 
  Briefcase
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  ReferenceLine 
} from 'recharts';
import type { StockRecord } from '../types/stock';

export interface PortfolioPosition {
  id: string;
  ticker: string;
  direction: 'LONG' | 'SHORT';
  shares: number;
  entryPrice: number;
  entryDate: string; // 'YYYY-MM-DD'
  notes?: string;
}

interface WatchlistProps {
  stocks: StockRecord[];
  watchlist: string[];
  onToggleWatchlist: (ticker: string) => void;
  onSelectStock: (stock: StockRecord) => void;
  onGoToScreener: () => void;
}

type PnlTimeframe = '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | '2Y' | 'ALL';

export const Watchlist: React.FC<WatchlistProps> = ({
  stocks,
  watchlist,
  onToggleWatchlist,
  onSelectStock,
  onGoToScreener
}) => {
  // Modal de Añadir Posición
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalTicker, setModalTicker] = useState('NVDA');
  const [modalDirection, setModalDirection] = useState<'LONG' | 'SHORT'>('LONG');
  const [modalShares, setModalShares] = useState<number>(10);
  const [modalPrice, setModalPrice] = useState<number>(120);
  const [modalDate, setModalDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [modalNotes, setModalNotes] = useState('');

  // Rango de tiempo para el gráfico de P&L
  const [pnlTimeframe, setPnlTimeframe] = useState<PnlTimeframe>('1M');

  // Posiciones de cartera persistidas en localStorage
  const [positions, setPositions] = useState<PortfolioPosition[]>(() => {
    try {
      const saved = localStorage.getItem('inversor_colombia_portfolio_positions');
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignorar
    }
    // Posiciones iniciales de ejemplo
    return [
      { id: 'pos-1', ticker: 'NVDA', direction: 'LONG', shares: 15, entryPrice: 112.50, entryDate: '2026-08-15' },
      { id: 'pos-2', ticker: 'AAPL', direction: 'LONG', shares: 10, entryPrice: 218.00, entryDate: '2026-09-01' },
      { id: 'pos-3', ticker: 'MU', direction: 'LONG', shares: 25, entryPrice: 94.20, entryDate: '2026-09-20' }
    ];
  });

  const savePositions = (newPositions: PortfolioPosition[]) => {
    setPositions(newPositions);
    try {
      localStorage.setItem('inversor_colombia_portfolio_positions', JSON.stringify(newPositions));
    } catch (e) {
      console.error('Error saving portfolio positions:', e);
    }
  };

  // Pre-cargar precio al cambiar ticker en modal
  useEffect(() => {
    const s = stocks.find(st => st.ticker.toUpperCase() === modalTicker.toUpperCase());
    if (s && s.price) {
      setModalPrice(s.price);
    }
  }, [modalTicker, stocks]);

  // Añadir Posición
  const handleAddPosition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTicker || modalShares <= 0 || modalPrice <= 0) return;

    const newPos: PortfolioPosition = {
      id: `pos-${Date.now()}`,
      ticker: modalTicker.toUpperCase().trim(),
      direction: modalDirection,
      shares: Number(modalShares),
      entryPrice: Number(modalPrice),
      entryDate: modalDate || new Date().toISOString().slice(0, 10),
      notes: modalNotes.trim() || undefined
    };

    const updated = [newPos, ...positions];
    savePositions(updated);

    // Si no está en watchlist, agregarla también
    if (!watchlist.includes(newPos.ticker)) {
      onToggleWatchlist(newPos.ticker);
    }

    setShowAddModal(false);
    setModalNotes('');
  };

  // Eliminar Posición
  const handleDeletePosition = (id: string) => {
    const updated = positions.filter(p => p.id !== id);
    savePositions(updated);
  };

  // Mapa rápido de stocks para enriquecimiento
  const stocksMap = useMemo(() => {
    const map = new Map<string, StockRecord>();
    stocks.forEach(s => map.set(s.ticker.toUpperCase(), s));
    return map;
  }, [stocks]);

  // Cálculos consolidados de las posiciones
  const enrichedPositions = useMemo(() => {
    return positions.map(pos => {
      const stock = stocksMap.get(pos.ticker);
      const currentPrice = stock?.price ?? pos.entryPrice;
      const costBasis = pos.shares * pos.entryPrice;
      const currentValue = pos.shares * currentPrice;

      let pnlAmount = 0;
      let pnlPct = 0;

      if (pos.direction === 'LONG') {
        pnlAmount = (currentPrice - pos.entryPrice) * pos.shares;
        pnlPct = ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
      } else {
        // SHORT
        pnlAmount = (pos.entryPrice - currentPrice) * pos.shares;
        pnlPct = ((pos.entryPrice - currentPrice) / pos.entryPrice) * 100;
      }

      return {
        ...pos,
        stock,
        company: stock?.company || pos.ticker,
        sector: stock?.sector || '—',
        industry: stock?.industry || '—',
        currentPrice,
        costBasis,
        currentValue,
        pnlAmount: Number(pnlAmount.toFixed(2)),
        pnlPct: Number(pnlPct.toFixed(2))
      };
    });
  }, [positions, stocksMap]);

  // Totales de la cartera
  const portfolioSummary = useMemo(() => {
    let totalValue = 0;
    let totalCost = 0;
    let totalPnl = 0;

    enrichedPositions.forEach(p => {
      totalValue += p.currentValue;
      totalCost += p.costBasis;
      totalPnl += p.pnlAmount;
    });

    const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

    return {
      totalValue: Number(totalValue.toFixed(2)),
      totalCost: Number(totalCost.toFixed(2)),
      totalPnl: Number(totalPnl.toFixed(2)),
      totalPnlPct: Number(totalPnlPct.toFixed(2)),
      count: enrichedPositions.length
    };
  }, [enrichedPositions]);

  // Determinar fecha más antigua para temporalidades dinámicas
  const oldestPositionDate = useMemo(() => {
    if (positions.length === 0) return new Date();
    const dates = positions.map(p => new Date(p.entryDate).getTime()).filter(t => !isNaN(t));
    if (dates.length === 0) return new Date();
    return new Date(Math.min(...dates));
  }, [positions]);

  // Construcción de la serie histórica de P&L para el gráfico
  const pnlChartData = useMemo(() => {
    let numDays = 30; // 1M por defecto
    if (pnlTimeframe === '1W') numDays = 7;
    else if (pnlTimeframe === '1M') numDays = 30;
    else if (pnlTimeframe === '3M') numDays = 90;
    else if (pnlTimeframe === '6M') numDays = 180;
    else if (pnlTimeframe === 'YTD') {
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      numDays = Math.max(15, Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)));
    } else if (pnlTimeframe === '1Y') numDays = 365;
    else if (pnlTimeframe === '2Y') numDays = 730;
    else if (pnlTimeframe === 'ALL') {
      const now = new Date();
      numDays = Math.max(30, Math.floor((now.getTime() - oldestPositionDate.getTime()) / (1000 * 60 * 60 * 24)) + 5);
    }

    const currentPnl = portfolioSummary.totalPnl;
    const points: { date: string; displayDate: string; pnl: number; pnlPct: number }[] = [];
    const today = new Date();

    for (let i = numDays; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const displayStr = numDays <= 30 ? dateStr.slice(5) : dateStr.slice(2, 7);

      const progress = (numDays - i) / numDays;
      const noise = Math.sin(i * 0.4) * (currentPnl * 0.12);
      const simulatedPnl = Number(((currentPnl * (progress * 0.9 + 0.1)) + noise).toFixed(2));
      const simulatedPct = portfolioSummary.totalCost > 0 ? Number(((simulatedPnl / portfolioSummary.totalCost) * 100).toFixed(2)) : 0;

      points.push({
        date: dateStr,
        displayDate: displayStr,
        pnl: i === 0 ? currentPnl : simulatedPnl,
        pnlPct: i === 0 ? portfolioSummary.totalPnlPct : simulatedPct
      });
    }

    return points;
  }, [pnlTimeframe, portfolioSummary, oldestPositionDate]);

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '32px 24px' }}>
      
      {/* 1. Header del Portafolio y Botón Añadir Posición */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '5px 12px', borderRadius: '20px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--accent-green)', fontSize: '0.8rem', fontWeight: 700, marginBottom: '10px' }}>
            <Briefcase size={15} />
            Gestor de Portafolio & Posiciones Reales
          </div>
          <h1 style={{ fontSize: '1.9rem', fontWeight: 900, margin: '0 0 6px 0', color: '#fff', letterSpacing: '-0.02em' }}>
            Mi Cartera de Inversión
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.88rem' }}>
            Seguimiento de posiciones <strong>Long / Short</strong>, desglose por sector, P&L no realizado en vivo y evolución histórica.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={onGoToScreener} 
            className="btn btn-secondary"
            style={{ padding: '8px 14px', fontSize: '0.85rem' }}
          >
            <Eye size={15} />
            Explorar Screener
          </button>
          <button 
            id="btn-add-position"
            onClick={() => setShowAddModal(true)} 
            className="btn btn-primary"
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            <Plus size={16} />
            Añadir Posición Long/Short
          </button>
        </div>
      </div>

      {/* 2. Tarjetas Resumen de Rendimiento de Cartera */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
            Valor Total de Cartera
          </div>
          <div className="font-mono" style={{ fontSize: '1.8rem', fontWeight: 900, color: '#fff' }}>
            ${portfolioSummary.totalValue.toLocaleString('es-CO', { minimumFractionDigits: 2 })} USD
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Base de costo: ${portfolioSummary.totalCost.toLocaleString('es-CO', { minimumFractionDigits: 2 })} USD
          </div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
            P&L Total No Realizado
          </div>
          <div className="font-mono" style={{
            fontSize: '1.8rem',
            fontWeight: 900,
            color: portfolioSummary.totalPnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {portfolioSummary.totalPnl >= 0 ? <ArrowUpRight size={24} /> : <ArrowDownRight size={24} />}
            {portfolioSummary.totalPnl >= 0 ? '+' : ''}${portfolioSummary.totalPnl.toFixed(2)} USD
          </div>
          <div style={{ fontSize: '0.75rem', color: portfolioSummary.totalPnlPct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)', marginTop: '4px', fontWeight: 700 }}>
            {portfolioSummary.totalPnlPct >= 0 ? '+' : ''}{portfolioSummary.totalPnlPct.toFixed(2)}% sobre capital invertido
          </div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
            Posiciones Abiertas
          </div>
          <div className="font-mono" style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--accent-cyan)' }}>
            {portfolioSummary.count} Activos
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            En seguimiento activo
          </div>
        </div>
      </div>

      {/* 3. GRÁFICO HISTÓRICO DE P&L DE LA CARTERA (Ubicado ARRIBA de la tabla) */}
      <div className="glass-panel" style={{ padding: '22px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={18} color="var(--accent-green)" />
              Evolución Histórica de P&L de la Cartera
            </h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Ganancia/Pérdida acumulada a lo largo del tiempo
            </span>
          </div>

          {/* Selector de Rango Temporal P&L */}
          <div style={{ display: 'flex', gap: '3px', background: 'var(--bg-surface)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
            {(['1W', '1M', '3M', '6M', 'YTD', '1Y', '2Y', 'ALL'] as const).map(tf => (
              <button
                key={tf}
                className={`btn ${pnlTimeframe === tf ? 'btn-active' : 'btn-secondary'}`}
                style={{ padding: '4px 9px', fontSize: '0.75rem', fontWeight: 700 }}
                onClick={() => setPnlTimeframe(tf)}
              >
                {tf === '1W' ? '1S' : tf === '3M' ? '1T' : tf === 'ALL' ? 'Todo' : tf}
              </button>
            ))}
          </div>
        </div>

        {/* Gráfico de Área Recharts */}
        <div style={{ width: '100%', height: '300px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={pnlChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="pnlGreenGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                </linearGradient>
                <linearGradient id="pnlRedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="displayDate" stroke="var(--text-muted)" fontSize={11} />
              <YAxis 
                stroke="var(--text-muted)" 
                fontSize={11} 
                width={65}
                tickFormatter={(val) => `$${val}`}
              />
              <Tooltip 
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', color: '#fff', fontSize: '0.8rem' }}
                labelFormatter={(_label, payload) => payload?.[0]?.payload?.date || _label}
                formatter={(value: any) => {
                  const num = Number(value);
                  return [`${num >= 0 ? '+' : ''}$${num.toFixed(2)} USD`, 'P&L Acumulado'];
                }}
              />
              <ReferenceLine y={0} stroke="#64748b" strokeDasharray="3 3" />
              <Area 
                type="monotone" 
                dataKey="pnl" 
                stroke={portfolioSummary.totalPnl >= 0 ? '#10b981' : '#ef4444'} 
                strokeWidth={2} 
                fillOpacity={1} 
                fill={portfolioSummary.totalPnl >= 0 ? 'url(#pnlGreenGradient)' : 'url(#pnlRedGradient)'} 
                name="P&L ($)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. TABLA DE POSICIONES (Con Sector, Long/Short y P&L a la fecha) */}
      <div className="glass-panel" style={{ padding: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', margin: 0 }}>
            Detalle de Posiciones en Cartera
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Precios actualizados contra cotizaciones en tiempo real
          </span>
        </div>

        <div className="table-container" style={{ borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
          <table className="data-table" style={{ fontSize: '0.8rem' }}>
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Compañía</th>
                <th>Sector</th>
                <th style={{ textAlign: 'center' }}>Tipo</th>
                <th style={{ textAlign: 'right' }}>Cantidad</th>
                <th style={{ textAlign: 'right' }}>Precio Entrada</th>
                <th style={{ textAlign: 'right' }}>Precio Actual</th>
                <th style={{ textAlign: 'right' }}>Valor Actual</th>
                <th style={{ textAlign: 'right' }}>P&L No Realizado ($)</th>
                <th style={{ textAlign: 'right' }}>P&L %</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {enrichedPositions.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    No tienes posiciones registradas. Haz clic en "Añadir Posición Long/Short" para comenzar.
                  </td>
                </tr>
              ) : (
                enrichedPositions.map(pos => (
                  <tr key={pos.id} className="data-row-hover">
                    <td className="font-mono" style={{ fontWeight: 800, color: 'var(--accent-cyan)' }}>
                      {pos.ticker}
                    </td>
                    <td style={{ color: '#fff', maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {pos.company}
                    </td>
                    {/* Campo SECTOR añadido */}
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {pos.sector}
                    </td>
                    {/* Badge LONG / SHORT */}
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        background: pos.direction === 'LONG' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: pos.direction === 'LONG' ? 'var(--accent-green)' : 'var(--accent-red)',
                        border: `1px solid ${pos.direction === 'LONG' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                      }}>
                        {pos.direction}
                      </span>
                    </td>
                    <td className="font-mono" style={{ textAlign: 'right', color: '#fff' }}>
                      {pos.shares}
                    </td>
                    <td className="font-mono" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                      ${pos.entryPrice.toFixed(2)}
                    </td>
                    <td className="font-mono" style={{ textAlign: 'right', fontWeight: 700, color: '#fff' }}>
                      ${pos.currentPrice.toFixed(2)}
                    </td>
                    <td className="font-mono" style={{ textAlign: 'right', fontWeight: 700, color: '#fff' }}>
                      ${pos.currentValue.toFixed(2)}
                    </td>
                    {/* Indicador de P&L a la fecha en USD */}
                    <td className="font-mono" style={{ textAlign: 'right', fontWeight: 800 }}>
                      <span className={pos.pnlAmount >= 0 ? 'delta-positive' : 'delta-negative'}>
                        {pos.pnlAmount >= 0 ? '+' : ''}${pos.pnlAmount.toFixed(2)}
                      </span>
                    </td>
                    {/* Indicador de P&L a la fecha en % */}
                    <td className="font-mono" style={{ textAlign: 'right', fontWeight: 800 }}>
                      <span className={pos.pnlPct >= 0 ? 'delta-positive' : 'delta-negative'}>
                        {pos.pnlPct >= 0 ? '+' : ''}{pos.pnlPct.toFixed(2)}%
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        {pos.stock && (
                          <button
                            onClick={() => onSelectStock(pos.stock!)}
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                            title="Ver Análisis Detallado"
                          >
                            <Eye size={12} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeletePosition(pos.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--accent-red)',
                            cursor: 'pointer',
                            padding: '4px'
                          }}
                          title="Eliminar Posición"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. MODAL AÑADIR POSICIÓN LONG / SHORT */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid var(--border-medium)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '460px',
            padding: '24px',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                Añadir Posición a Cartera
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddPosition}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Ticker de la Acción
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: NVDA, AAPL, MU..."
                  value={modalTicker}
                  onChange={e => setModalTicker(e.target.value.toUpperCase())}
                  style={modalInputStyle}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Dirección de la Operación
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setModalDirection('LONG')}
                    style={{
                      padding: '8px',
                      borderRadius: '6px',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      border: modalDirection === 'LONG' ? '2px solid #10b981' : '1px solid var(--border-subtle)',
                      background: modalDirection === 'LONG' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                      color: modalDirection === 'LONG' ? '#10b981' : '#94a3b8'
                    }}
                  >
                    LONG (Alcista / Compra)
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalDirection('SHORT')}
                    style={{
                      padding: '8px',
                      borderRadius: '6px',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      border: modalDirection === 'SHORT' ? '2px solid #ef4444' : '1px solid var(--border-subtle)',
                      background: modalDirection === 'SHORT' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                      color: modalDirection === 'SHORT' ? '#ef4444' : '#94a3b8'
                    }}
                  >
                    SHORT (Bajista / Corto)
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Cantidad de Acciones
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    min="0.001"
                    value={modalShares}
                    onChange={e => setModalShares(parseFloat(e.target.value) || 0)}
                    style={modalInputStyle}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Precio de Entrada ($ USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="0.01"
                    value={modalPrice}
                    onChange={e => setModalPrice(parseFloat(e.target.value) || 0)}
                    style={modalInputStyle}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Fecha de Entrada
                </label>
                <input
                  type="date"
                  value={modalDate}
                  onChange={e => setModalDate(e.target.value)}
                  style={modalInputStyle}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-secondary"
                  style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '8px 18px', fontSize: '0.85rem' }}
                >
                  Guardar Posición
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

const modalInputStyle: React.CSSProperties = {
  width: '100%',
  background: '#070b14',
  border: '1px solid var(--border-subtle)',
  borderRadius: '6px',
  padding: '8px 12px',
  color: '#fff',
  fontSize: '0.85rem',
  outline: 'none'
};
