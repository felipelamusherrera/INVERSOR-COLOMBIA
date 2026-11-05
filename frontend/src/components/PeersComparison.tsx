import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Plus, 
  X, 
  Eye, 
  Bookmark,
  Sparkles
} from 'lucide-react';
import type { StockRecord } from '../types/stock';
import { calculateFactorGrades } from '../utils/quantRatings';

interface PeersComparisonProps {
  stocks: StockRecord[];
  selectedStock: StockRecord | null;
  onSelectStock: (stock: StockRecord) => void;
  onToggleWatchlist: (ticker: string) => void;
  watchlist: string[];
}

export const PeersComparison: React.FC<PeersComparisonProps> = ({
  stocks,
  selectedStock,
  onSelectStock,
  onToggleWatchlist,
  watchlist
}) => {
  // Manejador de tickers seleccionados para comparar (hasta 4 tickers simultáneos)
  const [selectedTickers, setSelectedTickers] = useState<string[]>(() => {
    if (selectedStock) {
      // Buscar 3 compañeros del mismo sector
      const sectorPeers = stocks
        .filter(s => s.ticker !== selectedStock.ticker && (!selectedStock.sector || s.sector === selectedStock.sector))
        .slice(0, 3)
        .map(s => s.ticker);
      return [selectedStock.ticker, ...sectorPeers];
    } else {
      // Tomar los 4 primeros con mayor Market Cap
      return [...stocks]
        .sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0))
        .slice(0, 4)
        .map(s => s.ticker);
    }
  });

  const [searchTicker, setSearchTicker] = useState('');

  // Objetos de las acciones seleccionadas
  const comparedStocks = useMemo(() => {
    return selectedTickers
      .map(t => stocks.find(s => s.ticker === t))
      .filter((s): s is StockRecord => Boolean(s));
  }, [selectedTickers, stocks]);

  // Lista de candidatos para añadir ordenada por relevancia inteligente
  const availableToAdd = useMemo(() => {
    if (!searchTicker.trim()) return [];
    const query = searchTicker.toLowerCase().trim();

    return stocks
      .filter(s => 
        !selectedTickers.includes(s.ticker) &&
        (s.ticker.toLowerCase().includes(query) || 
         (s.company && s.company.toLowerCase().includes(query)))
      )
      .sort((a, b) => {
        const aTick = a.ticker.toLowerCase();
        const bTick = b.ticker.toLowerCase();
        const aComp = (a.company || '').toLowerCase();
        const bComp = (b.company || '').toLowerCase();

        // 1. Coincidencia exacta de ticker (ej: "MU" === "mu")
        if (aTick === query && bTick !== query) return -1;
        if (bTick === query && aTick !== query) return 1;

        // 2. Ticker comienza con la búsqueda (ej: "MU..." vs "...MU...")
        const aStarts = aTick.startsWith(query);
        const bStarts = bTick.startsWith(query);
        if (aStarts && !bStarts) return -1;
        if (bStarts && !aStarts) return 1;

        // 3. Nombre de la empresa comienza con la búsqueda (ej: "Micron..." vs "...community...")
        const aCompStarts = aComp.startsWith(query);
        const bCompStarts = bComp.startsWith(query);
        if (aCompStarts && !bCompStarts) return -1;
        if (bCompStarts && !aCompStarts) return 1;

        // 4. Desempate por Capitalización Bursátil (mayor capitalización primero)
        return (b.market_cap || 0) - (a.market_cap || 0);
      })
      .slice(0, 8);
  }, [stocks, selectedTickers, searchTicker]);

  const addTicker = (ticker: string) => {
    if (selectedTickers.length < 4 && !selectedTickers.includes(ticker)) {
      setSelectedTickers([...selectedTickers, ticker]);
      setSearchTicker('');
    }
  };

  const removeTicker = (ticker: string) => {
    if (selectedTickers.length > 1) {
      setSelectedTickers(selectedTickers.filter(t => t !== ticker));
    }
  };

  // Sugerir pares del mismo sector para el primer ticker
  const primaryStock = comparedStocks[0];
  const suggestedPeers = useMemo(() => {
    if (!primaryStock || !primaryStock.sector) return [];
    return stocks
      .filter(s => s.sector === primaryStock.sector && !selectedTickers.includes(s.ticker))
      .slice(0, 5);
  }, [stocks, primaryStock, selectedTickers]);

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '999px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.25)', color: 'var(--brand-primary)', fontSize: '0.82rem', fontWeight: 600, marginBottom: '12px' }}>
            <Users size={15} />
            Matriz de Competidores Directos & Pares Industriales
          </div>
          <h1 style={{ fontSize: '1.9rem', fontWeight: 800, margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
            Comparador Cuantitativo Seeking Alpha
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.92rem', maxWidth: '750px' }}>
            Contrasta simultáneamente hasta 4 activos financieros en función de sus Factor Grades (Valoración, Crecimiento, Rentabilidad, Solvencia y Momento).
          </p>
        </div>

        {/* Selector rápido para añadir activo */}
        <div style={{ position: 'relative', width: '280px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-medium)',
            borderRadius: '10px',
            padding: '8px 12px',
            gap: '8px'
          }}>
            <Plus size={16} color="var(--brand-primary)" />
            <input
              type="text"
              placeholder={selectedTickers.length >= 4 ? "Máximo 4 activos" : "Añadir ticker (ej: NVDA)..."}
              disabled={selectedTickers.length >= 4}
              value={searchTicker}
              onChange={(e) => setSearchTicker(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#fff',
                fontSize: '0.85rem',
                width: '100%',
                cursor: selectedTickers.length >= 4 ? 'not-allowed' : 'text'
              }}
            />
          </div>

          {availableToAdd.length > 0 && (
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
              zIndex: 50
            }}>
              {availableToAdd.map(item => (
                <div
                  key={item.ticker}
                  onClick={() => addTicker(item.ticker)}
                  style={{
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--border-subtle)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div>
                    <span className="font-mono" style={{ fontWeight: 700, color: 'var(--brand-primary)' }}>{item.ticker}</span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: '8px' }}>{item.company}</span>
                  </div>
                  <Plus size={14} color="var(--text-muted)" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sugerencias de la misma industria */}
      {suggestedPeers.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Sparkles size={14} color="var(--brand-primary)" />
            Pares del sector {primaryStock.sector}:
          </span>
          {suggestedPeers.map(peer => (
            <button
              key={peer.ticker}
              onClick={() => addTicker(peer.ticker)}
              disabled={selectedTickers.length >= 4}
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                padding: '4px 10px',
                color: 'var(--text-secondary)',
                fontSize: '0.78rem',
                cursor: selectedTickers.length >= 4 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--brand-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
            >
              <span className="font-mono" style={{ fontWeight: 700, color: '#fff' }}>{peer.ticker}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>${peer.price?.toFixed(2)}</span>
              <Plus size={12} color="var(--brand-primary)" />
            </button>
          ))}
        </div>
      )}

      {/* TABLA COMPARATIVA PRINCIPAL */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '850px' }}>
            <thead>
              <tr style={{ background: 'rgba(15, 23, 42, 0.9)', borderBottom: '2px solid var(--border-medium)' }}>
                <th style={{ padding: '18px 20px', width: '220px', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Dimensión de Análisis
                </th>
                {comparedStocks.map(stock => {
                  const isSaved = watchlist.includes(stock.ticker);
                  return (
                    <th key={stock.ticker} style={{ padding: '18px 20px', borderLeft: '1px solid var(--border-subtle)', minWidth: '180px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff' }}>
                              {stock.ticker}
                            </span>
                            {selectedTickers.length > 1 && (
                              <button
                                onClick={() => removeTicker(stock.ticker)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                                title="Remover de la comparación"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {stock.company}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {stock.sector || 'N/A'}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div className="font-mono" style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff' }}>
                            ${stock.price?.toFixed(2)}
                          </div>
                          {stock.change_pct !== undefined && (
                            <span className={stock.change_pct >= 0 ? 'delta-positive' : 'delta-negative'} style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                              {stock.change_pct >= 0 ? '+' : ''}{stock.change_pct.toFixed(2)}%
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Botones de Acción */}
                      <div style={{ display: 'flex', gap: '6px', marginTop: '14px' }}>
                        <button
                          onClick={() => onSelectStock(stock)}
                          className="btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '0.75rem', width: '100%', justifyContent: 'center' }}
                        >
                          <Eye size={13} />
                          Ver Ficha
                        </button>
                        <button
                          onClick={() => onToggleWatchlist(stock.ticker)}
                          className={`btn ${isSaved ? 'btn-active' : 'btn-secondary'}`}
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          title={isSaved ? "Quitar de cartera" : "Añadir a cartera"}
                        >
                          <Bookmark size={13} color={isSaved ? "var(--brand-accent)" : "currentColor"} />
                        </button>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {/* SECCIÓN 1: FACTOR GRADES RESUMEN */}
              <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                <td colSpan={comparedStocks.length + 1} style={{ padding: '10px 20px', fontWeight: 700, fontSize: '0.8rem', color: 'var(--brand-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Calificaciones Cuantitativas (Seeking Alpha Model)
                </td>
              </tr>

              {/* Calificación Global */}
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '14px 20px', fontWeight: 600, fontSize: '0.88rem', color: '#fff' }}>
                  Rating Quant Global
                </td>
                {comparedStocks.map(s => {
                  const a = calculateFactorGrades(s);
                  const isBuy = a.quantRating.includes('Compra');
                  return (
                    <td key={s.ticker} style={{ padding: '14px 20px', borderLeft: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 800, color: isBuy ? 'var(--state-success)' : '#fff' }}>
                          {a.quantScore.toFixed(2)}
                        </span>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background: isBuy ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                          color: isBuy ? 'var(--state-success)' : 'var(--text-secondary)'
                        }}>
                          {a.quantRating}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>

              {/* Valoración */}
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '12px 20px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Factor Valoración
                </td>
                {comparedStocks.map(s => {
                  const a = calculateFactorGrades(s);
                  return (
                    <td key={s.ticker} style={{ padding: '12px 20px', borderLeft: '1px solid var(--border-subtle)' }}>
                      <span className={`badge badge-grade-${a.grades.valuation.grade.charAt(0).toLowerCase()}`}>
                        {a.grades.valuation.grade}
                      </span>
                    </td>
                  );
                })}
              </tr>

              {/* Crecimiento */}
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '12px 20px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Factor Crecimiento
                </td>
                {comparedStocks.map(s => {
                  const a = calculateFactorGrades(s);
                  return (
                    <td key={s.ticker} style={{ padding: '12px 20px', borderLeft: '1px solid var(--border-subtle)' }}>
                      <span className={`badge badge-grade-${a.grades.growth.grade.charAt(0).toLowerCase()}`}>
                        {a.grades.growth.grade}
                      </span>
                    </td>
                  );
                })}
              </tr>

              {/* Rentabilidad */}
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '12px 20px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Factor Rentabilidad
                </td>
                {comparedStocks.map(s => {
                  const a = calculateFactorGrades(s);
                  return (
                    <td key={s.ticker} style={{ padding: '12px 20px', borderLeft: '1px solid var(--border-subtle)' }}>
                      <span className={`badge badge-grade-${a.grades.profitability.grade.charAt(0).toLowerCase()}`}>
                        {a.grades.profitability.grade}
                      </span>
                    </td>
                  );
                })}
              </tr>

              {/* Solvencia */}
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '12px 20px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Factor Salud Financiera
                </td>
                {comparedStocks.map(s => {
                  const a = calculateFactorGrades(s);
                  return (
                    <td key={s.ticker} style={{ padding: '12px 20px', borderLeft: '1px solid var(--border-subtle)' }}>
                      <span className={`badge badge-grade-${a.grades.solvency.grade.charAt(0).toLowerCase()}`}>
                        {a.grades.solvency.grade}
                      </span>
                    </td>
                  );
                })}
              </tr>

              {/* Momento */}
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '12px 20px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Factor Momento
                </td>
                {comparedStocks.map(s => {
                  const a = calculateFactorGrades(s);
                  return (
                    <td key={s.ticker} style={{ padding: '12px 20px', borderLeft: '1px solid var(--border-subtle)' }}>
                      <span className={`badge badge-grade-${a.grades.momentum.grade.charAt(0).toLowerCase()}`}>
                        {a.grades.momentum.grade}
                      </span>
                    </td>
                  );
                })}
              </tr>

              {/* SECCIÓN 2: VALORACIÓN DETALLADA */}
              <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                <td colSpan={comparedStocks.length + 1} style={{ padding: '10px 20px', fontWeight: 700, fontSize: '0.8rem', color: 'var(--brand-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Métricas Clave de Valoración
                </td>
              </tr>

              <tr>
                <td style={{ padding: '12px 20px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>P/E Ratio (Trailing)</td>
                {comparedStocks.map(s => (
                  <td key={s.ticker} className="font-mono" style={{ padding: '12px 20px', borderLeft: '1px solid var(--border-subtle)', fontWeight: 600 }}>
                    {s.pe ? s.pe.toFixed(2) : '—'}
                  </td>
                ))}
              </tr>

              <tr>
                <td style={{ padding: '12px 20px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Forward P/E</td>
                {comparedStocks.map(s => (
                  <td key={s.ticker} className="font-mono" style={{ padding: '12px 20px', borderLeft: '1px solid var(--border-subtle)', fontWeight: 600 }}>
                    {s.forward_pe ? s.forward_pe.toFixed(2) : '—'}
                  </td>
                ))}
              </tr>

              <tr>
                <td style={{ padding: '12px 20px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>PEG Ratio (P/E to Growth)</td>
                {comparedStocks.map(s => (
                  <td key={s.ticker} className="font-mono" style={{ padding: '12px 20px', borderLeft: '1px solid var(--border-subtle)', fontWeight: 700, color: s.peg && s.peg <= 1.0 ? 'var(--state-success)' : '#fff' }}>
                    {s.peg ? s.peg.toFixed(2) : '—'}
                  </td>
                ))}
              </tr>

              <tr>
                <td style={{ padding: '12px 20px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>EV / EBITDA</td>
                {comparedStocks.map(s => (
                  <td key={s.ticker} className="font-mono" style={{ padding: '12px 20px', borderLeft: '1px solid var(--border-subtle)' }}>
                    {s.ev_ebitda ? s.ev_ebitda.toFixed(2) : '—'}
                  </td>
                ))}
              </tr>

              <tr>
                <td style={{ padding: '12px 20px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>P/S (Price / Sales)</td>
                {comparedStocks.map(s => (
                  <td key={s.ticker} className="font-mono" style={{ padding: '12px 20px', borderLeft: '1px solid var(--border-subtle)' }}>
                    {s.ps ? s.ps.toFixed(2) : '—'}
                  </td>
                ))}
              </tr>

              {/* SECCIÓN 3: RENTABILIDAD & MARGENES */}
              <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                <td colSpan={comparedStocks.length + 1} style={{ padding: '10px 20px', fontWeight: 700, fontSize: '0.8rem', color: 'var(--brand-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Rentabilidad y Rendimiento del Capital
                </td>
              </tr>

              <tr>
                <td style={{ padding: '12px 20px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>ROIC (Return on Invested Capital)</td>
                {comparedStocks.map(s => (
                  <td key={s.ticker} className="font-mono" style={{ padding: '12px 20px', borderLeft: '1px solid var(--border-subtle)', fontWeight: 700, color: s.roic && s.roic >= 15 ? 'var(--state-success)' : '#fff' }}>
                    {s.roic ? `${s.roic.toFixed(2)}%` : '—'}
                  </td>
                ))}
              </tr>

              <tr>
                <td style={{ padding: '12px 20px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Margen Neto (Profit Margin)</td>
                {comparedStocks.map(s => (
                  <td key={s.ticker} className="font-mono" style={{ padding: '12px 20px', borderLeft: '1px solid var(--border-subtle)' }}>
                    {s.profit_m ? `${s.profit_m.toFixed(2)}%` : '—'}
                  </td>
                ))}
              </tr>

              <tr>
                <td style={{ padding: '12px 20px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>ROE (Return on Equity)</td>
                {comparedStocks.map(s => (
                  <td key={s.ticker} className="font-mono" style={{ padding: '12px 20px', borderLeft: '1px solid var(--border-subtle)' }}>
                    {s.roe ? `${s.roe.toFixed(2)}%` : '—'}
                  </td>
                ))}
              </tr>

              {/* SECCIÓN 4: CRECIMIENTO & BALANCES */}
              <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                <td colSpan={comparedStocks.length + 1} style={{ padding: '10px 20px', fontWeight: 700, fontSize: '0.8rem', color: 'var(--brand-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Crecimiento Operativo y Apalancamiento
                </td>
              </tr>

              <tr>
                <td style={{ padding: '12px 20px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>BPA Trimestral (EPS Q/Q)</td>
                {comparedStocks.map(s => (
                  <td key={s.ticker} className="font-mono" style={{ padding: '12px 20px', borderLeft: '1px solid var(--border-subtle)' }}>
                    {s.eps_qq !== undefined && s.eps_qq !== null ? (
                      <span className={s.eps_qq >= 0 ? 'delta-positive' : 'delta-negative'}>
                        {s.eps_qq >= 0 ? '+' : ''}{s.eps_qq.toFixed(2)}%
                      </span>
                    ) : '—'}
                  </td>
                ))}
              </tr>

              <tr>
                <td style={{ padding: '12px 20px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Ventas YoY (TTM)</td>
                {comparedStocks.map(s => (
                  <td key={s.ticker} className="font-mono" style={{ padding: '12px 20px', borderLeft: '1px solid var(--border-subtle)' }}>
                    {s.sales_yoy_ttm !== undefined && s.sales_yoy_ttm !== null ? (
                      <span className={s.sales_yoy_ttm >= 0 ? 'delta-positive' : 'delta-negative'}>
                        {s.sales_yoy_ttm >= 0 ? '+' : ''}{s.sales_yoy_ttm.toFixed(2)}%
                      </span>
                    ) : '—'}
                  </td>
                ))}
              </tr>

              <tr>
                <td style={{ padding: '12px 20px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Deuda / Patrimonio (Debt/Eq)</td>
                {comparedStocks.map(s => (
                  <td key={s.ticker} className="font-mono" style={{ padding: '12px 20px', borderLeft: '1px solid var(--border-subtle)' }}>
                    {s.debt_eq !== undefined && s.debt_eq !== null ? s.debt_eq.toFixed(2) : '—'}
                  </td>
                ))}
              </tr>

              <tr>
                <td style={{ padding: '12px 20px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>RSI (14 días)</td>
                {comparedStocks.map(s => (
                  <td key={s.ticker} className="font-mono" style={{ padding: '12px 20px', borderLeft: '1px solid var(--border-subtle)' }}>
                    {s.rsi ? s.rsi.toFixed(1) : '—'}
                  </td>
                ))}
              </tr>

              <tr>
                <td style={{ padding: '12px 20px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Precio Objetivo Analistas</td>
                {comparedStocks.map(s => {
                  const upside = s.target_price && s.price ? ((s.target_price - s.price) / s.price) * 100 : null;
                  return (
                    <td key={s.ticker} className="font-mono" style={{ padding: '12px 20px', borderLeft: '1px solid var(--border-subtle)' }}>
                      {s.target_price ? (
                        <div>
                          <div>${s.target_price.toFixed(2)}</div>
                          {upside !== null && (
                            <span style={{ fontSize: '0.72rem' }} className={upside >= 0 ? 'delta-positive' : 'delta-negative'}>
                              {upside >= 0 ? '+' : ''}{upside.toFixed(1)}% potencial
                            </span>
                          )}
                        </div>
                      ) : '—'}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
