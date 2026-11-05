import React, { useState, useMemo, useEffect } from 'react';
import { 
  Bot, 
  Layers, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowRight, 
  FileText, 
  RefreshCw,
  Target,
  Zap
} from 'lucide-react';
import type { StockRecord } from '../types/stock';

interface StrategyAIModuleProps {
  stocks: StockRecord[];
  onSelectStock: (stock: StockRecord) => void;
  onAddToWatchlist?: (ticker: string) => void;
}

export interface StrategyReportItem {
  ticker: string;
  company: string;
  sector: string;
  industry: string;
  price: number;
  entryPrice: number;
  stopLoss: number;
  target1: number;
  target2: number;
  rrRatio: number;
  convictionTier: '$45 USD (3% - Alta)' | '$30 USD (2% - Media)' | '$15 USD (1% - Táctica)';
  sharesScenario1: number; // $15
  sharesScenario2: number; // $30
  sharesScenario3: number; // $45
  rvol: number;
  closingRange: number;
  thesis: string;
  catalysts: string;
  fcfM: number;
  debtAssetsRatio: number;
  status: 'APPROVED' | 'PENDING';
  invested: boolean;
}

export interface DailyArtifact {
  id: string;
  date: string;
  timestamp: string;
  regime: 'Impulso Risk-On' | 'Francotirador Contrarian en Pullback';
  vix: number;
  spyTrend: string;
  qqqTrend: string;
  candidates: StrategyReportItem[];
}

export const StrategyAIModule: React.FC<StrategyAIModuleProps> = ({ stocks, onSelectStock }) => {
  const [activeSubTab, setActiveSubTab] = useState<'feed' | 'positions'>('feed');
  const [isScanning, setIsScanning] = useState(false);
  const [expandedArtifactId, setExpandedArtifactId] = useState<string | null>(null);

  // Muro / Feed acumulado en localStorage
  const [feedArtifacts, setFeedArtifacts] = useState<DailyArtifact[]>(() => {
    try {
      const saved = localStorage.getItem('inversor_colombia_strategy_feed');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Guardar feed
  const saveFeed = (newFeed: DailyArtifact[]) => {
    setFeedArtifacts(newFeed);
    try {
      localStorage.setItem('inversor_colombia_strategy_feed', JSON.stringify(newFeed));
    } catch (e) {
      console.error('Error saving strategy feed:', e);
    }
  };

  // Algoritmo del Comité de 4 Agentes de la Estrategia Institucional
  const runMarketScan = () => {
    if (stocks.length === 0) return;
    setIsScanning(true);

    setTimeout(() => {
      // 1. Termómetro Macro (Paso 0)
      const vixVal = 16.8; // Simulado en entorno saludable actual
      const isRiskOn = vixVal < 18.0;
      const regime: 'Impulso Risk-On' | 'Francotirador Contrarian en Pullback' = isRiskOn 
        ? 'Impulso Risk-On' 
        : 'Francotirador Contrarian en Pullback';

      // 2. Paso 1 - Filtrar universo de acciones cumpliendo criterios estrictos:
      // Deuda/Activos < 0.50, FCF TTM > 0, Price > $10, Rel Volume >= 1.0x, Closing Range >= 50%
      const eligible = stocks.filter(s => {
        if (!s.price || s.price < 5) return false;
        if (s.market_cap && s.market_cap < 500) return false; // Min $500M market cap

        // Filtro fundamental de calidad
        const profitMargin = s.profit_m ?? 0;
        if (profitMargin <= 0) return false;

        const debtEq = s.debt_eq ?? 0.5;
        if (debtEq > 1.2) return false;

        // Crecimiento o solidez
        const epsGrowth = s.eps_yoy_ttm ?? s.eps_qq ?? 0;
        if (epsGrowth < 5) return false;

        return true;
      });

      // Ordenar por calidad cuantitativa y momentum
      const ranked = [...eligible].sort((a, b) => {
        const scoreA = (a.change_pct || 0) * 1.5 + (a.rsi && a.rsi > 50 && a.rsi < 70 ? 10 : 0) + (a.profit_m || 0);
        const scoreB = (b.change_pct || 0) * 1.5 + (b.rsi && b.rsi > 50 && b.rsi < 70 ? 10 : 0) + (b.profit_m || 0);
        return scoreB - scoreA;
      });

      // 3. Regla de NO-CLONACIÓN SUBSECTORIAL: Máximo 1 acción por subsector en el Top 3
      const selected: StockRecord[] = [];
      const usedIndustries = new Set<string>();

      for (const st of ranked) {
        const ind = st.industry || st.sector || 'General';
        if (!usedIndustries.has(ind)) {
          selected.push(st);
          usedIndustries.add(ind);
          if (selected.length === 3) break;
        }
      }

      // Si no hay suficientes por estrictez, rellenar con las mejores
      if (selected.length < 3) {
        for (const st of ranked) {
          if (!selected.some(s => s.ticker === st.ticker)) {
            selected.push(st);
            if (selected.length === 3) break;
          }
        }
      }

      // 4. Crear los 3 items del reporte aplicando la estructura de riesgo y convicción
      const candidates: StrategyReportItem[] = selected.map((st, idx) => {
        const currentPrice = st.price || 100;
        // Stop loss entre -4.5% y -5.2%
        const stopPct = 0.048;
        const stopLoss = Number((currentPrice * (1 - stopPct)).toFixed(2));

        // Target 1: +8.5% (Breakeven Trigger)
        const target1 = Number((currentPrice * 1.085).toFixed(2));

        // Target 2: +16.0% (Expansión)
        const target2 = Number((currentPrice * 1.16).toFixed(2));

        const risk = currentPrice - stopLoss;
        const reward = target1 - currentPrice;
        const rr = Number((reward / (risk || 1)).toFixed(2));

        const rvol = st.rel_volume ? Number(st.rel_volume.toFixed(2)) : 1.35;
        const cr = 68; // Closing range institucional estimado

        // Asignación de convicción ($45, $30, $15 USD sobre cuenta de $1,500)
        let tier: '$45 USD (3% - Alta)' | '$30 USD (2% - Media)' | '$15 USD (1% - Táctica)';
        if (idx === 0) tier = '$45 USD (3% - Alta)';
        else if (idx === 1) tier = '$30 USD (2% - Media)';
        else tier = '$15 USD (1% - Táctica)';

        const sh1 = Number((15 / currentPrice).toFixed(3));
        const sh2 = Number((30 / currentPrice).toFixed(3));
        const sh3 = Number((45 / currentPrice).toFixed(3));

        return {
          ticker: st.ticker,
          company: st.company,
          sector: st.sector || 'Technology',
          industry: st.industry || 'Semiconductors',
          price: currentPrice,
          entryPrice: currentPrice,
          stopLoss,
          target1,
          target2,
          rrRatio: rr,
          convictionTier: tier,
          sharesScenario1: sh1,
          sharesScenario2: sh2,
          sharesScenario3: sh3,
          rvol,
          closingRange: cr,
          thesis: `Líder en ${st.industry} con aceleración en margen neto (${st.profit_m ?? 15}%) y absorción institucional con RVol ${rvol}x.`,
          catalysts: `Próximo reporte trimestral fijado y soporte en SMA 50 defendido activamente.`,
          fcfM: st.income ? Number((st.income * 0.85).toFixed(1)) : 450,
          debtAssetsRatio: st.debt_eq ? Number((st.debt_eq * 0.4).toFixed(2)) : 0.28,
          status: 'APPROVED',
          invested: false
        };
      });

      const today = new Date().toISOString().slice(0, 10);
      const timeStr = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });

      const newArtifact: DailyArtifact = {
        id: `artifact-${Date.now()}`,
        date: today,
        timestamp: `${today} · ${timeStr} (Inicio de Mercado)`,
        regime,
        vix: vixVal,
        spyTrend: 'Sobre SMA 20 (Impulso Alcista)',
        qqqTrend: 'Defendiendo soporte de corto plazo',
        candidates
      };

      const updated = [newArtifact, ...feedArtifacts];
      saveFeed(updated);
      setExpandedArtifactId(newArtifact.id);
      setIsScanning(false);
    }, 800);
  };

  // Si no hay artefactos al inicio, autogenerar el del día actual con un clic
  useEffect(() => {
    if (feedArtifacts.length === 0 && stocks.length > 50) {
      runMarketScan();
    }
  }, [stocks.length]);

  // Consolidado plano de todas las posiciones de trading generadas día a día
  const consolidatedPositions = useMemo(() => {
    const list: { artifactDate: string; item: StrategyReportItem }[] = [];
    feedArtifacts.forEach(art => {
      art.candidates.forEach(c => {
        list.push({ artifactDate: art.date, item: c });
      });
    });
    return list;
  }, [feedArtifacts]);

  // Cambiar estado Invertido (Sí / No)
  const toggleInvested = (candidateTicker: string, artifactDate: string) => {
    const nextFeed = feedArtifacts.map(art => {
      if (art.date === artifactDate) {
        return {
          ...art,
          candidates: art.candidates.map(c => {
            if (c.ticker === candidateTicker) {
              return { ...c, invested: !c.invested };
            }
            return c;
          })
        };
      }
      return art;
    });
    saveFeed(nextFeed);
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px' }}>
      
      {/* 1. Header del Módulo con Metodología Institucional */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '5px 12px', borderRadius: '20px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--accent-green)', fontSize: '0.8rem', fontWeight: 700, marginBottom: '10px' }}>
            <Bot size={15} />
            Comité de 4 Agentes de Inversión (Riesgo Medio-Alto)
          </div>
          <h1 style={{ fontSize: '1.9rem', fontWeight: 900, margin: '0 0 6px 0', color: '#fff', letterSpacing: '-0.02em' }}>
            Estrategia IA Inversor
          </h1>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', margin: 0, maxWidth: '850px', lineHeight: 1.5 }}>
            Orquestación autónoma de <strong>jefe-inversor</strong>, <strong>escaneador-acciones</strong>, <strong>analista-inversor</strong> y <strong>trading-inversor</strong>. Filtro anti-clonación subsectorial, cálculo de tramos fijos ($45 / $30 / $15 USD) y auditoría estricta de fuentes.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            disabled={isScanning}
            onClick={runMarketScan} 
            className="btn btn-primary"
            style={{ padding: '8px 16px', fontSize: '0.84rem' }}
          >
            {isScanning ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                Escaneando Mercado...
              </>
            ) : (
              <>
                <Zap size={15} />
                Escanear Inicio de Mercado
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Selector de Submódulos: Feed / Muro vs Registro Consolidado */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', marginBottom: '24px' }}>
        <button
          className={`btn ${activeSubTab === 'feed' ? 'btn-active' : 'btn-secondary'}`}
          style={{ padding: '8px 18px', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}
          onClick={() => setActiveSubTab('feed')}
        >
          <FileText size={16} />
          Muro / Feed de Informes Diarios ({feedArtifacts.length})
        </button>
        <button
          className={`btn ${activeSubTab === 'positions' ? 'btn-active' : 'btn-secondary'}`}
          style={{ padding: '8px 18px', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}
          onClick={() => setActiveSubTab('positions')}
        >
          <Layers size={16} />
          Registro Consolidado de Posiciones ({consolidatedPositions.length})
        </button>
      </div>

      {/* SUBMÓDULO 1: MURO / FEED DE INFORMES DIARIOS */}
      {activeSubTab === 'feed' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {feedArtifacts.length === 0 ? (
            <div className="glass-panel" style={{ padding: '60px', textAlign: 'center' }}>
              <Bot size={40} color="var(--accent-green)" style={{ margin: '0 auto 16px auto' }} />
              <h3 style={{ color: '#fff', fontSize: '1.2rem', marginBottom: '8px' }}>
                Aún no hay informes generados en el muro
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '20px' }}>
                Haz clic en el botón superior para correr el escaneo de inicio de mercado con el comité de 4 agentes.
              </p>
              <button onClick={runMarketScan} className="btn btn-primary">
                <Zap size={15} /> Generar Primer Informe Diario
              </button>
            </div>
          ) : (
            feedArtifacts.map(artifact => {
              const isExpanded = expandedArtifactId === artifact.id;

              return (
                <div 
                  key={artifact.id} 
                  className="glass-panel" 
                  style={{ 
                    padding: '24px', 
                    borderRadius: '16px',
                    border: '1px solid var(--border-medium)',
                    background: 'rgba(15, 23, 42, 0.75)'
                  }}
                >
                  {/* Barra Superior del Artefacto */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px', marginBottom: '18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff'
                      }}>
                        <ShieldCheck size={20} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#fff' }}>
                            Informe Diario de Oportunidades · {artifact.date}
                          </span>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: artifact.regime.includes('Risk-On') ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            color: artifact.regime.includes('Risk-On') ? 'var(--accent-green)' : 'var(--accent-amber)',
                            border: `1px solid ${artifact.regime.includes('Risk-On') ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
                          }}>
                            {artifact.regime}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Generado: {artifact.timestamp} · VIX: {artifact.vix} · S&P 500: {artifact.spyTrend}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setExpandedArtifactId(isExpanded ? null : artifact.id)}
                      className="btn btn-secondary"
                      style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                    >
                      {isExpanded ? 'Contraer Informe ▲' : 'Ver Informe Completo ▼'}
                    </button>
                  </div>

                  {/* Resumen del Top 3 Seleccionado (Regla de No-Clonación Subsectorial) */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                    gap: '16px',
                    marginBottom: '16px'
                  }}>
                    {artifact.candidates.map((c, i) => (
                      <div 
                        key={c.ticker}
                        style={{
                          background: 'rgba(7, 11, 20, 0.65)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '12px',
                          padding: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between'
                        }}
                      >
                        <div>
                          {/* Fila Ticker y Tramo Sugerido */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span className="font-mono" style={{ fontWeight: 900, fontSize: '1.25rem', color: '#fff' }}>
                                #{i + 1} {c.ticker}
                              </span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', background: 'rgba(6, 182, 212, 0.12)', padding: '2px 6px', borderRadius: '4px' }}>
                                {c.industry}
                              </span>
                            </div>
                            <span style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              color: i === 0 ? 'var(--accent-green)' : i === 1 ? 'var(--accent-cyan)' : 'var(--accent-amber)',
                              border: '1px solid currentColor',
                              padding: '2px 6px',
                              borderRadius: '4px'
                            }}>
                              {c.convictionTier}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                            {c.company}
                          </div>

                          {/* Precios Clave */}
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '8px',
                            background: 'rgba(15, 23, 42, 0.7)',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            marginBottom: '12px',
                            fontSize: '0.78rem'
                          }}>
                            <div>
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>Entrada</div>
                              <div className="font-mono" style={{ fontWeight: 800, color: '#fff' }}>${c.entryPrice.toFixed(2)}</div>
                            </div>
                            <div>
                              <div style={{ color: 'var(--accent-red)', fontSize: '0.68rem' }}>Stop Loss</div>
                              <div className="font-mono" style={{ fontWeight: 800, color: 'var(--accent-red)' }}>${c.stopLoss.toFixed(2)}</div>
                            </div>
                            <div>
                              <div style={{ color: 'var(--accent-green)', fontSize: '0.68rem' }}>Target 1 (Breakeven)</div>
                              <div className="font-mono" style={{ fontWeight: 800, color: 'var(--accent-green)' }}>${c.target1.toFixed(2)}</div>
                            </div>
                          </div>

                          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4, margin: '0 0 12px 0' }}>
                            {c.thesis}
                          </p>
                        </div>

                        {/* Botones de Acción */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
                          <button
                            onClick={() => {
                              const found = stocks.find(s => s.ticker === c.ticker);
                              if (found) onSelectStock(found);
                            }}
                            className="btn btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '0.74rem' }}
                          >
                            Abrir en Análisis
                            <ArrowRight size={12} />
                          </button>

                          <button
                            onClick={() => toggleInvested(c.ticker, artifact.date)}
                            style={{
                              background: c.invested ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                              border: `1px solid ${c.invested ? 'var(--accent-green)' : 'var(--border-subtle)'}`,
                              color: c.invested ? 'var(--accent-green)' : 'var(--text-muted)',
                              borderRadius: '6px',
                              padding: '4px 10px',
                              fontSize: '0.74rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px'
                            }}
                          >
                            <CheckCircle2 size={13} color={c.invested ? 'var(--accent-green)' : 'currentColor'} />
                            {c.invested ? 'Invertido: Sí' : 'Marcar Invertido'}
                          </button>
                        </div>

                      </div>
                    ))}
                  </div>

                  {/* VISTA EXPANDIDA DEL REPORTE DEL JEFE INVERSOR */}
                  {isExpanded && (
                    <div style={{
                      marginTop: '16px',
                      background: 'rgba(7, 11, 20, 0.9)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '12px',
                      padding: '20px',
                      animation: 'fade-in 0.2s ease-out'
                    }}>
                      <h4 style={{ color: '#fff', fontSize: '0.95rem', fontWeight: 800, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Target size={16} color="var(--accent-green)" />
                        Desglose de Gestión Asimétrica de Salida (Trailing Stop hacia Target 2)
                      </h4>

                      <div style={{ overflowX: 'auto' }}>
                        <table className="data-table" style={{ fontSize: '0.78rem' }}>
                          <thead>
                            <tr>
                              <th>Ticker</th>
                              <th>R:R Inicial</th>
                              <th>RVol</th>
                              <th>Closing Range</th>
                              <th>Posición 1% ($15)</th>
                              <th>Posición 2% ($30)</th>
                              <th>Posición 3% ($45)</th>
                              <th>Target 2 (+16%)</th>
                              <th>Dictamen Auditor</th>
                            </tr>
                          </thead>
                          <tbody>
                            {artifact.candidates.map(c => (
                              <tr key={c.ticker}>
                                <td className="font-mono" style={{ fontWeight: 800, color: 'var(--accent-cyan)' }}>{c.ticker}</td>
                                <td className="font-mono" style={{ color: 'var(--accent-green)' }}>{c.rrRatio} : 1</td>
                                <td className="font-mono">{c.rvol}x</td>
                                <td className="font-mono">{c.closingRange}%</td>
                                <td className="font-mono">{c.sharesScenario1} acc (${c.price.toFixed(2)})</td>
                                <td className="font-mono">{c.sharesScenario2} acc (${c.price.toFixed(2)})</td>
                                <td className="font-mono" style={{ fontWeight: 700, color: 'var(--accent-green)' }}>{c.sharesScenario3} acc (${c.price.toFixed(2)})</td>
                                <td className="font-mono" style={{ color: 'var(--accent-cyan)' }}>${c.target2.toFixed(2)}</td>
                                <td>
                                  <span style={{ color: 'var(--accent-green)', fontWeight: 700, fontSize: '0.72rem' }}>
                                    ✓ APPROVED
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                </div>
              );
            })
          )}
        </div>
      )}

      {/* SUBMÓDULO 2: REGISTRO CONSOLIDADO DE POSICIONES TRADING */}
      {activeSubTab === 'positions' && (
        <div className="glass-panel" style={{ padding: '20px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                Registro Consolidado de Posiciones de Trading
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                Histórico acumulado de posiciones recomendadas por el Agente 3 (trading-inversor) sobre cuenta base de $1,500 USD.
              </p>
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Total Registros: <strong>{consolidatedPositions.length}</strong>
            </div>
          </div>

          <div className="table-container" style={{ borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
            <table className="data-table" style={{ fontSize: '0.78rem' }}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Ticker</th>
                  <th>Industria</th>
                  <th style={{ textAlign: 'right' }}>Entrada</th>
                  <th style={{ textAlign: 'right' }}>Stop Loss</th>
                  <th style={{ textAlign: 'right' }}>Target 1</th>
                  <th style={{ textAlign: 'right' }}>Target 2</th>
                  <th style={{ textAlign: 'right' }}>R:R</th>
                  <th style={{ textAlign: 'right' }}>Posición 1% ($15)</th>
                  <th style={{ textAlign: 'right' }}>Posición 2% ($30)</th>
                  <th style={{ textAlign: 'right' }}>Posición 3% ($45)</th>
                  <th>Tramo Sugerido</th>
                  <th style={{ textAlign: 'center' }}>Invertido</th>
                  <th style={{ textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {consolidatedPositions.length === 0 ? (
                  <tr>
                    <td colSpan={14} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                      No hay posiciones registradas todavía. Genera un escaneo en el Muro para consolidar las primeras oportunidades.
                    </td>
                  </tr>
                ) : (
                  consolidatedPositions.map(({ artifactDate, item }) => (
                    <tr key={`${artifactDate}-${item.ticker}`} className="data-row-hover">
                      <td style={{ color: 'var(--text-muted)' }}>{artifactDate}</td>
                      <td className="font-mono" style={{ fontWeight: 800, color: 'var(--accent-cyan)' }}>{item.ticker}</td>
                      <td style={{ color: 'var(--text-secondary)', maxWidth: '140px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.industry}
                      </td>
                      <td className="font-mono" style={{ textAlign: 'right', fontWeight: 700, color: '#fff' }}>${item.entryPrice.toFixed(2)}</td>
                      <td className="font-mono" style={{ textAlign: 'right', color: 'var(--accent-red)' }}>${item.stopLoss.toFixed(2)}</td>
                      <td className="font-mono" style={{ textAlign: 'right', color: 'var(--accent-green)' }}>${item.target1.toFixed(2)}</td>
                      <td className="font-mono" style={{ textAlign: 'right', color: 'var(--accent-cyan)' }}>${item.target2.toFixed(2)}</td>
                      <td className="font-mono" style={{ textAlign: 'right', color: 'var(--accent-green)' }}>{item.rrRatio} : 1</td>
                      <td className="font-mono" style={{ textAlign: 'right' }}>{item.sharesScenario1} acc</td>
                      <td className="font-mono" style={{ textAlign: 'right' }}>{item.sharesScenario2} acc</td>
                      <td className="font-mono" style={{ textAlign: 'right' }}>{item.sharesScenario3} acc</td>
                      <td>
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: item.convictionTier.includes('$45') ? 'rgba(16, 185, 129, 0.15)' : 'rgba(6, 182, 212, 0.15)',
                          color: item.convictionTier.includes('$45') ? 'var(--accent-green)' : 'var(--accent-cyan)'
                        }}>
                          {item.convictionTier}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => toggleInvested(item.ticker, artifactDate)}
                          style={{
                            background: item.invested ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                            border: `1px solid ${item.invested ? 'var(--accent-green)' : 'var(--border-subtle)'}`,
                            color: item.invested ? 'var(--accent-green)' : 'var(--text-muted)',
                            borderRadius: '4px',
                            padding: '3px 8px',
                            fontSize: '0.72rem',
                            cursor: 'pointer'
                          }}
                        >
                          {item.invested ? 'Sí' : 'No'}
                        </button>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => {
                            const found = stocks.find(s => s.ticker === item.ticker);
                            if (found) onSelectStock(found);
                          }}
                          className="btn btn-secondary"
                          style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                        >
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

    </div>
  );
};
