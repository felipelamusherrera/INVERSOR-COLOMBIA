import React, { useState, useMemo } from 'react';
import { 
  Grid, 
  Search
} from 'lucide-react';
import type { StockRecord } from '../types/stock';

interface FinvizMapProps {
  stocks: StockRecord[];
  onSelectStock: (stock: StockRecord) => void;
}

type DataType = 'perf_day' | 'perf_week' | 'perf_month' | 'perf_ytd' | 'pe' | 'rsi';

// Helper para normalizar Market Cap a millones de USD ($M)
// En la base de datos Supabase, market_cap viene en dólares absolutos (ej. 2,000,000,000 para $2B).
// Si supera 1,000,000, se divide por 1e6 para llevarlo a millones.
const getCapInMillions = (cap?: number): number => {
  if (!cap || cap <= 0) return 0;
  if (cap > 1000000) return cap / 1000000;
  return cap;
};

// Clasificador oficial de tiers de capitalización según Finviz:
// Large / Mega: >= $10B (>= $10,000M)
// Mid: $2B a $10B ($2,000M a $10,000M)
// Small: $300M a $2B ($300M a $2,000M)
// Micro: $50M a $300M ($50M a $300M)
// Nano: < $50M (< $50M)
const getTier = (cap?: number): 'megaLarge' | 'mid' | 'small' | 'micro' | 'nano' => {
  const capM = getCapInMillions(cap);
  if (capM >= 10000) return 'megaLarge';
  if (capM >= 2000) return 'mid';
  if (capM >= 300) return 'small';
  if (capM >= 50) return 'micro';
  return 'nano';
};

export const FinvizMap: React.FC<FinvizMapProps> = ({ stocks, onSelectStock }) => {
  const [dataType, setDataType] = useState<DataType>('perf_day');
  const [selectedSector, setSelectedSector] = useState<string>('All');
  const [selectedIndustry, setSelectedIndustry] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Tiers de Capitalización
  const [tierMegaLarge, setTierMegaLarge] = useState(true);
  const [tierMid, setTierMid] = useState(true);
  const [tierSmall, setTierSmall] = useState(true);
  const [tierMicro, setTierMicro] = useState(true);
  const [tierNano, setTierNano] = useState(true);

  // Sectores e industrias
  const sectors = useMemo(() => {
    const s = new Set<string>();
    stocks.forEach(st => { if (st.sector) s.add(st.sector); });
    return Array.from(s).sort();
  }, [stocks]);

  const industries = useMemo(() => {
    const s = new Set<string>();
    stocks.forEach(st => { 
      if (st.industry && (selectedSector === 'All' || st.sector === selectedSector)) {
        s.add(st.industry); 
      }
    });
    return Array.from(s).sort();
  }, [stocks, selectedSector]);

  // Contadores por tier
  const tierCounts = useMemo(() => {
    let megaLarge = 0, mid = 0, small = 0, micro = 0, nano = 0;
    stocks.forEach(st => {
      const tier = getTier(st.market_cap);
      if (tier === 'megaLarge') megaLarge++;
      else if (tier === 'mid') mid++;
      else if (tier === 'small') small++;
      else if (tier === 'micro') micro++;
      else nano++;
    });
    return { megaLarge, mid, small, micro, nano };
  }, [stocks]);

  // Clasificar acciones en matriz: [Sector -> Industry -> Tier -> StockRecord[]]
  const matrixData = useMemo(() => {
    // 1. Filtrar acciones
    const filtered = stocks.filter(st => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches = st.ticker.toLowerCase().includes(q) || (st.company && st.company.toLowerCase().includes(q));
        if (!matches) return false;
      }
      if (selectedSector !== 'All' && st.sector !== selectedSector) return false;
      if (selectedIndustry !== 'All' && st.industry !== selectedIndustry) return false;

      const tier = getTier(st.market_cap);
      if (!tierMegaLarge && tier === 'megaLarge') return false;
      if (!tierMid && tier === 'mid') return false;
      if (!tierSmall && tier === 'small') return false;
      if (!tierMicro && tier === 'micro') return false;
      if (!tierNano && tier === 'nano') return false;

      return true;
    });

    // 2. Agrupar por Industria
    const indMap = new Map<string, { sector: string; industry: string; megaLarge: StockRecord[]; mid: StockRecord[]; small: StockRecord[]; micro: StockRecord[]; nano: StockRecord[] }>();

    filtered.forEach(st => {
      const ind = st.industry || 'Otras Industrias';
      const sec = st.sector || 'Otros';

      if (!indMap.has(ind)) {
        indMap.set(ind, {
          sector: sec,
          industry: ind,
          megaLarge: [],
          mid: [],
          small: [],
          micro: [],
          nano: []
        });
      }

      const row = indMap.get(ind)!;
      const tier = getTier(st.market_cap);
      if (tier === 'megaLarge') row.megaLarge.push(st);
      else if (tier === 'mid') row.mid.push(st);
      else if (tier === 'small') row.small.push(st);
      else if (tier === 'micro') row.micro.push(st);
      else row.nano.push(st);
    });

    // Ordenar industrias por total de acciones descendente
    return Array.from(indMap.values()).sort((a, b) => {
      const totalA = a.megaLarge.length + a.mid.length + a.small.length + a.micro.length + a.nano.length;
      const totalB = b.megaLarge.length + b.mid.length + b.small.length + b.micro.length + b.nano.length;
      return totalB - totalA;
    });
  }, [stocks, searchQuery, selectedSector, selectedIndustry, tierMegaLarge, tierMid, tierSmall, tierMicro, tierNano]);

  // Color de celda según el tipo de dato
  const getCellColor = (st: StockRecord) => {
    if (dataType === 'perf_day') {
      const val = st.change_pct;
      return getPerformanceColor(val);
    }
    if (dataType === 'perf_week') {
      const val = st.perf_week;
      return getPerformanceColor(val);
    }
    if (dataType === 'perf_month') {
      const val = st.perf_month;
      return getPerformanceColor(val);
    }
    if (dataType === 'perf_ytd') {
      const val = st.perf_ytd;
      return getPerformanceColor(val);
    }
    if (dataType === 'pe') {
      const pe = st.pe;
      if (!pe || pe <= 0) return '#334155';
      if (pe < 15) return '#15803d';
      if (pe < 25) return '#166534';
      if (pe < 35) return '#854d0e';
      return '#991b1b';
    }
    if (dataType === 'rsi') {
      const rsi = st.rsi;
      if (!rsi) return '#334155';
      if (rsi < 30) return '#15803d'; // Oversold
      if (rsi > 70) return '#991b1b'; // Overbought
      return '#1e293b';
    }
    return '#1e293b';
  };

  const getMetricLabel = (st: StockRecord) => {
    if (dataType === 'perf_day') return st.change_pct !== undefined ? `${st.change_pct >= 0 ? '+' : ''}${st.change_pct.toFixed(1)}%` : '';
    if (dataType === 'perf_week') return st.perf_week !== undefined ? `${st.perf_week >= 0 ? '+' : ''}${st.perf_week.toFixed(1)}%` : '';
    if (dataType === 'perf_month') return st.perf_month !== undefined ? `${st.perf_month >= 0 ? '+' : ''}${st.perf_month.toFixed(1)}%` : '';
    if (dataType === 'perf_ytd') return st.perf_ytd !== undefined ? `${st.perf_ytd >= 0 ? '+' : ''}${st.perf_ytd.toFixed(1)}%` : '';
    if (dataType === 'pe') return st.pe ? `${st.pe.toFixed(0)}x` : '—';
    if (dataType === 'rsi') return st.rsi ? `${st.rsi.toFixed(0)}` : '—';
    return '';
  };

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '24px' }}>
      
      {/* Cabecera Principal */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Grid size={22} color="var(--accent-cyan)" />
            Finviz Maps — Matriz Sectorial & Heatmap
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Acciones de la bolsa de EE.UU. categorizadas por sectores e industrias. Columnas divididas por tiers de capitalización.
          </p>
        </div>

        {/* Barra de Leyenda Térmica */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(15, 23, 42, 0.8)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginRight: '6px', fontWeight: 600 }}>Rango:</span>
          <span style={{ background: '#b91c1c', color: '#fff', padding: '2px 6px', borderRadius: '3px', fontSize: '0.7rem', fontWeight: 700 }}>-3%</span>
          <span style={{ background: '#dc2626', color: '#fff', padding: '2px 6px', borderRadius: '3px', fontSize: '0.7rem', fontWeight: 700 }}>-2%</span>
          <span style={{ background: '#ef4444', color: '#fff', padding: '2px 6px', borderRadius: '3px', fontSize: '0.7rem', fontWeight: 700 }}>-1%</span>
          <span style={{ background: '#334155', color: '#fff', padding: '2px 6px', borderRadius: '3px', fontSize: '0.7rem', fontWeight: 700 }}>0%</span>
          <span style={{ background: '#22c55e', color: '#fff', padding: '2px 6px', borderRadius: '3px', fontSize: '0.7rem', fontWeight: 700 }}>+1%</span>
          <span style={{ background: '#16a34a', color: '#fff', padding: '2px 6px', borderRadius: '3px', fontSize: '0.7rem', fontWeight: 700 }}>+2%</span>
          <span style={{ background: '#15803d', color: '#fff', padding: '2px 6px', borderRadius: '3px', fontSize: '0.7rem', fontWeight: 700 }}>+3%</span>
        </div>
      </div>

      {/* Disposición Principal: Barra Lateral Izquierda + Matriz Derecha */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '20px', alignItems: 'start' }}>
        
        {/* BARRA LATERAL DE CONTROL (Estilo Finviz Maps) */}
        <div className="glass-panel" style={{ padding: '16px', position: 'sticky', top: '90px' }}>
          
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-cyan)', textTransform: 'uppercase', marginBottom: '6px' }}>
              Data Type
            </label>
            <select 
              value={dataType} 
              onChange={(e) => setDataType(e.target.value as DataType)}
              style={sideSelectStyle}
            >
              <option value="perf_day">1-Day Performance</option>
              <option value="perf_week">1-Week Performance</option>
              <option value="perf_month">1-Month Performance</option>
              <option value="perf_ytd">YTD Performance</option>
              <option value="pe">P/E Ratio</option>
              <option value="rsi">RSI (14)</option>
            </select>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
              Sector
            </label>
            <select 
              value={selectedSector} 
              onChange={(e) => {
                setSelectedSector(e.target.value);
                setSelectedIndustry('All');
              }}
              style={sideSelectStyle}
            >
              <option value="All">Any Sector ({sectors.length})</option>
              {sectors.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
              Industry
            </label>
            <select 
              value={selectedIndustry} 
              onChange={(e) => setSelectedIndustry(e.target.value)}
              style={sideSelectStyle}
            >
              <option value="All">Any Industry ({industries.length})</option>
              {industries.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>

          {/* CHECKBOXES DE MARKET CAP TIERS */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
              Market Cap Tiers
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.78rem' }}>
              <label style={checkboxLabelStyle}>
                <input type="checkbox" checked={tierMegaLarge} onChange={e => setTierMegaLarge(e.target.checked)} />
                <span>Large / Mega ($10B+)</span>
                <span style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>{tierCounts.megaLarge}</span>
              </label>

              <label style={checkboxLabelStyle}>
                <input type="checkbox" checked={tierMid} onChange={e => setTierMid(e.target.checked)} />
                <span>Mid ($2B - $10B)</span>
                <span style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>{tierCounts.mid}</span>
              </label>

              <label style={checkboxLabelStyle}>
                <input type="checkbox" checked={tierSmall} onChange={e => setTierSmall(e.target.checked)} />
                <span>Small ($300M - $2B)</span>
                <span style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>{tierCounts.small}</span>
              </label>

              <label style={checkboxLabelStyle}>
                <input type="checkbox" checked={tierMicro} onChange={e => setTierMicro(e.target.checked)} />
                <span>Micro ($50M - $300M)</span>
                <span style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>{tierCounts.micro}</span>
              </label>

              <label style={checkboxLabelStyle}>
                <input type="checkbox" checked={tierNano} onChange={e => setTierNano(e.target.checked)} />
                <span>Nano (&lt; $50M)</span>
                <span style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>{tierCounts.nano}</span>
              </label>
            </div>
          </div>

          {/* BUSCADOR DE TICKER */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
              Filtrar Ticker
            </label>
            <div style={{ position: 'relative' }}>
              <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '10px' }} />
              <input
                type="text"
                placeholder="Buscar ticker..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  background: '#070b14',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  padding: '7px 10px 7px 30px',
                  color: '#fff',
                  fontSize: '0.8rem'
                }}
              />
            </div>
          </div>

        </div>

        {/* ÁREA DE LA MATRIZ MAPS */}
        <div style={{ overflowX: 'auto' }}>
          <div style={{
            minWidth: '950px',
            background: 'rgba(15, 23, 42, 0.45)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            overflow: 'hidden'
          }}>
            
            {/* Cabecera de Columnas Tiers */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '220px 1fr 1fr 1fr 1fr 1fr',
              background: 'rgba(15, 23, 42, 0.95)',
              borderBottom: '2px solid var(--border-medium)',
              padding: '12px 16px',
              fontSize: '0.78rem',
              fontWeight: 800,
              color: 'var(--text-secondary)'
            }}>
              <div>INDUSTRY / SECTOR</div>
              <div style={{ textAlign: 'center' }}>Large / Mega ({tierCounts.megaLarge})</div>
              <div style={{ textAlign: 'center' }}>Mid ({tierCounts.mid})</div>
              <div style={{ textAlign: 'center' }}>Small ({tierCounts.small})</div>
              <div style={{ textAlign: 'center' }}>Micro ({tierCounts.micro})</div>
              <div style={{ textAlign: 'center' }}>Nano ({tierCounts.nano})</div>
            </div>

            {/* Filas de la Matriz */}
            {matrixData.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No hay acciones que coincidan con los filtros de sectores o tiers seleccionados.
              </div>
            ) : (
              matrixData.map(row => {
                const total = row.megaLarge.length + row.mid.length + row.small.length + row.micro.length + row.nano.length;
                if (total === 0) return null;

                return (
                  <div
                    key={row.industry}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '220px 1fr 1fr 1fr 1fr 1fr',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                      minHeight: '75px',
                      alignItems: 'stretch'
                    }}
                  >
                    {/* Etiqueta de Industria */}
                    <div style={{
                      padding: '12px 14px',
                      background: 'rgba(30, 41, 59, 0.35)',
                      borderRight: '1px solid rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center'
                    }}>
                      <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#fff', lineHeight: 1.3 }}>
                        {row.industry}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', marginTop: '4px' }}>
                        {row.sector} · {total}
                      </div>
                    </div>

                    {/* Celdas por Tier */}
                    <StockCell stocks={row.megaLarge} getCellColor={getCellColor} getMetricLabel={getMetricLabel} onSelectStock={onSelectStock} />
                    <StockCell stocks={row.mid} getCellColor={getCellColor} getMetricLabel={getMetricLabel} onSelectStock={onSelectStock} />
                    <StockCell stocks={row.small} getCellColor={getCellColor} getMetricLabel={getMetricLabel} onSelectStock={onSelectStock} />
                    <StockCell stocks={row.micro} getCellColor={getCellColor} getMetricLabel={getMetricLabel} onSelectStock={onSelectStock} />
                    <StockCell stocks={row.nano} getCellColor={getCellColor} getMetricLabel={getMetricLabel} onSelectStock={onSelectStock} />
                  </div>
                );
              })
            )}

          </div>
        </div>

      </div>

    </div>
  );
};

// Subcomponente de celda con mosaico de tickers
interface StockCellProps {
  stocks: StockRecord[];
  getCellColor: (st: StockRecord) => string;
  getMetricLabel: (st: StockRecord) => string;
  onSelectStock: (st: StockRecord) => void;
}

const StockCell: React.FC<StockCellProps> = ({ stocks, getCellColor, getMetricLabel, onSelectStock }) => {
  return (
    <div style={{
      padding: '6px',
      borderRight: '1px solid rgba(255, 255, 255, 0.05)',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '4px',
      alignContent: 'flex-start'
    }}>
      {stocks.map(st => {
        const bg = getCellColor(st);
        const metric = getMetricLabel(st);

        return (
          <button
            key={st.ticker}
            onClick={() => onSelectStock(st)}
            title={`${st.ticker} - ${st.company}\nPrecio: $${st.price?.toFixed(2)}\nCambio: ${st.change_pct}%`}
            style={{
              background: bg,
              border: 'none',
              borderRadius: '4px',
              padding: '3px 6px',
              color: '#fff',
              fontSize: '0.7rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              lineHeight: 1.1,
              minWidth: '44px',
              transition: 'transform 0.1s ease, filter 0.1s ease'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'scale(1.08)';
              e.currentTarget.style.zIndex = '10';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.zIndex = '1';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <span>{st.ticker}</span>
            {metric && (
              <span style={{ fontSize: '0.62rem', fontWeight: 500, opacity: 0.9 }}>
                {metric}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

// Escala térmica de color según rendimiento porcentual
function getPerformanceColor(val?: number): string {
  if (val === undefined || val === null) return '#1e293b';
  if (val >= 3.0) return '#15803d'; // Verde oscuro fuerte
  if (val >= 2.0) return '#16a34a'; // Verde medio
  if (val >= 0.5) return '#22c55e'; // Verde claro
  if (val > -0.5 && val < 0.5) return '#334155'; // Gris neutral
  if (val <= -3.0) return '#b91c1c'; // Rojo oscuro fuerte
  if (val <= -2.0) return '#dc2626'; // Rojo medio
  if (val <= -0.5) return '#ef4444'; // Rojo claro
  return '#334155';
}

const sideSelectStyle: React.CSSProperties = {
  width: '100%',
  background: '#070b14',
  border: '1px solid var(--border-subtle)',
  borderRadius: '6px',
  padding: '7px 10px',
  color: '#fff',
  fontSize: '0.8rem',
  outline: 'none'
};

const checkboxLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  cursor: 'pointer',
  color: 'var(--text-secondary)'
};
