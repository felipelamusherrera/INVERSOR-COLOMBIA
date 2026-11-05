import React, { useState, useMemo } from 'react';
import { 
  Download, 
  Search, 
  Eye, 
  TrendingUp, 
  DollarSign, 
  ShieldCheck, 
  Layers,
  Sparkles,
  ArrowUp,
  ArrowDown,
  ArrowUpDown
} from 'lucide-react';
import type { StockRecord } from '../types/stock';
import { calculateFactorGrades } from '../utils/quantRatings';

interface StockScreenerProps {
  stocks: StockRecord[];
  onSelectStock: (stock: StockRecord) => void;
  selectedStock: StockRecord | null;
}

export type SortField = keyof StockRecord | 'quant_rating';

export const StockScreener: React.FC<StockScreenerProps> = ({
  stocks,
  onSelectStock,
  selectedStock
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sectorFilter, setSectorFilter] = useState('ALL');
  const [presetFilter, setPresetFilter] = useState('ALL');
  const [sortField, setSortField] = useState<SortField>('market_cap');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Sectores únicos
  const sectors = useMemo(() => {
    const set = new Set<string>();
    stocks.forEach(s => { if (s.sector) set.add(s.sector); });
    return Array.from(set).sort();
  }, [stocks]);

  // Filtrado y Ordenación
  const filteredStocks = useMemo(() => {
    return stocks.filter(stock => {
      // Búsqueda por ticker o empresa
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchTicker = stock.ticker.toLowerCase().includes(term);
        const matchCompany = stock.company?.toLowerCase().includes(term);
        if (!matchTicker && !matchCompany) return false;
      }

      // Filtro sector
      if (sectorFilter !== 'ALL' && stock.sector !== sectorFilter) {
        return false;
      }

      // Presets
      if (presetFilter === 'STRATEGY') {
        const curOk = (stock.curr_r ?? 0) >= 1.0;
        const quickOk = (stock.quick_r ?? 0) >= 1.0;
        const epsqOk = (stock.eps_qq ?? 0) >= 15.0;
        const fpeOk = (stock.forward_pe ?? 0) > 0 && (stock.forward_pe ?? 0) <= 30.0;
        const roicOk = (stock.roic ?? 0) >= 10.0;
        if (!curOk || !quickOk || !epsqOk || !fpeOk || !roicOk) return false;
      } else if (presetFilter === 'VALUE') {
        if (!stock.peg || stock.peg <= 0 || stock.peg > 1.0) return false;
      } else if (presetFilter === 'ROIC') {
        if (!stock.roic || stock.roic < 15.0) return false;
      } else if (presetFilter === 'RSI_BOUNCE') {
        if (!stock.rsi || stock.rsi < 40 || stock.rsi > 55) return false;
      } else if (presetFilter === 'MEGA_CAP') {
        if (!stock.market_cap || stock.market_cap < 50e9) return false;
      }

      return true;
    }).sort((a, b) => {
      let valA: any = sortField === 'quant_rating' ? calculateFactorGrades(a).quantScore : a[sortField as keyof StockRecord];
      let valB: any = sortField === 'quant_rating' ? calculateFactorGrades(b).quantScore : b[sortField as keyof StockRecord];

      const isNullA = valA === undefined || valA === null || valA === '' || (typeof valA === 'number' && isNaN(valA));
      const isNullB = valB === undefined || valB === null || valB === '' || (typeof valB === 'number' && isNaN(valB));

      if (isNullA && isNullB) return 0;
      if (isNullA) return 1;
      if (isNullB) return -1;

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
    });
  }, [stocks, searchTerm, sectorFilter, presetFilter, sortField, sortAsc]);

  const totalPages = Math.ceil(filteredStocks.length / pageSize);
  const paginatedStocks = filteredStocks.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      // Por defecto orden descendente para métricas financieras y ascendente para texto
      const defaultDesc = ['market_cap', 'price', 'volume', 'roic', 'profit_m', 'change_pct', 'quant_rating'].includes(field);
      setSortAsc(!defaultDesc);
    }
  };

  const exportCSV = () => {
    if (!filteredStocks.length) return;
    const headers = ['Ticker', 'Company', 'Sector', 'Price', 'Change %', 'Market Cap', 'P/E', 'Forward P/E', 'PEG', 'ROIC', 'RSI', 'Volume'];
    const rows = filteredStocks.map(s => [
      s.ticker,
      `"${s.company || ''}"`,
      `"${s.sector || ''}"`,
      s.price || '',
      s.change_pct || '',
      s.market_cap || '',
      s.pe || '',
      s.forward_pe || '',
      s.peg || '',
      s.roic || '',
      s.rsi || '',
      s.volume || ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `inversor_colombia_screener_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px' }} className="animate-fade-in">
      {/* Controles de Filtrado y Cabecera */}
      <div className="glass-panel" style={{ padding: '20px 24px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={22} color="var(--accent-green)" />
              Screener Cuantitativo Multimétrica
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              Mostrando {filteredStocks.length} de {stocks.length} acciones analizadas
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button 
              id="btn-export-csv"
              className="btn btn-secondary" 
              onClick={exportCSV}
            >
              <Download size={15} />
              Exportar CSV ({filteredStocks.length})
            </button>
          </div>
        </div>

        {/* Filtros rápidos por presets y barra de búsqueda */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <button 
              className={`btn ${presetFilter === 'ALL' ? 'btn-active' : 'btn-secondary'}`}
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              onClick={() => { setPresetFilter('ALL'); setPage(1); }}
            >
              Todas ({stocks.length})
            </button>
            <button 
              className={`btn ${presetFilter === 'STRATEGY' ? 'btn-active' : 'btn-secondary'}`}
              style={{ 
                padding: '6px 12px', 
                fontSize: '0.8rem',
                border: presetFilter === 'STRATEGY' ? '1px solid var(--accent-green)' : '1px solid rgba(16, 185, 129, 0.35)',
                color: presetFilter === 'STRATEGY' ? '#fff' : 'var(--accent-green)'
              }}
              onClick={() => { setPresetFilter('STRATEGY'); setPage(1); }}
            >
              <Sparkles size={14} color="var(--accent-green)" />
              Estrategia Inversor Colombia
            </button>
            <button 
              className={`btn ${presetFilter === 'VALUE' ? 'btn-active' : 'btn-secondary'}`}
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              onClick={() => { setPresetFilter('VALUE'); setPage(1); }}
            >
              <DollarSign size={14} />
              Gran Valor (PEG &lt; 1.0)
            </button>
            <button 
              className={`btn ${presetFilter === 'ROIC' ? 'btn-active' : 'btn-secondary'}`}
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              onClick={() => { setPresetFilter('ROIC'); setPage(1); }}
            >
              <ShieldCheck size={14} />
              Alta Rentabilidad (ROIC &gt; 15%)
            </button>
            <button 
              className={`btn ${presetFilter === 'RSI_BOUNCE' ? 'btn-active' : 'btn-secondary'}`}
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              onClick={() => { setPresetFilter('RSI_BOUNCE'); setPage(1); }}
            >
              <TrendingUp size={14} />
              Rebote Técnico (RSI 40-55)
            </button>
            <button 
              className={`btn ${presetFilter === 'MEGA_CAP' ? 'btn-active' : 'btn-secondary'}`}
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              onClick={() => { setPresetFilter('MEGA_CAP'); setPage(1); }}
            >
              Megacaps (&gt; $50B)
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <select
              className="input-control"
              value={sectorFilter}
              onChange={(e) => { setSectorFilter(e.target.value); setPage(1); }}
              style={{ padding: '7px 12px' }}
            >
              <option value="ALL">Todos los Sectores</option>
              {sectors.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="input-control"
                placeholder="Filtrar por ticker..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                style={{ paddingLeft: '32px', width: '200px' }}
              />
              <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '11px' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Tabla Interactiva de Alta Densidad */}
      <div className="table-container glass-panel">
        <table className="stock-table">
          <thead>
            <tr>
              {[
                { field: 'ticker', label: 'Ticker', align: 'left' },
                { field: 'company', label: 'Empresa', align: 'left' },
                { field: 'sector', label: 'Sector', align: 'left' },
                { field: 'price', label: 'Precio', align: 'right' },
                { field: 'change_pct', label: 'Var %', align: 'right' },
                { field: 'peg', label: 'PEG', align: 'right' },
                { field: 'pe', label: 'P/E', align: 'right' },
                { field: 'roic', label: 'ROIC', align: 'right' },
                { field: 'profit_m', label: 'Margen N.', align: 'right' },
                { field: 'rsi', label: 'RSI', align: 'right' },
                { field: 'market_cap', label: 'Cap. Mercado', align: 'right' },
                { field: 'volume', label: 'Volumen', align: 'right' },
                { field: 'quant_rating', label: 'Quant Rating', align: 'center' },
              ].map(({ field, label, align }) => {
                const isSorted = sortField === field;
                return (
                  <th 
                    key={field}
                    className="sortable" 
                    onClick={() => handleSort(field as SortField)} 
                    style={{ 
                      textAlign: align as any,
                      cursor: 'pointer',
                      userSelect: 'none',
                      whiteSpace: 'nowrap',
                      padding: '12px 14px',
                      transition: 'background 0.15s ease',
                      background: isSorted ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                      borderBottom: isSorted ? '2px solid var(--accent-green)' : '1px solid var(--border-subtle)',
                      color: isSorted ? '#fff' : 'var(--text-secondary)'
                    }}
                    title={`Ordenar por ${label} (${isSorted ? (sortAsc ? 'Ascendente' : 'Descendente') : 'Clic para ordenar'})`}
                  >
                    <div style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '5px', 
                      justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
                      width: '100%' 
                    }}>
                      <span>{label}</span>
                      {isSorted ? (
                        sortAsc ? (
                          <ArrowUp size={13} color="var(--accent-green)" />
                        ) : (
                          <ArrowDown size={13} color="var(--accent-green)" />
                        )
                      ) : (
                        <ArrowUpDown size={12} style={{ opacity: 0.25 }} />
                      )}
                    </div>
                  </th>
                );
              })}
              <th style={{ textAlign: 'center', padding: '12px 14px' }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {paginatedStocks.map(stock => {
              const analysis = calculateFactorGrades(stock);
              const isSelected = selectedStock?.ticker === stock.ticker;

              return (
                <tr 
                  key={stock.ticker}
                  className={isSelected ? 'selected' : ''}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onSelectStock(stock)}
                >
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="font-mono" style={{ fontWeight: 800, fontSize: '0.92rem', color: '#fff' }}>
                        {stock.ticker}
                      </span>
                    </div>
                  </td>
                  <td style={{ maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{stock.company}</span>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>
                    {stock.sector || '-'}
                  </td>
                  <td className="font-mono" style={{ textAlign: 'right', fontWeight: 700, color: '#fff' }}>
                    ${stock.price !== undefined && stock.price !== null ? stock.price.toFixed(2) : '-'}
                  </td>
                  <td className="font-mono" style={{ textAlign: 'right' }}>
                    {stock.change_pct !== undefined && stock.change_pct !== null ? (
                      <span className={stock.change_pct >= 0 ? 'delta-positive' : 'delta-negative'}>
                        {stock.change_pct >= 0 ? '+' : ''}{stock.change_pct.toFixed(2)}%
                      </span>
                    ) : '-'}
                  </td>
                  <td className="font-mono" style={{ textAlign: 'right', fontWeight: 700, color: (stock.peg && stock.peg < 1.0) ? 'var(--accent-green)' : 'inherit' }}>
                    {stock.peg !== undefined && stock.peg !== null ? stock.peg.toFixed(2) : '-'}
                  </td>
                  <td className="font-mono" style={{ textAlign: 'right' }}>
                    {stock.pe !== undefined && stock.pe !== null ? stock.pe.toFixed(1) : '-'}
                  </td>
                  <td className="font-mono" style={{ textAlign: 'right', fontWeight: 600, color: (stock.roic && stock.roic > 15) ? 'var(--accent-cyan)' : 'inherit' }}>
                    {stock.roic !== undefined && stock.roic !== null ? `${stock.roic.toFixed(1)}%` : '-'}
                  </td>
                  <td className="font-mono" style={{ textAlign: 'right' }}>
                    {stock.profit_m !== undefined && stock.profit_m !== null ? `${stock.profit_m.toFixed(1)}%` : '-'}
                  </td>
                  <td className="font-mono" style={{ textAlign: 'right' }}>
                    {stock.rsi !== undefined && stock.rsi !== null ? stock.rsi.toFixed(1) : '-'}
                  </td>
                  <td className="font-mono" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                    {stock.market_cap ? (
                      stock.market_cap >= 1e12 ? `$${(stock.market_cap / 1e12).toFixed(2)}T` :
                      stock.market_cap >= 1e9 ? `$${(stock.market_cap / 1e9).toFixed(2)}B` :
                      `$${(stock.market_cap / 1e6).toFixed(1)}M`
                    ) : '-'}
                  </td>
                  <td className="font-mono" style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                    {stock.volume ? stock.volume.toLocaleString() : '-'}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <span className={`grade-badge grade-badge-sm grade-${analysis.quantRating.startsWith('Fuerte C') || analysis.quantRating === 'Compra' ? 'A' : analysis.quantRating === 'Mantener' ? 'C' : 'F'}`}>
                        {analysis.quantScore}
                      </span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: analysis.quantScore >= 3.6 ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
                        {analysis.quantRating}
                      </span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectStock(stock);
                      }}
                    >
                      <Eye size={13} /> Ver
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px', padding: '0 8px' }}>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Página {page} de {Math.max(1, totalPages)}
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button 
            className="btn btn-secondary" 
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            style={{ padding: '6px 14px', opacity: page <= 1 ? 0.4 : 1 }}
          >
            Anterior
          </button>
          <button 
            className="btn btn-secondary" 
            disabled={page >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            style={{ padding: '6px 14px', opacity: page >= totalPages ? 0.4 : 1 }}
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
};
