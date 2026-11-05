import React, { useMemo } from 'react';
import { 
  Bookmark, 
  Trash2, 
  Eye, 
  Download, 
  Layers
} from 'lucide-react';
import type { StockRecord } from '../types/stock';
import { calculateFactorGrades } from '../utils/quantRatings';

interface WatchlistProps {
  stocks: StockRecord[];
  watchlist: string[];
  onToggleWatchlist: (ticker: string) => void;
  onSelectStock: (stock: StockRecord) => void;
  onGoToScreener: () => void;
}

export const Watchlist: React.FC<WatchlistProps> = ({
  stocks,
  watchlist,
  onToggleWatchlist,
  onSelectStock,
  onGoToScreener
}) => {
  // Acciones en la cartera
  const watchlistStocks = useMemo(() => {
    return stocks.filter(s => watchlist.includes(s.ticker));
  }, [stocks, watchlist]);

  // Métricas agregadas de la cartera
  const stats = useMemo(() => {
    if (watchlistStocks.length === 0) return null;

    let totalScore = 0;
    let roicSum = 0;
    let roicCount = 0;
    let peSum = 0;
    let peCount = 0;
    let divSum = 0;
    let divCount = 0;

    watchlistStocks.forEach(s => {
      const a = calculateFactorGrades(s);
      totalScore += a.quantScore;

      if (s.roic !== undefined && s.roic !== null) {
        roicSum += s.roic;
        roicCount++;
      }
      if (s.pe !== undefined && s.pe !== null && s.pe > 0) {
        peSum += s.pe;
        peCount++;
      }
      if (s.dividend !== undefined && s.dividend !== null) {
        divSum += s.dividend;
        divCount++;
      }
    });

    return {
      count: watchlistStocks.length,
      avgQuant: (totalScore / watchlistStocks.length).toFixed(2),
      avgRoic: roicCount > 0 ? (roicSum / roicCount).toFixed(1) : '—',
      avgPe: peCount > 0 ? (peSum / peCount).toFixed(1) : '—',
      avgDiv: divCount > 0 ? (divSum / divCount).toFixed(2) : '—'
    };
  }, [watchlistStocks]);

  // Exportar a CSV
  const handleExportCSV = () => {
    if (watchlistStocks.length === 0) return;
    const headers = ['Ticker', 'Compañía', 'Sector', 'Precio', 'Cambio %', 'Quant Score', 'Valoración', 'Crecimiento', 'Rentabilidad', 'ROIC', 'P/E', 'PEG'];
    const rows = watchlistStocks.map(s => {
      const a = calculateFactorGrades(s);
      return [
        s.ticker,
        `"${s.company.replace(/"/g, '""')}"`,
        `"${s.sector || ''}"`,
        s.price || '',
        s.change_pct || '',
        a.quantScore,
        a.grades.valuation.grade,
        a.grades.growth.grade,
        a.grades.profitability.grade,
        s.roic || '',
        s.pe || '',
        s.peg || ''
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `mi_cartera_inversor_colombia_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '999px', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.25)', color: 'var(--brand-accent)', fontSize: '0.82rem', fontWeight: 600, marginBottom: '12px' }}>
            <Bookmark size={15} />
            Portafolio Personal de Seguimiento
          </div>
          <h1 style={{ fontSize: '1.9rem', fontWeight: 800, margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
            Mi Cartera & Watchlist Activa
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.92rem' }}>
            Monitoriza en tiempo real las empresas guardadas para auditar su evolución y Factor Grades cuantitativos.
          </p>
        </div>

        {watchlistStocks.length > 0 && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleExportCSV} className="btn btn-secondary">
              <Download size={15} />
              Exportar CSV
            </button>
            <button onClick={onGoToScreener} className="btn btn-primary">
              <Layers size={15} />
              Explorar Más Acciones
            </button>
          </div>
        )}
      </div>

      {/* METRICAS DE PORTAFOLIO */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', marginBottom: '28px' }}>
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              Activos Monitorizados
            </div>
            <div className="font-mono" style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff' }}>
              {stats.count}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Empresas en lista activa
            </div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              Quant Rating Promedio
            </div>
            <div className="font-mono" style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--brand-primary)' }}>
              {stats.avgQuant} / 5.0
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Puntuación factorial ponderada
            </div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              ROIC Promedio (Capital)
            </div>
            <div className="font-mono" style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--state-success)' }}>
              {stats.avgRoic}%
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Eficiencia operativa media
            </div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              P/E Múltiplo Medio
            </div>
            <div className="font-mono" style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff' }}>
              {stats.avgPe}x
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Múltiplo de beneficios agregado
            </div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              Dividend Yield Prom.
            </div>
            <div className="font-mono" style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--brand-accent)' }}>
              {stats.avgDiv}%
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Rendimiento por dividendo
            </div>
          </div>
        </div>
      )}

      {/* ESTADO VACIO */}
      {watchlistStocks.length === 0 ? (
        <div className="card" style={{ padding: '60px 24px', textAlign: 'center', maxWidth: '600px', margin: '40px auto' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(234, 179, 8, 0.1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
            <Bookmark size={32} color="var(--brand-accent)" />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 10px 0' }}>
            No tienes acciones guardadas aún
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '24px' }}>
            Navega por el Screener Cuantitativo o el Dashboard de Oportunidades y pulsa el icono de marcador para guardar activos de tu interés.
          </p>
          <button onClick={onGoToScreener} className="btn btn-primary" style={{ margin: '0 auto' }}>
            <Layers size={16} />
            Ir al Screener de Acciones
          </button>
        </div>
      ) : (
        /* TABLA DE ACCIONES GUARDADAS */
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '950px' }}>
              <thead>
                <tr style={{ background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid var(--border-medium)' }}>
                  <th style={{ padding: '14px 18px', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ticker / Empresa</th>
                  <th style={{ padding: '14px 18px', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Precio</th>
                  <th style={{ padding: '14px 18px', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cambio %</th>
                  <th style={{ padding: '14px 18px', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Quant Rating</th>
                  <th style={{ padding: '14px 18px', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Valoración</th>
                  <th style={{ padding: '14px 18px', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Crecimiento</th>
                  <th style={{ padding: '14px 18px', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Rentabilidad</th>
                  <th style={{ padding: '14px 18px', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>ROIC</th>
                  <th style={{ padding: '14px 18px', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>PEG</th>
                  <th style={{ padding: '14px 18px', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {watchlistStocks.map(stock => {
                  const analysis = calculateFactorGrades(stock);
                  return (
                    <tr 
                      key={stock.ticker}
                      style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.2s ease' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '16px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="font-mono" style={{ fontWeight: 800, fontSize: '1rem', color: '#fff' }}>
                            {stock.ticker}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {stock.company}
                        </div>
                      </td>

                      <td className="font-mono" style={{ padding: '16px 18px', fontWeight: 700, color: '#fff' }}>
                        ${stock.price?.toFixed(2)}
                      </td>

                      <td style={{ padding: '16px 18px' }}>
                        {stock.change_pct !== undefined ? (
                          <span className={`font-mono ${stock.change_pct >= 0 ? 'delta-positive' : 'delta-negative'}`} style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                            {stock.change_pct >= 0 ? '+' : ''}{stock.change_pct.toFixed(2)}%
                          </span>
                        ) : '—'}
                      </td>

                      <td style={{ padding: '16px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="font-mono" style={{ fontWeight: 800, color: 'var(--brand-primary)', fontSize: '0.95rem' }}>
                            {analysis.quantScore.toFixed(2)}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                            {analysis.quantRating}
                          </span>
                        </div>
                      </td>

                      <td style={{ padding: '16px 18px', textAlign: 'center' }}>
                        <span className={`badge badge-grade-${analysis.grades.valuation.grade.charAt(0).toLowerCase()}`}>
                          {analysis.grades.valuation.grade}
                        </span>
                      </td>

                      <td style={{ padding: '16px 18px', textAlign: 'center' }}>
                        <span className={`badge badge-grade-${analysis.grades.growth.grade.charAt(0).toLowerCase()}`}>
                          {analysis.grades.growth.grade}
                        </span>
                      </td>

                      <td style={{ padding: '16px 18px', textAlign: 'center' }}>
                        <span className={`badge badge-grade-${analysis.grades.profitability.grade.charAt(0).toLowerCase()}`}>
                          {analysis.grades.profitability.grade}
                        </span>
                      </td>

                      <td className="font-mono" style={{ padding: '16px 18px', fontWeight: 600 }}>
                        {stock.roic ? `${stock.roic.toFixed(1)}%` : '—'}
                      </td>

                      <td className="font-mono" style={{ padding: '16px 18px', fontWeight: 600, color: stock.peg && stock.peg <= 1.0 ? 'var(--state-success)' : '#fff' }}>
                        {stock.peg ? stock.peg.toFixed(2) : '—'}
                      </td>

                      <td style={{ padding: '16px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                          <button
                            onClick={() => onSelectStock(stock)}
                            className="btn btn-secondary"
                            style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                            title="Ver Ficha y Gráfico"
                          >
                            <Eye size={13} />
                            Ficha
                          </button>
                          <button
                            onClick={() => onToggleWatchlist(stock.ticker)}
                            style={{
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#ef4444',
                              borderRadius: '6px',
                              padding: '6px',
                              cursor: 'pointer'
                            }}
                            title="Eliminar de mi cartera"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
