import React, { useState, useMemo } from 'react';
import { 
  RotateCcw, 
  Download, 
  Layers
} from 'lucide-react';
import type { StockRecord } from '../types/stock';

interface FinvizScreenerProps {
  stocks: StockRecord[];
  onSelectStock: (stock: StockRecord) => void;
}

type FilterCategory = 'descriptive' | 'fundamental' | 'technical' | 'all';
type TableView = 'overview' | 'valuation' | 'financial' | 'performance' | 'technical' | 'custom';

export const FinvizScreener: React.FC<FinvizScreenerProps> = ({ stocks, onSelectStock }) => {
  // Pestaña de filtros activa
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('fundamental');
  const [tableView, setTableView] = useState<TableView>('overview');

  // Filtro por lista de tickers separados por coma (como en Finviz: Tickers: SNDK, MU, ASMI...)
  const [tickerQuery, setTickerQuery] = useState('');

  // Estados de filtros descriptivos
  const [sectorFilter, setSectorFilter] = useState('Any');
  const [industryFilter, setIndustryFilter] = useState('Any');
  const [countryFilter, setCountryFilter] = useState('Any');
  const [marketCapFilter, setMarketCapFilter] = useState('Any');
  const [indexFilter, setIndexFilter] = useState('Any');

  // Estados de filtros fundamentales
  const [peFilter, setPeFilter] = useState('Any');
  const [forwardPeFilter, setForwardPeFilter] = useState('Any');
  const [pegFilter, setPegFilter] = useState('Any');
  const [psFilter, setPsFilter] = useState('Any');
  const [epsGrowthQtrFilter, setEpsGrowthQtrFilter] = useState('Any');
  const [epsGrowthTtmFilter, setEpsGrowthTtmFilter] = useState('Any');
  const [salesGrowthQtrFilter, setSalesGrowthQtrFilter] = useState('Any');
  const [salesGrowthTtmFilter, setSalesGrowthTtmFilter] = useState('Any');
  const [currentRatioFilter, setCurrentRatioFilter] = useState('Any');
  const [quickRatioFilter, setQuickRatioFilter] = useState('Any');
  const [debtEquityFilter, setDebtEquityFilter] = useState('Any');
  const [profitMarginFilter, setProfitMarginFilter] = useState('Any');
  const [roicFilter, setRoicFilter] = useState('Any');

  // Estados de filtros técnicos
  const [rsiFilter, setRsiFilter] = useState('Any');
  const [sma20Filter, setSma20Filter] = useState('Any');
  const [sma50Filter, setSma50Filter] = useState('Any');
  const [sma200Filter, setSma200Filter] = useState('Any');
  const [changePctFilter, setChangePctFilter] = useState('Any');

  // Ordenación de tabla
  const [sortField, setSortField] = useState<keyof StockRecord>('market_cap');
  const [sortAsc, setSortAsc] = useState(false);

  // Paginación
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Extraer valores únicos para descriptivos
  const sectors = useMemo(() => {
    const set = new Set<string>();
    stocks.forEach(s => { if (s.sector) set.add(s.sector); });
    return Array.from(set).sort();
  }, [stocks]);

  const countries = useMemo(() => {
    const set = new Set<string>();
    stocks.forEach(s => { if (s.country) set.add(s.country); });
    return Array.from(set).sort();
  }, [stocks]);

  // Reset de todos los filtros
  const handleResetFilters = () => {
    setTickerQuery('');
    setSectorFilter('Any');
    setIndustryFilter('Any');
    setCountryFilter('Any');
    setMarketCapFilter('Any');
    setIndexFilter('Any');
    setPeFilter('Any');
    setForwardPeFilter('Any');
    setPegFilter('Any');
    setPsFilter('Any');
    setEpsGrowthQtrFilter('Any');
    setEpsGrowthTtmFilter('Any');
    setSalesGrowthQtrFilter('Any');
    setSalesGrowthTtmFilter('Any');
    setCurrentRatioFilter('Any');
    setQuickRatioFilter('Any');
    setDebtEquityFilter('Any');
    setProfitMarginFilter('Any');
    setRoicFilter('Any');
    setRsiFilter('Any');
    setSma20Filter('Any');
    setSma50Filter('Any');
    setSma200Filter('Any');
    setChangePctFilter('Any');
    setPage(1);
  };

  // Filtrado de acciones
  const filteredStocks = useMemo(() => {
    return stocks.filter(stock => {
      // 1. Filtro por lista de tickers (ej: "MU, NVDA, AAPL")
      if (tickerQuery.trim()) {
        const queryTickers = tickerQuery
          .toUpperCase()
          .split(/[\s,]+/)
          .map(t => t.trim())
          .filter(Boolean);

        if (queryTickers.length > 0) {
          if (!queryTickers.includes(stock.ticker.toUpperCase())) {
            return false;
          }
        }
      }

      // 2. Filtros Descriptivos
      if (sectorFilter !== 'Any' && stock.sector !== sectorFilter) return false;
      if (industryFilter !== 'Any' && stock.industry !== industryFilter) return false;
      if (countryFilter !== 'Any' && stock.country !== countryFilter) return false;
      if (indexFilter !== 'Any' && stock.index_name !== indexFilter) return false;

      if (marketCapFilter !== 'Any') {
        const mcap = stock.market_cap || 0;
        if (marketCapFilter === 'Mega ($200bln+)' && mcap < 200000) return false;
        if (marketCapFilter === 'Large ($10bln-$200bln)' && (mcap < 10000 || mcap >= 200000)) return false;
        if (marketCapFilter === 'Mid ($2bln-$10bln)' && (mcap < 2000 || mcap >= 10000)) return false;
        if (marketCapFilter === 'Small ($300mln-$2bln)' && (mcap < 300 || mcap >= 2000)) return false;
        if (marketCapFilter === 'Micro (under $300mln)' && mcap >= 300) return false;
      }

      // 3. Filtros Fundamentales
      if (peFilter !== 'Any') {
        const pe = stock.pe;
        if (pe === undefined || pe === null || pe <= 0) return false;
        if (peFilter === 'Under 15' && pe >= 15) return false;
        if (peFilter === 'Under 25' && pe >= 25) return false;
        if (peFilter === 'Under 50' && pe >= 50) return false;
        if (peFilter === 'Over 50' && pe <= 50) return false;
      }

      if (forwardPeFilter !== 'Any') {
        const fpe = stock.forward_pe;
        if (fpe === undefined || fpe === null || fpe <= 0) return false;
        if (forwardPeFilter === 'Under 15' && fpe >= 15) return false;
        if (forwardPeFilter === 'Under 20' && fpe >= 20) return false;
        if (forwardPeFilter === 'Under 30' && fpe >= 30) return false;
      }

      if (pegFilter !== 'Any') {
        const peg = stock.peg;
        if (peg === undefined || peg === null || peg <= 0) return false;
        if (pegFilter === 'Under 1' && peg >= 1) return false;
        if (pegFilter === 'Under 2' && peg >= 2) return false;
      }

      if (currentRatioFilter !== 'Any') {
        const cr = stock.curr_r;
        if (cr === undefined || cr === null) return false;
        if (currentRatioFilter === 'Over 1' && cr < 1) return false;
        if (currentRatioFilter === 'Over 1.5' && cr < 1.5) return false;
        if (currentRatioFilter === 'Over 2' && cr < 2) return false;
      }

      if (quickRatioFilter !== 'Any') {
        const qr = stock.quick_r;
        if (qr === undefined || qr === null) return false;
        if (quickRatioFilter === 'Over 1' && qr < 1) return false;
        if (quickRatioFilter === 'Over 1.5' && qr < 1.5) return false;
      }

      if (epsGrowthQtrFilter !== 'Any') {
        const eq = stock.eps_qq;
        if (eq === undefined || eq === null) return false;
        if (epsGrowthQtrFilter === 'Over 10%' && eq < 10) return false;
        if (epsGrowthQtrFilter === 'Over 15%' && eq < 15) return false;
        if (epsGrowthQtrFilter === 'Over 25%' && eq < 25) return false;
      }

      if (epsGrowthTtmFilter !== 'Any') {
        const ettm = stock.eps_yoy_ttm;
        if (ettm === undefined || ettm === null) return false;
        if (epsGrowthTtmFilter === 'Over 10%' && ettm < 10) return false;
        if (epsGrowthTtmFilter === 'Over 15%' && ettm < 15) return false;
        if (epsGrowthTtmFilter === 'Over 25%' && ettm < 25) return false;
      }

      if (profitMarginFilter !== 'Any') {
        const pm = stock.profit_m;
        if (pm === undefined || pm === null) return false;
        if (profitMarginFilter === 'Positive (>0%)' && pm <= 0) return false;
        if (profitMarginFilter === 'Over 15%' && pm < 15) return false;
        if (profitMarginFilter === 'Over 20%' && pm < 20) return false;
      }

      // 4. Filtros Técnicos
      if (rsiFilter !== 'Any') {
        const rsi = stock.rsi;
        if (rsi === undefined || rsi === null) return false;
        if (rsiFilter === 'Oversold (30)' && rsi > 30) return false;
        if (rsiFilter === 'Overbought (70)' && rsi < 70) return false;
        if (rsiFilter === 'Bullish (50-70)' && (rsi < 50 || rsi > 70)) return false;
      }

      if (changePctFilter !== 'Any') {
        const chg = stock.change_pct;
        if (chg === undefined || chg === null) return false;
        if (changePctFilter === 'Up' && chg <= 0) return false;
        if (changePctFilter === 'Down' && chg >= 0) return false;
        if (changePctFilter === 'Up 3%+' && chg < 3) return false;
        if (changePctFilter === 'Down 3%+' && chg > -3) return false;
      }

      if (psFilter !== 'Any') {
        const ps = stock.ps;
        if (ps === undefined || ps === null || ps <= 0) return false;
        if (psFilter === 'Under 1' && ps >= 1) return false;
        if (psFilter === 'Under 3' && ps >= 3) return false;
        if (psFilter === 'Over 5' && ps <= 5) return false;
      }

      if (debtEquityFilter !== 'Any') {
        const de = stock.debt_eq;
        if (de === undefined || de === null) return false;
        if (debtEquityFilter === 'Under 0.5' && de >= 0.5) return false;
        if (debtEquityFilter === 'Under 1' && de >= 1) return false;
      }

      if (roicFilter !== 'Any') {
        const roic = stock.roic;
        if (roic === undefined || roic === null) return false;
        if (roicFilter === 'Over 10%' && roic < 10) return false;
        if (roicFilter === 'Over 15%' && roic < 15) return false;
      }

      if (salesGrowthQtrFilter !== 'Any') {
        const sq = stock.sales_qq;
        if (sq === undefined || sq === null) return false;
        if (salesGrowthQtrFilter === 'Over 10%' && sq < 10) return false;
      }

      if (salesGrowthTtmFilter !== 'Any') {
        const sttm = stock.sales_yoy_ttm;
        if (sttm === undefined || sttm === null) return false;
        if (salesGrowthTtmFilter === 'Over 10%' && sttm < 10) return false;
      }

      if (sma20Filter !== 'Any') {
        if (!stock.price || !stock.sma20) return false;
        if (sma20Filter === 'Above' && stock.price <= stock.sma20) return false;
        if (sma20Filter === 'Below' && stock.price >= stock.sma20) return false;
      }

      if (sma50Filter !== 'Any') {
        if (!stock.price || !stock.sma50) return false;
        if (sma50Filter === 'Above' && stock.price <= stock.sma50) return false;
        if (sma50Filter === 'Below' && stock.price >= stock.sma50) return false;
      }

      if (sma200Filter !== 'Any') {
        if (!stock.price || !stock.sma200) return false;
        if (sma200Filter === 'Above' && stock.price <= stock.sma200) return false;
        if (sma200Filter === 'Below' && stock.price >= stock.sma200) return false;
      }

      return true;
    });
  }, [
    stocks, tickerQuery, sectorFilter, industryFilter, countryFilter, indexFilter, marketCapFilter,
    peFilter, forwardPeFilter, pegFilter, psFilter, currentRatioFilter, quickRatioFilter,
    debtEquityFilter, epsGrowthQtrFilter, epsGrowthTtmFilter, salesGrowthQtrFilter, salesGrowthTtmFilter,
    profitMarginFilter, roicFilter, rsiFilter, sma20Filter, sma50Filter, sma200Filter, changePctFilter
  ]);

  // Ordenar lista
  const sortedStocks = useMemo(() => {
    return [...filteredStocks].sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];

      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortAsc ? valA - valB : valB - valA;
      }
      return sortAsc 
        ? String(valA).localeCompare(String(valB)) 
        : String(valB).localeCompare(String(valA));
    });
  }, [filteredStocks, sortField, sortAsc]);

  // Paginación
  const totalPages = Math.ceil(sortedStocks.length / pageSize) || 1;
  const paginatedStocks = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedStocks.slice(start, start + pageSize);
  }, [sortedStocks, page]);

  // Cambiar orden
  const handleSort = (field: keyof StockRecord) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // Exportar a CSV
  const handleExportCSV = () => {
    if (sortedStocks.length === 0) return;
    const headers = ['Ticker', 'Compañía', 'Sector', 'Industria', 'Market Cap ($M)', 'Precio ($)', 'P/E', 'Forward P/E', 'P/S', 'RSI', 'Volumen', 'Cambio %', 'Margen Neto %', 'EPS Q/Q %', 'Current Ratio', 'Debt/Eq'];
    const rows = sortedStocks.map(s => [
      s.ticker,
      `"${s.company.replace(/"/g, '""')}"`,
      `"${s.sector || ''}"`,
      `"${s.industry || ''}"`,
      s.market_cap || '',
      s.price || '',
      s.pe || '',
      s.forward_pe || '',
      s.ps || '',
      s.rsi || '',
      s.volume || '',
      s.change_pct || '',
      s.profit_m || '',
      s.eps_qq || '',
      s.curr_r || '',
      s.debt_eq || ''
    ].join(','));

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `finviz_screener_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px' }}>
      
      {/* 1. Header estilo Finviz */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Layers size={22} color="var(--accent-green)" />
            Stock Screener Finviz Pro
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Filtros multicriterio descriptivos, fundamentales y técnicos sobre el universo de <strong>{stocks.length.toLocaleString('es-CO')} acciones</strong>.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={handleResetFilters} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
            <RotateCcw size={14} />
            Reset Filters
          </button>
          <button onClick={handleExportCSV} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
            <Download size={14} />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* 2. Barra de Tickers Múltiples estilo Finviz */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.75)',
        border: '1px solid var(--border-medium)',
        borderRadius: '10px',
        padding: '12px 16px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
          Tickers:
        </span>
        <div style={{ flex: 1, minWidth: '280px', position: 'relative' }}>
          <input
            type="text"
            placeholder="Introduce tickers separados por coma (ej: SNDK, MU, ASMI, NBIS, WDC, STX)..."
            value={tickerQuery}
            onChange={(e) => {
              setTickerQuery(e.target.value);
              setPage(1);
            }}
            style={{
              width: '100%',
              background: '#070b14',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              padding: '7px 12px',
              color: '#fff',
              fontSize: '0.85rem',
              fontFamily: 'monospace'
            }}
          />
        </div>
        {tickerQuery && (
          <button 
            onClick={() => setTickerQuery('')} 
            className="btn btn-secondary" 
            style={{ padding: '5px 10px', fontSize: '0.75rem' }}
          >
            Limpiar Tickers
          </button>
        )}
      </div>

      {/* 3. Panel de Filtros por Categoría */}
      <div className="glass-panel" style={{ padding: '16px', marginBottom: '20px' }}>
        
        {/* Pestañas de Filtros (Descriptive, Fundamental, Technical, All) */}
        <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', marginBottom: '16px' }}>
          <button
            className={`btn ${activeCategory === 'descriptive' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '5px 14px', fontSize: '0.8rem', fontWeight: 700 }}
            onClick={() => setActiveCategory('descriptive')}
          >
            Descriptive
          </button>
          <button
            className={`btn ${activeCategory === 'fundamental' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '5px 14px', fontSize: '0.8rem', fontWeight: 700 }}
            onClick={() => setActiveCategory('fundamental')}
          >
            Fundamental
          </button>
          <button
            className={`btn ${activeCategory === 'technical' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '5px 14px', fontSize: '0.8rem', fontWeight: 700 }}
            onClick={() => setActiveCategory('technical')}
          >
            Technical
          </button>
          <button
            className={`btn ${activeCategory === 'all' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '5px 14px', fontSize: '0.8rem', fontWeight: 700 }}
            onClick={() => setActiveCategory('all')}
          >
            All Filters
          </button>
        </div>

        {/* Rejilla de Selectores Dropdown */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '12px',
          fontSize: '0.8rem'
        }}>
          
          {/* DESCRIPTIVE FILTERS */}
          {(activeCategory === 'descriptive' || activeCategory === 'all') && (
            <>
              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '4px', fontSize: '0.75rem' }}>Sector</label>
                <select value={sectorFilter} onChange={e => { setSectorFilter(e.target.value); setPage(1); }} style={selectStyle}>
                  <option value="Any">Any</option>
                  {sectors.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '4px', fontSize: '0.75rem' }}>Country</label>
                <select value={countryFilter} onChange={e => { setCountryFilter(e.target.value); setPage(1); }} style={selectStyle}>
                  <option value="Any">Any</option>
                  {countries.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '4px', fontSize: '0.75rem' }}>Market Cap</label>
                <select value={marketCapFilter} onChange={e => { setMarketCapFilter(e.target.value); setPage(1); }} style={selectStyle}>
                  <option value="Any">Any</option>
                  <option value="Mega ($200bln+)">Mega ($200bln+)</option>
                  <option value="Large ($10bln-$200bln)">Large ($10bln-$200bln)</option>
                  <option value="Mid ($2bln-$10bln)">Mid ($2bln-$10bln)</option>
                  <option value="Small ($300mln-$2bln)">Small ($300mln-$2bln)</option>
                  <option value="Micro (under $300mln)">Micro (under $300mln)</option>
                </select>
              </div>
            </>
          )}

          {/* FUNDAMENTAL FILTERS */}
          {(activeCategory === 'fundamental' || activeCategory === 'all') && (
            <>
              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '4px', fontSize: '0.75rem' }}>P/E</label>
                <select value={peFilter} onChange={e => { setPeFilter(e.target.value); setPage(1); }} style={selectStyle}>
                  <option value="Any">Any</option>
                  <option value="Under 15">Under 15</option>
                  <option value="Under 25">Under 25</option>
                  <option value="Under 50">Under 50</option>
                  <option value="Over 50">Over 50</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '4px', fontSize: '0.75rem' }}>Forward P/E</label>
                <select value={forwardPeFilter} onChange={e => { setForwardPeFilter(e.target.value); setPage(1); }} style={selectStyle}>
                  <option value="Any">Any</option>
                  <option value="Under 15">Under 15</option>
                  <option value="Under 20">Under 20</option>
                  <option value="Under 30">Under 30</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '4px', fontSize: '0.75rem' }}>PEG</label>
                <select value={pegFilter} onChange={e => { setPegFilter(e.target.value); setPage(1); }} style={selectStyle}>
                  <option value="Any">Any</option>
                  <option value="Under 1">Under 1</option>
                  <option value="Under 2">Under 2</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '4px', fontSize: '0.75rem' }}>Current Ratio</label>
                <select value={currentRatioFilter} onChange={e => { setCurrentRatioFilter(e.target.value); setPage(1); }} style={selectStyle}>
                  <option value="Any">Any</option>
                  <option value="Over 1">Over 1</option>
                  <option value="Over 1.5">Over 1.5</option>
                  <option value="Over 2">Over 2</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '4px', fontSize: '0.75rem' }}>Quick Ratio</label>
                <select value={quickRatioFilter} onChange={e => { setQuickRatioFilter(e.target.value); setPage(1); }} style={selectStyle}>
                  <option value="Any">Any</option>
                  <option value="Over 1">Over 1</option>
                  <option value="Over 1.5">Over 1.5</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '4px', fontSize: '0.75rem' }}>EPS Growth Q/Q</label>
                <select value={epsGrowthQtrFilter} onChange={e => { setEpsGrowthQtrFilter(e.target.value); setPage(1); }} style={selectStyle}>
                  <option value="Any">Any</option>
                  <option value="Over 10%">Over 10%</option>
                  <option value="Over 15%">Over 15%</option>
                  <option value="Over 25%">Over 25%</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '4px', fontSize: '0.75rem' }}>EPS Growth TTM</label>
                <select value={epsGrowthTtmFilter} onChange={e => { setEpsGrowthTtmFilter(e.target.value); setPage(1); }} style={selectStyle}>
                  <option value="Any">Any</option>
                  <option value="Over 10%">Over 10%</option>
                  <option value="Over 15%">Over 15%</option>
                  <option value="Over 25%">Over 25%</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '4px', fontSize: '0.75rem' }}>Net Profit Margin</label>
                <select value={profitMarginFilter} onChange={e => { setProfitMarginFilter(e.target.value); setPage(1); }} style={selectStyle}>
                  <option value="Any">Any</option>
                  <option value="Positive (>0%)">Positive (&gt;0%)</option>
                  <option value="Over 15%">Over 15%</option>
                  <option value="Over 20%">Over 20%</option>
                </select>
              </div>
            </>
          )}

          {/* TECHNICAL FILTERS */}
          {(activeCategory === 'technical' || activeCategory === 'all') && (
            <>
              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '4px', fontSize: '0.75rem' }}>RSI (14)</label>
                <select value={rsiFilter} onChange={e => { setRsiFilter(e.target.value); setPage(1); }} style={selectStyle}>
                  <option value="Any">Any</option>
                  <option value="Oversold (30)">Sobrevendido (&lt; 30)</option>
                  <option value="Bullish (50-70)">Zona Alcista (50-70)</option>
                  <option value="Overbought (70)">Sobrecomprado (&gt; 70)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '4px', fontSize: '0.75rem' }}>Cambio % Hoy</label>
                <select value={changePctFilter} onChange={e => { setChangePctFilter(e.target.value); setPage(1); }} style={selectStyle}>
                  <option value="Any">Any</option>
                  <option value="Up">En Alza (&gt; 0%)</option>
                  <option value="Down">En Baja (&lt; 0%)</option>
                  <option value="Up 3%+">Fuerte Alza (+3%+)</option>
                  <option value="Down 3%+">Fuerte Baja (-3%+)</option>
                </select>
              </div>
            </>
          )}

        </div>
      </div>

      {/* 4. Sub-vistas de Tabla estilo Finviz (Overview, Valuation, Financial, etc.) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '3px', background: 'var(--bg-surface)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
          {(['overview', 'valuation', 'financial', 'performance', 'technical', 'custom'] as const).map(tab => (
            <button
              key={tab}
              className={`btn ${tableView === tab ? 'btn-active' : 'btn-secondary'}`}
              style={{ padding: '4px 10px', fontSize: '0.75rem', textTransform: 'capitalize' }}
              onClick={() => setTableView(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Mostrando <strong>{filteredStocks.length.toLocaleString('es-CO')}</strong> resultados · Página {page} de {totalPages}
        </div>
      </div>

      {/* 5. Tabla de Resultados estilo Finviz */}
      <div className="table-container" style={{ borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
        <table className="data-table" style={{ fontSize: '0.8rem' }}>
          <thead>
            <tr>
              <th onClick={() => handleSort('ticker')} style={{ cursor: 'pointer' }}>
                Ticker {sortField === 'ticker' && (sortAsc ? '▲' : '▼')}
              </th>
              <th onClick={() => handleSort('company')} style={{ cursor: 'pointer' }}>
                Company {sortField === 'company' && (sortAsc ? '▲' : '▼')}
              </th>
              <th onClick={() => handleSort('sector')} style={{ cursor: 'pointer' }}>
                Sector {sortField === 'sector' && (sortAsc ? '▲' : '▼')}
              </th>
              <th onClick={() => handleSort('industry')} style={{ cursor: 'pointer' }}>
                Industry {sortField === 'industry' && (sortAsc ? '▲' : '▼')}
              </th>
              <th onClick={() => handleSort('market_cap')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                Market Cap {sortField === 'market_cap' && (sortAsc ? '▲' : '▼')}
              </th>
              <th onClick={() => handleSort('price')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                Price {sortField === 'price' && (sortAsc ? '▲' : '▼')}
              </th>
              <th onClick={() => handleSort('change_pct')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                Change % {sortField === 'change_pct' && (sortAsc ? '▲' : '▼')}
              </th>

              {/* Columnas según vista */}
              {tableView === 'overview' && (
                <>
                  <th onClick={() => handleSort('pe')} style={{ cursor: 'pointer', textAlign: 'right' }}>P/E</th>
                  <th onClick={() => handleSort('forward_pe')} style={{ cursor: 'pointer', textAlign: 'right' }}>Fwd P/E</th>
                  <th onClick={() => handleSort('peg')} style={{ cursor: 'pointer', textAlign: 'right' }}>PEG</th>
                  <th onClick={() => handleSort('ps')} style={{ cursor: 'pointer', textAlign: 'right' }}>P/S</th>
                  <th onClick={() => handleSort('volume')} style={{ cursor: 'pointer', textAlign: 'right' }}>Volume</th>
                </>
              )}

              {tableView === 'valuation' && (
                <>
                  <th onClick={() => handleSort('pe')} style={{ cursor: 'pointer', textAlign: 'right' }}>P/E</th>
                  <th onClick={() => handleSort('forward_pe')} style={{ cursor: 'pointer', textAlign: 'right' }}>Fwd P/E</th>
                  <th onClick={() => handleSort('peg')} style={{ cursor: 'pointer', textAlign: 'right' }}>PEG</th>
                  <th onClick={() => handleSort('ps')} style={{ cursor: 'pointer', textAlign: 'right' }}>P/S</th>
                  <th onClick={() => handleSort('ev_ebitda')} style={{ cursor: 'pointer', textAlign: 'right' }}>EV/EBITDA</th>
                </>
              )}

              {tableView === 'financial' && (
                <>
                  <th onClick={() => handleSort('profit_m')} style={{ cursor: 'pointer', textAlign: 'right' }}>Profit M</th>
                  <th onClick={() => handleSort('roic')} style={{ cursor: 'pointer', textAlign: 'right' }}>ROIC</th>
                  <th onClick={() => handleSort('curr_r')} style={{ cursor: 'pointer', textAlign: 'right' }}>Curr R</th>
                  <th onClick={() => handleSort('quick_r')} style={{ cursor: 'pointer', textAlign: 'right' }}>Quick R</th>
                  <th onClick={() => handleSort('debt_eq')} style={{ cursor: 'pointer', textAlign: 'right' }}>Debt/Eq</th>
                </>
              )}

              {tableView === 'performance' && (
                <>
                  <th onClick={() => handleSort('perf_week')} style={{ cursor: 'pointer', textAlign: 'right' }}>Perf Week</th>
                  <th onClick={() => handleSort('perf_month')} style={{ cursor: 'pointer', textAlign: 'right' }}>Perf Month</th>
                  <th onClick={() => handleSort('perf_quart')} style={{ cursor: 'pointer', textAlign: 'right' }}>Perf Quart</th>
                  <th onClick={() => handleSort('perf_year')} style={{ cursor: 'pointer', textAlign: 'right' }}>Perf Year</th>
                  <th onClick={() => handleSort('perf_ytd')} style={{ cursor: 'pointer', textAlign: 'right' }}>Perf YTD</th>
                </>
              )}

              {tableView === 'technical' && (
                <>
                  <th onClick={() => handleSort('rsi')} style={{ cursor: 'pointer', textAlign: 'right' }}>RSI (14)</th>
                  <th onClick={() => handleSort('sma20')} style={{ cursor: 'pointer', textAlign: 'right' }}>SMA20</th>
                  <th onClick={() => handleSort('sma50')} style={{ cursor: 'pointer', textAlign: 'right' }}>SMA50</th>
                  <th onClick={() => handleSort('sma200')} style={{ cursor: 'pointer', textAlign: 'right' }}>SMA200</th>
                  <th onClick={() => handleSort('rel_volume')} style={{ cursor: 'pointer', textAlign: 'right' }}>Rel Vol</th>
                </>
              )}

              {tableView === 'custom' && (
                <>
                  <th onClick={() => handleSort('eps_qq')} style={{ cursor: 'pointer', textAlign: 'right' }}>EPS Q/Q</th>
                  <th onClick={() => handleSort('eps_yoy_ttm')} style={{ cursor: 'pointer', textAlign: 'right' }}>EPS YoY</th>
                  <th onClick={() => handleSort('sales_yoy_ttm')} style={{ cursor: 'pointer', textAlign: 'right' }}>Sales YoY</th>
                  <th onClick={() => handleSort('profit_m')} style={{ cursor: 'pointer', textAlign: 'right' }}>Profit M</th>
                  <th onClick={() => handleSort('target_price')} style={{ cursor: 'pointer', textAlign: 'right' }}>Target Price</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {paginatedStocks.length === 0 ? (
              <tr>
                <td colSpan={12} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                  No se encontraron acciones que coincidan con los filtros seleccionados.
                </td>
              </tr>
            ) : (
              paginatedStocks.map((stock) => (
                <tr 
                  key={stock.ticker}
                  onClick={() => onSelectStock(stock)}
                  style={{ cursor: 'pointer' }}
                  className="data-row-hover"
                >
                  <td className="font-mono" style={{ fontWeight: 800, color: 'var(--accent-cyan)' }}>
                    {stock.ticker}
                  </td>
                  <td style={{ color: '#fff', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {stock.company}
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {stock.sector || '—'}
                  </td>
                  <td style={{ color: 'var(--text-muted)', maxWidth: '160px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {stock.industry || '—'}
                  </td>
                  <td className="font-mono" style={{ textAlign: 'right', color: '#fff' }}>
                    {stock.market_cap ? (stock.market_cap >= 1000 ? `$${(stock.market_cap / 1000).toFixed(1)}B` : `$${stock.market_cap.toFixed(0)}M`) : '—'}
                  </td>
                  <td className="font-mono" style={{ textAlign: 'right', fontWeight: 700, color: '#fff' }}>
                    ${stock.price ? stock.price.toFixed(2) : '—'}
                  </td>
                  <td className="font-mono" style={{ textAlign: 'right' }}>
                    {stock.change_pct !== undefined && stock.change_pct !== null ? (
                      <span className={stock.change_pct >= 0 ? 'delta-positive' : 'delta-negative'}>
                        {stock.change_pct >= 0 ? '+' : ''}{stock.change_pct.toFixed(2)}%
                      </span>
                    ) : '—'}
                  </td>

                  {/* Celdas condicionales por vista */}
                  {tableView === 'overview' && (
                    <>
                      <td className="font-mono" style={{ textAlign: 'right' }}>{stock.pe ? `${stock.pe.toFixed(1)}x` : '—'}</td>
                      <td className="font-mono" style={{ textAlign: 'right' }}>{stock.forward_pe ? `${stock.forward_pe.toFixed(1)}x` : '—'}</td>
                      <td className="font-mono" style={{ textAlign: 'right' }}>{stock.peg ? stock.peg.toFixed(2) : '—'}</td>
                      <td className="font-mono" style={{ textAlign: 'right' }}>{stock.ps ? `${stock.ps.toFixed(1)}x` : '—'}</td>
                      <td className="font-mono" style={{ textAlign: 'right' }}>{stock.volume ? `${(stock.volume / 1e6).toFixed(2)}M` : '—'}</td>
                    </>
                  )}

                  {tableView === 'valuation' && (
                    <>
                      <td className="font-mono" style={{ textAlign: 'right' }}>{stock.pe ? `${stock.pe.toFixed(1)}x` : '—'}</td>
                      <td className="font-mono" style={{ textAlign: 'right' }}>{stock.forward_pe ? `${stock.forward_pe.toFixed(1)}x` : '—'}</td>
                      <td className="font-mono" style={{ textAlign: 'right' }}>{stock.peg ? stock.peg.toFixed(2) : '—'}</td>
                      <td className="font-mono" style={{ textAlign: 'right' }}>{stock.ps ? `${stock.ps.toFixed(1)}x` : '—'}</td>
                      <td className="font-mono" style={{ textAlign: 'right' }}>{stock.ev_ebitda ? `${stock.ev_ebitda.toFixed(1)}x` : '—'}</td>
                    </>
                  )}

                  {tableView === 'financial' && (
                    <>
                      <td className="font-mono" style={{ textAlign: 'right' }}>{stock.profit_m !== undefined ? `${stock.profit_m.toFixed(1)}%` : '—'}</td>
                      <td className="font-mono" style={{ textAlign: 'right' }}>{stock.roic !== undefined ? `${stock.roic.toFixed(1)}%` : '—'}</td>
                      <td className="font-mono" style={{ textAlign: 'right' }}>{stock.curr_r ? stock.curr_r.toFixed(2) : '—'}</td>
                      <td className="font-mono" style={{ textAlign: 'right' }}>{stock.quick_r ? stock.quick_r.toFixed(2) : '—'}</td>
                      <td className="font-mono" style={{ textAlign: 'right' }}>{stock.debt_eq ? stock.debt_eq.toFixed(2) : '—'}</td>
                    </>
                  )}

                  {tableView === 'performance' && (
                    <>
                      <td className="font-mono" style={{ textAlign: 'right' }}>{formatPct(stock.perf_week)}</td>
                      <td className="font-mono" style={{ textAlign: 'right' }}>{formatPct(stock.perf_month)}</td>
                      <td className="font-mono" style={{ textAlign: 'right' }}>{formatPct(stock.perf_quart)}</td>
                      <td className="font-mono" style={{ textAlign: 'right' }}>{formatPct(stock.perf_year)}</td>
                      <td className="font-mono" style={{ textAlign: 'right' }}>{formatPct(stock.perf_ytd)}</td>
                    </>
                  )}

                  {tableView === 'technical' && (
                    <>
                      <td className="font-mono" style={{ textAlign: 'right' }}>{stock.rsi ? stock.rsi.toFixed(1) : '—'}</td>
                      <td className="font-mono" style={{ textAlign: 'right' }}>{formatPct(stock.sma20)}</td>
                      <td className="font-mono" style={{ textAlign: 'right' }}>{formatPct(stock.sma50)}</td>
                      <td className="font-mono" style={{ textAlign: 'right' }}>{formatPct(stock.sma200)}</td>
                      <td className="font-mono" style={{ textAlign: 'right' }}>{stock.rel_volume ? `${stock.rel_volume.toFixed(2)}x` : '—'}</td>
                    </>
                  )}

                  {tableView === 'custom' && (
                    <>
                      <td className="font-mono" style={{ textAlign: 'right' }}>{formatPct(stock.eps_qq)}</td>
                      <td className="font-mono" style={{ textAlign: 'right' }}>{formatPct(stock.eps_yoy_ttm)}</td>
                      <td className="font-mono" style={{ textAlign: 'right' }}>{formatPct(stock.sales_yoy_ttm)}</td>
                      <td className="font-mono" style={{ textAlign: 'right' }}>{stock.profit_m !== undefined ? `${stock.profit_m.toFixed(1)}%` : '—'}</td>
                      <td className="font-mono" style={{ textAlign: 'right' }}>${stock.target_price ? stock.target_price.toFixed(2) : '—'}</td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '20px' }}>
          <button 
            disabled={page === 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className="btn btn-secondary"
            style={{ padding: '5px 12px', fontSize: '0.8rem' }}
          >
            Anterior
          </button>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Página {page} de {totalPages}
          </span>
          <button 
            disabled={page === totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            className="btn btn-secondary"
            style={{ padding: '5px 12px', fontSize: '0.8rem' }}
          >
            Siguiente
          </button>
        </div>
      )}

    </div>
  );
};

const selectStyle: React.CSSProperties = {
  width: '100%',
  background: '#070b14',
  border: '1px solid var(--border-subtle)',
  borderRadius: '6px',
  padding: '6px 10px',
  color: '#fff',
  fontSize: '0.78rem',
  outline: 'none'
};

function formatPct(val?: number) {
  if (val === undefined || val === null) return '—';
  return (
    <span className={val >= 0 ? 'delta-positive' : 'delta-negative'}>
      {val >= 0 ? '+' : ''}{val.toFixed(2)}%
    </span>
  );
}
