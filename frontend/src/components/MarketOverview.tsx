import React from 'react';
import { 
  Sparkles, 
  TrendingUp, 
  ShieldCheck, 
  Zap, 
  Layers, 
  ChevronRight, 
  DollarSign
} from 'lucide-react';
import type { StockRecord } from '../types/stock';
import { calculateFactorGrades } from '../utils/quantRatings';

interface MarketOverviewProps {
  stocks: StockRecord[];
  onSelectStock: (stock: StockRecord) => void;
  onGoToScreener: () => void;
  snapshotDate: string | null;
}

export const MarketOverview: React.FC<MarketOverviewProps> = ({
  stocks,
  onSelectStock,
  onGoToScreener,
  snapshotDate
}) => {
  // 1. Top Value (Menor PEG > 0)
  const topValue = [...stocks]
    .filter(s => s.peg !== undefined && s.peg !== null && s.peg > 0 && s.pe !== undefined && s.pe > 0)
    .sort((a, b) => (a.peg || 999) - (b.peg || 999))
    .slice(0, 4);

  // 2. Líderes de Rentabilidad (Mayor ROIC)
  const topRoic = [...stocks]
    .filter(s => s.roic !== undefined && s.roic !== null)
    .sort((a, b) => (b.roic || 0) - (a.roic || 0))
    .slice(0, 4);

  // 3. Rebote Técnico (RSI entre 40 y 55 con SMA200 > 0)
  const technicalPicks = [...stocks]
    .filter(s => s.rsi && s.rsi >= 40 && s.rsi <= 55 && s.sma200 !== undefined && s.sma200 > 0)
    .sort((a, b) => (b.change_pct || 0) - (a.change_pct || 0))
    .slice(0, 4);

  // 4. Crecimiento Explosivo (Mayor EPS QoQ)
  const topGrowth = [...stocks]
    .filter(s => s.eps_qq !== undefined && s.eps_qq !== null && s.eps_qq > 0)
    .sort((a, b) => (b.eps_qq || 0) - (a.eps_qq || 0))
    .slice(0, 4);

  // Sectores y métricas promedio
  const sectorMap: { [key: string]: { count: number; totalReturn: number } } = {};
  stocks.forEach(s => {
    const sec = s.sector || 'Otros';
    if (!sectorMap[sec]) sectorMap[sec] = { count: 0, totalReturn: 0 };
    sectorMap[sec].count += 1;
    sectorMap[sec].totalReturn += (s.change_pct || 0);
  });

  const sectors = Object.keys(sectorMap).map(sec => ({
    name: sec,
    count: sectorMap[sec].count,
    avgChange: sectorMap[sec].count > 0 ? sectorMap[sec].totalReturn / sectorMap[sec].count : 0
  })).sort((a, b) => b.count - a.count);

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '28px 24px' }} className="animate-fade-in">
      {/* Banner Principal de Bienvenida */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(18, 24, 38, 0.85), rgba(13, 18, 29, 0.95))',
        border: '1px solid var(--border-medium)',
        borderRadius: '16px',
        padding: '28px 32px',
        marginBottom: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-lg)'
      }}>
        <div style={{
          position: 'absolute',
          top: '-50px',
          right: '-50px',
          width: '220px',
          height: '220px',
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'var(--accent-green-bg)',
              color: 'var(--accent-green)',
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: 700,
              border: '1px solid var(--accent-green-border)'
            }}>
              <Sparkles size={13} />
              UNIVERSO BURSÁTIL ACTIVO
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Snapshot: <strong style={{ color: '#fff' }}>{snapshotDate || 'Hoy'}</strong>
            </span>
          </div>

          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', marginBottom: '8px' }}>
            Monitor Cuantitativo & Factor Grades
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', maxWidth: '680px' }}>
            Análisis algorítmico de <strong>{stocks.length} acciones seleccionadas</strong> en Wall Street con fundamentos sólidos, 
            calificaciones de valor y rentabilidad estilo Seeking Alpha y seguimiento continuo de 30 días.
          </p>
        </div>

        <button 
          id="btn-explore-screener"
          className="btn btn-primary"
          style={{ padding: '12px 22px', fontSize: '0.95rem' }}
          onClick={onGoToScreener}
        >
          <Layers size={18} />
          Explorar Screener Completo
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Grid de 4 Pilares de Oportunidad */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '20px',
        marginBottom: '32px'
      }}>
        {/* Pilar 1: Top Valor (Menor PEG) */}
        <div className="glass-panel" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--accent-green)',
                padding: '8px',
                borderRadius: '8px'
              }}>
                <DollarSign size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>Top Valor (Menor PEG)</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Crecimiento a precio de ganga</span>
              </div>
            </div>
            <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--accent-green)', fontWeight: 700 }}>PEG &lt; 0.50</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {topValue.map(s => {
              const analysis = calculateFactorGrades(s);
              return (
                <div 
                  key={s.ticker}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                  onClick={() => onSelectStock(s)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className={`grade-badge grade-badge-sm grade-${analysis.grades.valuation.grade.charAt(0)}`}>
                      {analysis.grades.valuation.grade}
                    </div>
                    <div>
                      <div className="font-mono" style={{ fontWeight: 700, color: '#fff' }}>{s.ticker}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.company.slice(0, 18)}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="font-mono" style={{ fontWeight: 700, color: 'var(--accent-green)' }}>
                      PEG {s.peg?.toFixed(2)}
                    </div>
                    <div className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      P/E {s.pe?.toFixed(1)} · ${s.price?.toFixed(2)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pilar 2: Campeones de ROIC (Calidad y Eficiencia) */}
        <div className="glass-panel" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                background: 'rgba(6, 182, 212, 0.15)',
                color: 'var(--accent-cyan)',
                padding: '8px',
                borderRadius: '8px'
              }}>
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>Líderes de ROIC</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Retorno sobre capital invertido</span>
              </div>
            </div>
            <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', fontWeight: 700 }}>ROIC &gt; 25%</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {topRoic.map(s => {
              const analysis = calculateFactorGrades(s);
              return (
                <div 
                  key={s.ticker}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                  onClick={() => onSelectStock(s)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className={`grade-badge grade-badge-sm grade-${analysis.grades.profitability.grade.charAt(0)}`}>
                      {analysis.grades.profitability.grade}
                    </div>
                    <div>
                      <div className="font-mono" style={{ fontWeight: 700, color: '#fff' }}>{s.ticker}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.company.slice(0, 18)}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="font-mono" style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>
                      ROIC {s.roic?.toFixed(1)}%
                    </div>
                    <div className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Margen {s.profit_m?.toFixed(1)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pilar 3: Rebote Técnico & Tendencia (RSI 40-55 + SMA200) */}
        <div className="glass-panel" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                background: 'rgba(245, 158, 11, 0.15)',
                color: 'var(--accent-amber)',
                padding: '8px',
                borderRadius: '8px'
              }}>
                <Zap size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>Zona de Rebote RSI</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>RSI 40-55 con soporte SMA200</span>
              </div>
            </div>
            <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--accent-amber)', fontWeight: 700 }}>Setup Técnico</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {technicalPicks.map(s => {
              const analysis = calculateFactorGrades(s);
              return (
                <div 
                  key={s.ticker}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                  onClick={() => onSelectStock(s)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className={`grade-badge grade-badge-sm grade-${analysis.grades.momentum.grade.charAt(0)}`}>
                      {analysis.grades.momentum.grade}
                    </div>
                    <div>
                      <div className="font-mono" style={{ fontWeight: 700, color: '#fff' }}>{s.ticker}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.company.slice(0, 18)}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="font-mono" style={{ fontWeight: 700, color: 'var(--accent-amber)' }}>
                      RSI {s.rsi?.toFixed(1)}
                    </div>
                    <div className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      SMA200 +{s.sma200?.toFixed(1)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pilar 4: Crecimiento Acelerado (EPS QoQ) */}
        <div className="glass-panel" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                background: 'rgba(99, 102, 241, 0.15)',
                color: 'var(--accent-indigo)',
                padding: '8px',
                borderRadius: '8px'
              }}>
                <TrendingUp size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>Crecimiento BPA (QoQ)</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sorpresa de utilidades trimestral</span>
              </div>
            </div>
            <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--accent-indigo)', fontWeight: 700 }}>EPS &gt; 25%</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {topGrowth.map(s => {
              const analysis = calculateFactorGrades(s);
              return (
                <div 
                  key={s.ticker}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                  onClick={() => onSelectStock(s)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className={`grade-badge grade-badge-sm grade-${analysis.grades.growth.grade.charAt(0)}`}>
                      {analysis.grades.growth.grade}
                    </div>
                    <div>
                      <div className="font-mono" style={{ fontWeight: 700, color: '#fff' }}>{s.ticker}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.company.slice(0, 18)}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="font-mono" style={{ fontWeight: 700, color: 'var(--accent-indigo)' }}>
                      +{s.eps_qq?.toFixed(0)}%
                    </div>
                    <div className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Ventas YoY +{s.sales_yoy_ttm?.toFixed(1)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Distribución Sectorial */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '16px' }}>
          Distribución Sectorial del Universo Filtrado
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          {sectors.map(sec => (
            <div 
              key={sec.name}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                padding: '12px 18px',
                minWidth: '180px',
                flex: '1 1 200px'
              }}
            >
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                {sec.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {sec.count} {sec.count === 1 ? 'acción' : 'acciones'}
                </span>
                <span className={`font-mono ${sec.avgChange >= 0 ? 'delta-positive' : 'delta-negative'}`} style={{ fontSize: '0.85rem' }}>
                  {sec.avgChange >= 0 ? '+' : ''}{sec.avgChange.toFixed(2)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
