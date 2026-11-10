import React, { useState, useMemo, useEffect } from 'react';
import { 
  Download, 
  Search, 
  Eye, 
  TrendingUp, 
  DollarSign, 
  ShieldCheck, 
  Layers,
  Sparkles,
  Bot,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  RotateCcw,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import type { StockRecord } from '../types/stock';
import type { ScreenerUIFilterPayload } from '../types/agent';
import { parseNaturalLanguageToScreenerFilters } from '../services/agentRagService';
import { calculateFactorGrades } from '../utils/quantRatings';
import { formatCurrencyUSD, formatPercentage, formatVolumeShares } from '../utils/formatters';

interface StockScreenerProps {
  stocks: StockRecord[];
  onSelectStock: (stock: StockRecord) => void;
  selectedStock?: StockRecord | null;
  externalAIFilters?: { filters: ScreenerUIFilterPayload; timestamp: number } | null;
  onOpenAgentDrawerWithQuery?: (query: string) => void;
}

export type SortField = keyof StockRecord | 'quant_rating';
type FilterCategory = 'descriptive' | 'fundamental' | 'technical' | 'all';
type TableView = 'custom' | 'overview' | 'valuation' | 'financial' | 'performance' | 'technical';

export const StockScreener: React.FC<StockScreenerProps> = ({
  stocks,
  onSelectStock,
  selectedStock,
  externalAIFilters,
  onOpenAgentDrawerWithQuery
}) => {
  // Consulta en lenguaje natural dentro del Screener (Fase 3)
  const [nlQuery, setNlQuery] = useState('');
  const [appliedAISummary, setAppliedAISummary] = useState<string | null>(null);
  // Pestaña de filtros activa y vista de tabla (Custom por defecto según especificación)
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('fundamental');
  const [tableView, setTableView] = useState<TableView>('custom');

  // Filtro por lista de tickers separados por coma (ej: SNDK, MU, ASMI, NBIS...)
  const [tickerQuery, setTickerQuery] = useState('');

  // Preset estratégico rápido
  const [presetFilter, setPresetFilter] = useState('ALL');

  // Filtros Descriptivos
  const [sectorFilter, setSectorFilter] = useState('Any');
  const [industryFilter, setIndustryFilter] = useState('Any');
  const [countryFilter, setCountryFilter] = useState('Any');
  const [marketCapFilter, setMarketCapFilter] = useState('Any');
  const [indexFilter, setIndexFilter] = useState('Any');

  // Filtros Fundamentales
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

  // Filtros Técnicos
  const [rsiFilter, setRsiFilter] = useState('Any');
  const [sma20Filter, setSma20Filter] = useState('Any');
  const [sma50Filter, setSma50Filter] = useState('Any');
  const [sma200Filter, setSma200Filter] = useState('Any');
  const [changePctFilter, setChangePctFilter] = useState('Any');

  // Ordenación de tabla (por defecto Capitalización Bursátil descendente)
  const [sortField, setSortField] = useState<SortField>('market_cap');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Paginación
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Listas únicas para selects descriptivos
  const sectors = useMemo(() => {
    const set = new Set<string>();
    stocks.forEach(s => { if (s.sector) set.add(s.sector); });
    return Array.from(set).sort();
  }, [stocks]);

  const industries = useMemo(() => {
    const set = new Set<string>();
    stocks.forEach(s => { if (s.industry) set.add(s.industry); });
    return Array.from(set).sort();
  }, [stocks]);

  const countries = useMemo(() => {
    const set = new Set<string>();
    stocks.forEach(s => { if (s.country) set.add(s.country); });
    return Array.from(set).sort();
  }, [stocks]);

  // Contador de filtros activos
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (tickerQuery.trim()) count++;
    if (presetFilter !== 'ALL') count++;
    if (sectorFilter !== 'Any') count++;
    if (industryFilter !== 'Any') count++;
    if (countryFilter !== 'Any') count++;
    if (marketCapFilter !== 'Any') count++;
    if (indexFilter !== 'Any') count++;
    if (peFilter !== 'Any') count++;
    if (forwardPeFilter !== 'Any') count++;
    if (pegFilter !== 'Any') count++;
    if (psFilter !== 'Any') count++;
    if (epsGrowthQtrFilter !== 'Any') count++;
    if (epsGrowthTtmFilter !== 'Any') count++;
    if (salesGrowthQtrFilter !== 'Any') count++;
    if (salesGrowthTtmFilter !== 'Any') count++;
    if (currentRatioFilter !== 'Any') count++;
    if (quickRatioFilter !== 'Any') count++;
    if (debtEquityFilter !== 'Any') count++;
    if (profitMarginFilter !== 'Any') count++;
    if (roicFilter !== 'Any') count++;
    if (rsiFilter !== 'Any') count++;
    if (sma20Filter !== 'Any') count++;
    if (sma50Filter !== 'Any') count++;
    if (sma200Filter !== 'Any') count++;
    if (changePctFilter !== 'Any') count++;
    return count;
  }, [
    tickerQuery, presetFilter, sectorFilter, industryFilter, countryFilter, marketCapFilter, indexFilter,
    peFilter, forwardPeFilter, pegFilter, psFilter, epsGrowthQtrFilter, epsGrowthTtmFilter,
    salesGrowthQtrFilter, salesGrowthTtmFilter, currentRatioFilter, quickRatioFilter,
    debtEquityFilter, profitMarginFilter, roicFilter, rsiFilter, sma20Filter, sma50Filter, sma200Filter, changePctFilter
  ]);

  // Reset Completo de Filtros
  const handleResetFilters = () => {
    setTickerQuery('');
    setPresetFilter('ALL');
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
    setAppliedAISummary(null);
    setPage(1);
  };

  // Fase 3: Aplicar payload de filtros generado por Lenguaje Natural IA
  const applyAIFilterPayload = (payload: ScreenerUIFilterPayload) => {
    // Primero limpiar filtros previos
    setPresetFilter('ALL');
    setSectorFilter(payload.sectorFilter || 'Any');
    setIndustryFilter('Any');
    setCountryFilter('Any');
    setMarketCapFilter(payload.marketCapFilter || 'Any');
    setIndexFilter('Any');
    setPeFilter(payload.peFilter || 'Any');
    setForwardPeFilter(payload.forwardPeFilter || 'Any');
    setPegFilter(payload.pegFilter || 'Any');
    setPsFilter('Any');
    setEpsGrowthQtrFilter(payload.epsGrowthQtrFilter || 'Any');
    setEpsGrowthTtmFilter('Any');
    setSalesGrowthQtrFilter('Any');
    setSalesGrowthTtmFilter(payload.salesGrowthTtmFilter || 'Any');
    setCurrentRatioFilter(payload.currentRatioFilter || 'Any');
    setQuickRatioFilter('Any');
    setDebtEquityFilter(payload.debtEquityFilter || 'Any');
    setProfitMarginFilter(payload.profitMarginFilter || 'Any');
    setRoicFilter(payload.roicFilter || 'Any');
    setRsiFilter(payload.rsiFilter || 'Any');
    setSma20Filter('Any');
    setSma50Filter(payload.sma50Filter || 'Any');
    setSma200Filter(payload.sma200Filter || 'Any');
    setChangePctFilter('Any');
    if (payload.tickerQuery !== undefined) {
      setTickerQuery(payload.tickerQuery);
    }
    setActiveCategory('all');
    setAppliedAISummary(payload.summaryText || 'Filtros cuantitativos aplicados por IA');
    setPage(1);
  };

  const handleApplyNaturalLanguage = (customText?: string) => {
    const query = (customText ?? nlQuery).trim();
    if (!query) return;
    if (customText) setNlQuery(customText);
    const parsed = parseNaturalLanguageToScreenerFilters(query);
    applyAIFilterPayload(parsed);
    toast.success(`Filtro IA aplicado: ${parsed.summaryText}`);
  };

  // Escuchar filtros enviados desde el Drawer del Agente Inversor IA
  useEffect(() => {
    if (externalAIFilters && externalAIFilters.filters) {
      applyAIFilterPayload(externalAIFilters.filters);
      toast.success(`Screener sincronizado desde el Agente IA: ${externalAIFilters.filters.summaryText || ''}`);
    }
  }, [externalAIFilters?.timestamp]);

  // Motor de Filtrado y Ordenación
  const filteredStocks = useMemo(() => {
    return stocks.filter(stock => {
      // 1. Filtro por lista de tickers múltiples (ej: "MU, NVDA, AAPL")
      if (tickerQuery.trim()) {
        const queryTickers = tickerQuery
          .toUpperCase()
          .split(/[\s,]+/)
          .map(t => t.trim())
          .filter(Boolean);

        if (queryTickers.length > 0 && !queryTickers.includes(stock.ticker.toUpperCase())) {
          return false;
        }
      }

      // 2. Presets estratégicos rápidos
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
        const mcapInDollars = stock.market_cap ? (stock.market_cap > 1e6 ? stock.market_cap : stock.market_cap * 1e6) : 0;
        if (mcapInDollars < 50e9) return false;
      }

      // 3. Filtros Descriptivos
      if (sectorFilter !== 'Any' && stock.sector !== sectorFilter) return false;
      if (industryFilter !== 'Any' && stock.industry !== industryFilter) return false;
      if (countryFilter !== 'Any' && stock.country !== countryFilter) return false;
      if (indexFilter !== 'Any' && stock.index_name !== indexFilter) return false;

      if (marketCapFilter !== 'Any') {
        const mcapInDollars = stock.market_cap ? (stock.market_cap > 1e6 ? stock.market_cap : stock.market_cap * 1e6) : 0;
        if (marketCapFilter === 'Mega ($200bln+)' && mcapInDollars < 200e9) return false;
        if (marketCapFilter === 'Large ($10bln-$200bln)' && (mcapInDollars < 10e9 || mcapInDollars >= 200e9)) return false;
        if (marketCapFilter === 'Mid ($2bln-$10bln)' && (mcapInDollars < 2e9 || mcapInDollars >= 10e9)) return false;
        if (marketCapFilter === 'Small ($300mln-$2bln)' && (mcapInDollars < 300e6 || mcapInDollars >= 2e9)) return false;
        if (marketCapFilter === 'Micro (under $300mln)' && mcapInDollars >= 300e6) return false;
      }

      // 4. Filtros Fundamentales
      if (peFilter !== 'Any') {
        const pe = stock.pe;
        if (pe === undefined || pe === null || pe <= 0) return false;
        if (peFilter === 'Under 15' && pe >= 15) return false;
        if (peFilter === 'Under 20' && pe >= 20) return false;
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

      if (psFilter !== 'Any') {
        const ps = stock.ps;
        if (ps === undefined || ps === null || ps <= 0) return false;
        if (psFilter === 'Under 1' && ps >= 1) return false;
        if (psFilter === 'Under 3' && ps >= 3) return false;
        if (psFilter === 'Over 5' && ps <= 5) return false;
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

      if (salesGrowthQtrFilter !== 'Any') {
        const sq = stock.sales_qq;
        if (sq === undefined || sq === null) return false;
        if (salesGrowthQtrFilter === 'Over 10%' && sq < 10) return false;
        if (salesGrowthQtrFilter === 'Over 20%' && sq < 20) return false;
      }

      if (salesGrowthTtmFilter !== 'Any') {
        const sttm = stock.sales_yoy_ttm;
        if (sttm === undefined || sttm === null) return false;
        if (salesGrowthTtmFilter === 'Over 10%' && sttm < 10) return false;
        if (salesGrowthTtmFilter === 'Over 20%' && sttm < 20) return false;
      }

      if (profitMarginFilter !== 'Any') {
        const pm = stock.profit_m;
        if (pm === undefined || pm === null) return false;
        if (profitMarginFilter === 'Positive (>0%)' && pm <= 0) return false;
        if (profitMarginFilter === 'Over 15%' && pm < 15) return false;
        if (profitMarginFilter === 'Over 20%' && pm < 20) return false;
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

      // 5. Filtros Técnicos
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

      if (sma20Filter !== 'Any') {
        const val = stock.sma20;
        if (val === undefined || val === null) return false;
        if (sma20Filter === 'Price above SMA20' && val <= 0) return false;
        if (sma20Filter === 'Price below SMA20' && val >= 0) return false;
      }

      if (sma50Filter !== 'Any') {
        const val = stock.sma50;
        if (val === undefined || val === null) return false;
        if (sma50Filter === 'Price above SMA50' && val <= 0) return false;
        if (sma50Filter === 'Price below SMA50' && val >= 0) return false;
      }

      if (sma200Filter !== 'Any') {
        const val = stock.sma200;
        if (val === undefined || val === null) return false;
        if (sma200Filter === 'Price above SMA200' && val <= 0) return false;
        if (sma200Filter === 'Price below SMA200' && val >= 0) return false;
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
  }, [
    stocks, tickerQuery, presetFilter, sectorFilter, industryFilter, countryFilter, marketCapFilter, indexFilter,
    peFilter, forwardPeFilter, pegFilter, psFilter, epsGrowthQtrFilter, epsGrowthTtmFilter,
    salesGrowthQtrFilter, salesGrowthTtmFilter, currentRatioFilter, quickRatioFilter,
    debtEquityFilter, profitMarginFilter, roicFilter, rsiFilter, sma20Filter, sma50Filter, sma200Filter,
    changePctFilter, sortField, sortAsc
  ]);

  const totalPages = Math.ceil(filteredStocks.length / pageSize);
  const paginatedStocks = filteredStocks.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      const defaultDesc = [
        'market_cap', 'price', 'volume', 'roic', 'profit_m', 'change_pct',
        'quant_rating', 'sales', 'eps_qq', 'sales_yoy_ttm', 'eps_past_5y', 'eps'
      ].includes(field);
      setSortAsc(!defaultDesc);
    }
  };

  const handleExportCSV = () => {
    if (!filteredStocks.length) return;
    const headers = [
      'Ticker', 'Company', 'Sector', 'Industry', 'Market Cap (USD)', 'Price',
      'P/E', 'Forward P/E', 'PEG', 'P/S', 'RSI', 'EV/EBITDA', 'Volume', 'Change %',
      'EPS Past 5Y', 'Profit Margin', 'EPS Q/Q', 'Target Price', 'Current Ratio',
      'Debt/Equity', 'EPS', 'EPS Past 3Y', 'ROIC', 'SMA200 %', 'Sales (USD)', 'Sales YoY TTM',
      'Quant Score', 'Quant Rating'
    ];

    const rows = filteredStocks.map(s => {
      const q = calculateFactorGrades(s);
      return [
        s.ticker,
        `"${s.company || ''}"`,
        `"${s.sector || ''}"`,
        `"${s.industry || ''}"`,
        s.market_cap || '',
        s.price || '',
        s.pe || '',
        s.forward_pe || '',
        s.peg || '',
        s.ps || '',
        s.rsi || '',
        s.ev_ebitda || '',
        s.volume || '',
        s.change_pct || '',
        s.eps_past_5y || '',
        s.profit_m || '',
        s.eps_qq || '',
        s.target_price || '',
        s.curr_r || '',
        s.debt_eq || '',
        s.eps || '',
        s.eps_past_3y || '',
        s.roic || '',
        s.sma200 || '',
        s.sales || '',
        s.sales_yoy_ttm || '',
        q.quantScore,
        `"${q.quantRating}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `screener_acciones_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectStyle: React.CSSProperties = {
    width: '100%',
    background: '#070b14',
    border: '1px solid var(--border-subtle)',
    borderRadius: '6px',
    padding: '6px 10px',
    color: '#fff',
    fontSize: '0.78rem'
  };

  return (
    <div style={{ maxWidth: '100%', margin: '0 auto', padding: '16px 20px' }} className="animate-fade-in">
      
      {/* 1. Cabecera Principal y Exportación */}
      <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Layers size={22} color="var(--accent-green)" />
              Screener acciones
            </h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Filtrado cuantitativo institucional multicriterio sobre <strong>{stocks.length.toLocaleString('es-CO')} acciones</strong> globales.
              Mostrando <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>{filteredStocks.length}</span> coincidencias.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button 
              onClick={handleResetFilters} 
              className="btn btn-secondary" 
              style={{ padding: '6px 12px', fontSize: '0.78rem' }}
              title="Restablecer todos los filtros"
            >
              <RotateCcw size={13} />
              Reset Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
            </button>
            <button 
              onClick={handleExportCSV} 
              className="btn btn-secondary" 
              style={{ padding: '6px 12px', fontSize: '0.78rem' }}
              title="Descargar tabla en archivo CSV"
            >
              <Download size={13} />
              Exportar CSV ({filteredStocks.length})
            </button>
          </div>
        </div>

        {/* Barra de Tickers Múltiples (Estándar Finviz Tickers) */}
        <div style={{
          marginTop: '12px',
          padding: '10px 14px',
          background: 'rgba(7, 11, 20, 0.75)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: '0.80rem', fontWeight: 800, color: 'var(--accent-cyan)', whiteSpace: 'nowrap' }}>
            Tickers:
          </span>
          <div style={{ flex: 1, minWidth: '260px', position: 'relative' }}>
            <input
              type="text"
              placeholder="Introduce tickers separados por coma o espacio (ej: SNDK, MU, ASMI, NBIS, WDC, STX)..."
              value={tickerQuery}
              onChange={(e) => {
                setTickerQuery(e.target.value);
                setPage(1);
              }}
              style={{
                width: '100%',
                background: '#040711',
                border: '1px solid var(--border-medium)',
                borderRadius: '6px',
                padding: '6px 12px',
                color: '#fff',
                fontSize: '0.82rem',
                fontFamily: 'monospace'
              }}
            />
          </div>
          {tickerQuery && (
            <button 
              onClick={() => { setTickerQuery(''); setPage(1); }} 
              className="btn btn-secondary" 
              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
            >
              Limpiar Tickers
            </button>
          )}
        </div>

        {/* Fase 3: Barra de Filtrado por Lenguaje Natural con IA */}
        <div
          style={{
            marginTop: '10px',
            padding: '10px 14px',
            background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.08) 0%, rgba(6, 182, 212, 0.08) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.28)',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: 800,
                color: '#34d399',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                whiteSpace: 'nowrap',
              }}
            >
              <Sparkles size={14} color="#34d399" />
              Filtro Lenguaje Natural IA:
            </span>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleApplyNaturalLanguage();
              }}
              style={{ flex: 1, minWidth: '280px', display: 'flex', gap: '8px' }}
            >
              <input
                type="text"
                placeholder="Ej: Empresas tecnológicas con ROIC > 15%, margen > 20% y baja deuda..."
                value={nlQuery}
                onChange={(e) => setNlQuery(e.target.value)}
                style={{
                  flex: 1,
                  background: '#040711',
                  border: '1px solid rgba(52, 211, 153, 0.35)',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  color: '#fff',
                  fontSize: '0.8rem',
                }}
              />
              <button
                type="submit"
                className="btn"
                style={{
                  padding: '6px 14px',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #059669 0%, #0284c7 100%)',
                  color: '#fff',
                  border: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                Aplicar Filtro IA
              </button>
              {onOpenAgentDrawerWithQuery && (
                <button
                  type="button"
                  onClick={() =>
                    onOpenAgentDrawerWithQuery(
                      nlQuery.trim() ||
                        'Busca las mejores acciones del mercado con ROIC > 20%, margen neto alto y deuda controlada.'
                    )
                  }
                  className="btn btn-secondary"
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    whiteSpace: 'nowrap',
                  }}
                  title="Analizar los resultados en el panel del Agente Inversor IA"
                >
                  <Bot size={13} color="#38bdf8" />
                  Consultar Agente IA
                </button>
              )}
            </form>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>Ejemplos rápidos:</span>
              {[
                'Tecnológicas con ROIC > 15%, margen > 20% y baja deuda',
                'Acciones infravaloradas con PEG < 1 y alto ROIC',
                'Financieras grandes con margen > 20% y tendencia sobre SMA 50',
                'Salud con ROIC > 15% y buena liquidez',
              ].map((example, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyNaturalLanguage(example)}
                  style={{
                    background: 'rgba(15, 23, 42, 0.85)',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '999px',
                    padding: '2px 9px',
                    fontSize: '0.68rem',
                    color: '#cbd5e1',
                    cursor: 'pointer',
                  }}
                >
                  {example}
                </button>
              ))}
            </div>

            {appliedAISummary && (
              <div
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: '#34d399',
                  background: 'rgba(16, 185, 129, 0.14)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                }}
              >
                ✓ Activo: {appliedAISummary}
              </div>
            )}
          </div>
        </div>

        {/* Presets Rápidos de Estrategia Institucional */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginRight: '4px' }}>
            Presets:
          </span>
          <button 
            className={`btn ${presetFilter === 'ALL' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '4px 10px', fontSize: '0.74rem' }}
            onClick={() => { setPresetFilter('ALL'); setPage(1); }}
          >
            Todas ({stocks.length})
          </button>
          <button 
            className={`btn ${presetFilter === 'STRATEGY' ? 'btn-active' : 'btn-secondary'}`}
            style={{ 
              padding: '4px 10px', 
              fontSize: '0.74rem',
              border: presetFilter === 'STRATEGY' ? '1px solid var(--accent-green)' : '1px solid rgba(16, 185, 129, 0.35)',
              color: presetFilter === 'STRATEGY' ? '#fff' : 'var(--accent-green)'
            }}
            onClick={() => { setPresetFilter('STRATEGY'); setPage(1); }}
          >
            <Sparkles size={12} color="var(--accent-green)" />
            Estrategia Inversor Colombia
          </button>
          <button 
            className={`btn ${presetFilter === 'VALUE' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '4px 10px', fontSize: '0.74rem' }}
            onClick={() => { setPresetFilter('VALUE'); setPage(1); }}
          >
            <DollarSign size={12} />
            Gran Valor (PEG &lt; 1.0)
          </button>
          <button 
            className={`btn ${presetFilter === 'ROIC' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '4px 10px', fontSize: '0.74rem' }}
            onClick={() => { setPresetFilter('ROIC'); setPage(1); }}
          >
            <ShieldCheck size={12} />
            Alta Rentabilidad (ROIC &gt; 15%)
          </button>
          <button 
            className={`btn ${presetFilter === 'RSI_BOUNCE' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '4px 10px', fontSize: '0.74rem' }}
            onClick={() => { setPresetFilter('RSI_BOUNCE'); setPage(1); }}
          >
            <TrendingUp size={12} />
            Rebote Técnico (RSI 40-55)
          </button>
          <button 
            className={`btn ${presetFilter === 'MEGA_CAP' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '4px 10px', fontSize: '0.74rem' }}
            onClick={() => { setPresetFilter('MEGA_CAP'); setPage(1); }}
          >
            Megacaps (&gt; $50B)
          </button>
        </div>
      </div>

      {/* 2. Tarjeta de Filtros Estilo Finviz (Descriptive, Fundamental, Technical, All) */}
      <div className="glass-panel" style={{ padding: '14px 18px', marginBottom: '14px' }}>
        
        {/* Pestañas de Filtros de Finviz */}
        <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px', marginBottom: '14px' }}>
          <button
            className={`btn ${activeCategory === 'descriptive' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '4px 12px', fontSize: '0.76rem', fontWeight: 700 }}
            onClick={() => setActiveCategory('descriptive')}
          >
            Descriptive
          </button>
          <button
            className={`btn ${activeCategory === 'fundamental' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '4px 12px', fontSize: '0.76rem', fontWeight: 700 }}
            onClick={() => setActiveCategory('fundamental')}
          >
            Fundamental
          </button>
          <button
            className={`btn ${activeCategory === 'technical' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '4px 12px', fontSize: '0.76rem', fontWeight: 700 }}
            onClick={() => setActiveCategory('technical')}
          >
            Technical
          </button>
          <button
            className={`btn ${activeCategory === 'all' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '4px 12px', fontSize: '0.76rem', fontWeight: 700 }}
            onClick={() => setActiveCategory('all')}
          >
            All Filters
          </button>
        </div>

        {/* Rejilla de Selectores Dropdown Estilo Finviz */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))',
          gap: '10px',
          fontSize: '0.76rem'
        }}>
          
          {/* DESCRIPTIVE FILTERS */}
          {(activeCategory === 'descriptive' || activeCategory === 'all') && (
            <>
              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '3px', fontSize: '0.72rem' }}>Sector</label>
                <select value={sectorFilter} onChange={e => { setSectorFilter(e.target.value); setPage(1); }} style={selectStyle}>
                  <option value="Any">Any</option>
                  {sectors.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '3px', fontSize: '0.72rem' }}>Industry</label>
                <select value={industryFilter} onChange={e => { setIndustryFilter(e.target.value); setPage(1); }} style={selectStyle}>
                  <option value="Any">Any</option>
                  {industries.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '3px', fontSize: '0.72rem' }}>Country</label>
                <select value={countryFilter} onChange={e => { setCountryFilter(e.target.value); setPage(1); }} style={selectStyle}>
                  <option value="Any">Any</option>
                  {countries.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '3px', fontSize: '0.72rem' }}>Market Cap</label>
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
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '3px', fontSize: '0.72rem' }}>P/E</label>
                <select value={peFilter} onChange={e => { setPeFilter(e.target.value); setPage(1); }} style={selectStyle}>
                  <option value="Any">Any</option>
                  <option value="Under 15">Under 15</option>
                  <option value="Under 20">Under 20</option>
                  <option value="Under 25">Under 25</option>
                  <option value="Under 50">Under 50</option>
                  <option value="Over 50">Over 50</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '3px', fontSize: '0.72rem' }}>Forward P/E</label>
                <select value={forwardPeFilter} onChange={e => { setForwardPeFilter(e.target.value); setPage(1); }} style={selectStyle}>
                  <option value="Any">Any</option>
                  <option value="Under 15">Under 15</option>
                  <option value="Under 20">Under 20</option>
                  <option value="Under 30">Under 30</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '3px', fontSize: '0.72rem' }}>PEG</label>
                <select value={pegFilter} onChange={e => { setPegFilter(e.target.value); setPage(1); }} style={selectStyle}>
                  <option value="Any">Any</option>
                  <option value="Under 1">Under 1</option>
                  <option value="Under 2">Under 2</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '3px', fontSize: '0.72rem' }}>P/S</label>
                <select value={psFilter} onChange={e => { setPsFilter(e.target.value); setPage(1); }} style={selectStyle}>
                  <option value="Any">Any</option>
                  <option value="Under 1">Under 1</option>
                  <option value="Under 3">Under 3</option>
                  <option value="Over 5">Over 5</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '3px', fontSize: '0.72rem' }}>Current Ratio</label>
                <select value={currentRatioFilter} onChange={e => { setCurrentRatioFilter(e.target.value); setPage(1); }} style={selectStyle}>
                  <option value="Any">Any</option>
                  <option value="Over 1">Over 1</option>
                  <option value="Over 1.5">Over 1.5</option>
                  <option value="Over 2">Over 2</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '3px', fontSize: '0.72rem' }}>Quick Ratio</label>
                <select value={quickRatioFilter} onChange={e => { setQuickRatioFilter(e.target.value); setPage(1); }} style={selectStyle}>
                  <option value="Any">Any</option>
                  <option value="Over 1">Over 1</option>
                  <option value="Over 1.5">Over 1.5</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '3px', fontSize: '0.72rem' }}>EPS Growth Q/Q</label>
                <select value={epsGrowthQtrFilter} onChange={e => { setEpsGrowthQtrFilter(e.target.value); setPage(1); }} style={selectStyle}>
                  <option value="Any">Any</option>
                  <option value="Over 10%">Over 10%</option>
                  <option value="Over 15%">Over 15%</option>
                  <option value="Over 25%">Over 25%</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '3px', fontSize: '0.72rem' }}>EPS Growth TTM</label>
                <select value={epsGrowthTtmFilter} onChange={e => { setEpsGrowthTtmFilter(e.target.value); setPage(1); }} style={selectStyle}>
                  <option value="Any">Any</option>
                  <option value="Over 10%">Over 10%</option>
                  <option value="Over 15%">Over 15%</option>
                  <option value="Over 25%">Over 25%</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '3px', fontSize: '0.72rem' }}>Net Profit Margin</label>
                <select value={profitMarginFilter} onChange={e => { setProfitMarginFilter(e.target.value); setPage(1); }} style={selectStyle}>
                  <option value="Any">Any</option>
                  <option value="Positive (>0%)">Positive (&gt;0%)</option>
                  <option value="Over 15%">Over 15%</option>
                  <option value="Over 20%">Over 20%</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '3px', fontSize: '0.72rem' }}>Debt / Equity</label>
                <select value={debtEquityFilter} onChange={e => { setDebtEquityFilter(e.target.value); setPage(1); }} style={selectStyle}>
                  <option value="Any">Any</option>
                  <option value="Under 0.5">Under 0.5</option>
                  <option value="Under 1">Under 1</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '3px', fontSize: '0.72rem' }}>ROIC</label>
                <select value={roicFilter} onChange={e => { setRoicFilter(e.target.value); setPage(1); }} style={selectStyle}>
                  <option value="Any">Any</option>
                  <option value="Over 10%">Over 10%</option>
                  <option value="Over 15%">Over 15%</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '3px', fontSize: '0.72rem' }}>Sales Growth Q/Q</label>
                <select value={salesGrowthQtrFilter} onChange={e => { setSalesGrowthQtrFilter(e.target.value); setPage(1); }} style={selectStyle}>
                  <option value="Any">Any</option>
                  <option value="Over 10%">Over 10%</option>
                  <option value="Over 20%">Over 20%</option>
                </select>
              </div>
            </>
          )}

          {/* TECHNICAL FILTERS */}
          {(activeCategory === 'technical' || activeCategory === 'all') && (
            <>
              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '3px', fontSize: '0.72rem' }}>RSI (14)</label>
                <select value={rsiFilter} onChange={e => { setRsiFilter(e.target.value); setPage(1); }} style={selectStyle}>
                  <option value="Any">Any</option>
                  <option value="Oversold (30)">Oversold (30)</option>
                  <option value="Overbought (70)">Overbought (70)</option>
                  <option value="Bullish (50-70)">Bullish (50-70)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '3px', fontSize: '0.72rem' }}>Change %</label>
                <select value={changePctFilter} onChange={e => { setChangePctFilter(e.target.value); setPage(1); }} style={selectStyle}>
                  <option value="Any">Any</option>
                  <option value="Up">Up (&gt;0%)</option>
                  <option value="Down">Down (&lt;0%)</option>
                  <option value="Up 3%+">Up 3%+</option>
                  <option value="Down 3%+">Down 3%+</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '3px', fontSize: '0.72rem' }}>20-Day SMA</label>
                <select value={sma20Filter} onChange={e => { setSma20Filter(e.target.value); setPage(1); }} style={selectStyle}>
                  <option value="Any">Any</option>
                  <option value="Price above SMA20">Price above SMA20</option>
                  <option value="Price below SMA20">Price below SMA20</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '3px', fontSize: '0.72rem' }}>50-Day SMA</label>
                <select value={sma50Filter} onChange={e => { setSma50Filter(e.target.value); setPage(1); }} style={selectStyle}>
                  <option value="Any">Any</option>
                  <option value="Price above SMA50">Price above SMA50</option>
                  <option value="Price below SMA50">Price below SMA50</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '3px', fontSize: '0.72rem' }}>200-Day SMA</label>
                <select value={sma200Filter} onChange={e => { setSma200Filter(e.target.value); setPage(1); }} style={selectStyle}>
                  <option value="Any">Any</option>
                  <option value="Price above SMA200">Price above SMA200</option>
                  <option value="Price below SMA200">Price below SMA200</option>
                </select>
              </div>
            </>
          )}

        </div>
      </div>

      {/* 3. Selector de Vistas de Tabla (Custom = 28 columnas solicitadas por el usuario) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px',
        marginBottom: '10px',
        padding: '0 4px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
          <button
            className={`btn ${tableView === 'custom' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '4px 10px', fontSize: '0.74rem', fontWeight: 700 }}
            onClick={() => setTableView('custom')}
          >
            Custom (28 Columnas)
          </button>
          <button
            className={`btn ${tableView === 'overview' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '4px 10px', fontSize: '0.74rem', fontWeight: 600 }}
            onClick={() => setTableView('overview')}
          >
            Overview
          </button>
          <button
            className={`btn ${tableView === 'valuation' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '4px 10px', fontSize: '0.74rem', fontWeight: 600 }}
            onClick={() => setTableView('valuation')}
          >
            Valoración
          </button>
          <button
            className={`btn ${tableView === 'financial' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '4px 10px', fontSize: '0.74rem', fontWeight: 600 }}
            onClick={() => setTableView('financial')}
          >
            Financiero
          </button>
          <button
            className={`btn ${tableView === 'performance' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '4px 10px', fontSize: '0.74rem', fontWeight: 600 }}
            onClick={() => setTableView('performance')}
          >
            Rendimiento
          </button>
          <button
            className={`btn ${tableView === 'technical' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '4px 10px', fontSize: '0.74rem', fontWeight: 600 }}
            onClick={() => setTableView('technical')}
          >
            Técnico
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span>Mostrar:</span>
          <select 
            value={pageSize} 
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            style={{ ...selectStyle, width: 'auto', padding: '3px 8px', fontSize: '0.74rem' }}
          >
            <option value={25}>25 filas</option>
            <option value={50}>50 filas</option>
            <option value={100}>100 filas</option>
          </select>
        </div>
      </div>

      {/* 4. Tabla Unificada de Alta Densidad (Sin Deslizador Horizontal, Ajuste 100% Ancho) */}
      <div 
        className="glass-panel" 
        style={{ 
          width: '100%', 
          overflowX: 'hidden', 
          padding: '0', 
          borderRadius: '8px', 
          border: '1px solid var(--border-medium)' 
        }}
      >
        <table style={{
          width: '100%',
          tableLayout: 'fixed',
          borderCollapse: 'collapse',
          fontSize: '0.67rem',
          letterSpacing: '-0.2px'
        }}>
          <thead>
            <tr style={{ background: '#090e1a', borderBottom: '1px solid var(--border-medium)' }}>
              
              {/* VISTA 1: CUSTOM (TODAS LAS COLUMNAS DE LA IMAGEN DE EJEMPLO + QUANT RATING + ACCIÓN) */}
              {tableView === 'custom' && (
                <>
                  {[
                    { field: 'ticker', label: 'Ticker', title: 'Símbolo Bursátil', align: 'left', width: '4.8%' },
                    { field: 'company', label: 'Empresa', title: 'Compañía', align: 'left', width: '7.4%' },
                    { field: 'sector', label: 'Sector', title: 'Sector Económico', align: 'left', width: '5.8%' },
                    { field: 'industry', label: 'Industria', title: 'Industria', align: 'left', width: '6.4%' },
                    { field: 'market_cap', label: 'Cap. M.', title: 'Capitalización de Mercado (USD)', align: 'right', width: '5.2%' },
                    { field: 'price', label: 'Precio', title: 'Precio de Cotización', align: 'right', width: '4.0%' },
                    { field: 'pe', label: 'P/E', title: 'Price to Earnings', align: 'right', width: '3.2%' },
                    { field: 'forward_pe', label: 'Fwd P/E', title: 'Forward P/E', align: 'right', width: '3.5%' },
                    { field: 'ps', label: 'P/S', title: 'Price to Sales', align: 'right', width: '3.0%' },
                    { field: 'rsi', label: 'RSI', title: 'RSI (14D)', align: 'right', width: '3.1%' },
                    { field: 'ev_ebitda', label: 'EV/Eb.', title: 'EV / EBITDA', align: 'right', width: '3.7%' },
                    { field: 'volume', label: 'Vol.', title: 'Volumen de Acciones', align: 'right', width: '4.1%' },
                    { field: 'change_pct', label: 'Var %', title: 'Variación Diaria %', align: 'right', width: '3.8%' },
                    { field: 'eps_past_5y', label: 'EPS 5A', title: 'Crecimiento EPS Pasado 5 Años %', align: 'right', width: '3.6%' },
                    { field: 'profit_m', label: 'Margen N.', title: 'Margen de Beneficio Neto %', align: 'right', width: '3.8%' },
                    { field: 'eps_qq', label: 'EPS Q/Q', title: 'Crecimiento EPS Q/Q %', align: 'right', width: '3.7%' },
                    { field: 'target_price', label: 'Tgt Prc', title: 'Precio Objetivo de Analistas', align: 'right', width: '4.1%' },
                    { field: 'peg', label: 'PEG', title: 'PEG Ratio', align: 'right', width: '3.0%' },
                    { field: 'curr_r', label: 'Curr R', title: 'Current Ratio', align: 'right', width: '3.0%' },
                    { field: 'debt_eq', label: 'Deuda/Eq', title: 'Deuda sobre Patrimonio', align: 'right', width: '3.2%' },
                    { field: 'eps', label: 'EPS', title: 'EPS Diluido', align: 'right', width: '3.1%' },
                    { field: 'eps_past_3y', label: 'EPS 3A', title: 'Crecimiento EPS Pasado 3 Años %', align: 'right', width: '3.5%' },
                    { field: 'roic', label: 'ROIC', title: 'Return on Invested Capital %', align: 'right', width: '3.3%' },
                    { field: 'sma200', label: 'SMA200', title: 'Distancia a Media Móvil 200 Días %', align: 'right', width: '3.7%' },
                    { field: 'sales', label: 'Ventas', title: 'Ventas Totales Anuales (USD)', align: 'right', width: '4.8%' },
                    { field: 'sales_yoy_ttm', label: 'Vts YoY', title: 'Crecimiento Ventas YoY TTM %', align: 'right', width: '3.7%' },
                    { field: 'quant_rating', label: 'Quant', title: 'Quant Factor Grades Rating', align: 'center', width: '5.4%' }
                  ].map(({ field, label, title, align, width }) => {
                    const isSorted = sortField === field;
                    return (
                      <th
                        key={field}
                        onClick={() => handleSort(field as SortField)}
                        style={{
                          width,
                          textAlign: align as any,
                          padding: '7px 2px',
                          cursor: 'pointer',
                          userSelect: 'none',
                          color: isSorted ? '#fff' : 'var(--text-secondary)',
                          background: isSorted ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                          borderBottom: isSorted ? '2px solid var(--accent-green)' : '1px solid var(--border-medium)',
                          fontWeight: 700,
                          fontSize: '0.63rem',
                          textTransform: 'uppercase',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                        title={`${title} (${isSorted ? (sortAsc ? 'Ascendente' : 'Descendente') : 'Clic para ordenar'})`}
                      >
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2px',
                          justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
                          width: '100%'
                        }}>
                          <span>{label}</span>
                          {isSorted && (
                            sortAsc ? <ArrowUp size={10} color="var(--accent-green)" /> : <ArrowDown size={10} color="var(--accent-green)" />
                          )}
                        </div>
                      </th>
                    );
                  })}
                  <th style={{ width: '3.4%', textAlign: 'center', padding: '7px 2px', fontSize: '0.63rem', color: 'var(--text-secondary)' }}>
                    Acción
                  </th>
                </>
              )}

              {/* VISTAS PRECONFIGURADAS (OVERVIEW, VALUATION, FINANCIAL, PERFORMANCE, TECHNICAL) */}
              {tableView !== 'custom' && (
                <>
                  <th onClick={() => handleSort('ticker')} style={{ width: '8%', padding: '7px 4px', cursor: 'pointer', color: sortField === 'ticker' ? '#fff' : 'inherit' }}>Ticker</th>
                  <th onClick={() => handleSort('company')} style={{ width: '18%', padding: '7px 4px', cursor: 'pointer' }}>Empresa</th>
                  <th onClick={() => handleSort('price')} style={{ width: '8%', textAlign: 'right', padding: '7px 4px', cursor: 'pointer' }}>Precio</th>
                  <th onClick={() => handleSort('change_pct')} style={{ width: '8%', textAlign: 'right', padding: '7px 4px', cursor: 'pointer' }}>Var %</th>
                  <th onClick={() => handleSort('market_cap')} style={{ width: '12%', textAlign: 'right', padding: '7px 4px', cursor: 'pointer' }}>Cap. Mercado</th>
                  
                  {tableView === 'overview' && (
                    <>
                      <th onClick={() => handleSort('sector')} style={{ width: '14%', padding: '7px 4px', cursor: 'pointer' }}>Sector</th>
                      <th onClick={() => handleSort('pe')} style={{ width: '8%', textAlign: 'right', padding: '7px 4px', cursor: 'pointer' }}>P/E</th>
                      <th onClick={() => handleSort('volume')} style={{ width: '10%', textAlign: 'right', padding: '7px 4px', cursor: 'pointer' }}>Volumen</th>
                    </>
                  )}

                  {tableView === 'valuation' && (
                    <>
                      <th onClick={() => handleSort('pe')} style={{ width: '8%', textAlign: 'right', padding: '7px 4px', cursor: 'pointer' }}>P/E</th>
                      <th onClick={() => handleSort('forward_pe')} style={{ width: '8%', textAlign: 'right', padding: '7px 4px', cursor: 'pointer' }}>Fwd P/E</th>
                      <th onClick={() => handleSort('peg')} style={{ width: '8%', textAlign: 'right', padding: '7px 4px', cursor: 'pointer' }}>PEG</th>
                      <th onClick={() => handleSort('ps')} style={{ width: '8%', textAlign: 'right', padding: '7px 4px', cursor: 'pointer' }}>P/S</th>
                    </>
                  )}

                  {tableView === 'financial' && (
                    <>
                      <th onClick={() => handleSort('profit_m')} style={{ width: '8%', textAlign: 'right', padding: '7px 4px', cursor: 'pointer' }}>Margen N.</th>
                      <th onClick={() => handleSort('roic')} style={{ width: '8%', textAlign: 'right', padding: '7px 4px', cursor: 'pointer' }}>ROIC</th>
                      <th onClick={() => handleSort('curr_r')} style={{ width: '8%', textAlign: 'right', padding: '7px 4px', cursor: 'pointer' }}>Curr Ratio</th>
                      <th onClick={() => handleSort('sales')} style={{ width: '10%', textAlign: 'right', padding: '7px 4px', cursor: 'pointer' }}>Ventas</th>
                    </>
                  )}

                  {tableView === 'performance' && (
                    <>
                      <th onClick={() => handleSort('rsi')} style={{ width: '8%', textAlign: 'right', padding: '7px 4px', cursor: 'pointer' }}>RSI</th>
                      <th onClick={() => handleSort('sma200')} style={{ width: '8%', textAlign: 'right', padding: '7px 4px', cursor: 'pointer' }}>SMA200 %</th>
                      <th onClick={() => handleSort('volume')} style={{ width: '10%', textAlign: 'right', padding: '7px 4px', cursor: 'pointer' }}>Volumen</th>
                    </>
                  )}

                  {tableView === 'technical' && (
                    <>
                      <th onClick={() => handleSort('rsi')} style={{ width: '8%', textAlign: 'right', padding: '7px 4px', cursor: 'pointer' }}>RSI</th>
                      <th onClick={() => handleSort('sma50')} style={{ width: '8%', textAlign: 'right', padding: '7px 4px', cursor: 'pointer' }}>SMA50 %</th>
                      <th onClick={() => handleSort('sma200')} style={{ width: '8%', textAlign: 'right', padding: '7px 4px', cursor: 'pointer' }}>SMA200 %</th>
                    </>
                  )}

                  <th onClick={() => handleSort('quant_rating')} style={{ width: '12%', textAlign: 'center', padding: '7px 4px', cursor: 'pointer' }}>Quant Rating</th>
                  <th style={{ width: '6%', textAlign: 'center', padding: '7px 4px' }}>Acción</th>
                </>
              )}

            </tr>
          </thead>
          <tbody>
            {paginatedStocks.map(stock => {
              const analysis = calculateFactorGrades(stock);
              const isSelected = selectedStock?.ticker === stock.ticker;

              return (
                <tr 
                  key={stock.ticker}
                  style={{
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(16, 185, 129, 0.10)' : 'transparent',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    transition: 'background 0.12s ease'
                  }}
                  className="data-row-hover"
                  onClick={() => onSelectStock(stock)}
                >
                  
                  {/* FILAS DE VISTA CUSTOM (28 COLUMNAS EXACTAS) */}
                  {tableView === 'custom' && (
                    <>
                      {/* 1. Ticker */}
                      <td style={{ padding: '4px 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <span className="font-mono" style={{ fontWeight: 800, color: '#fff', fontSize: '0.72rem' }}>
                          {stock.ticker}
                        </span>
                      </td>

                      {/* 2. Empresa */}
                      <td style={{ padding: '4px 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-secondary)' }} title={stock.company}>
                        {stock.company || '—'}
                      </td>

                      {/* 3. Sector */}
                      <td style={{ padding: '4px 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-muted)' }} title={stock.sector}>
                        {stock.sector || '—'}
                      </td>

                      {/* 4. Industria */}
                      <td style={{ padding: '4px 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-muted)' }} title={stock.industry}>
                        {stock.industry || '—'}
                      </td>

                      {/* 5. Market Cap (Formato Moneda USD en B USD / M USD / T USD) */}
                      <td className="font-mono" style={{ padding: '4px 2px', textAlign: 'right', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={stock.market_cap ? `$${stock.market_cap.toLocaleString()} USD` : ''}>
                        {formatCurrencyUSD(stock.market_cap, { shortUnit: true })}
                      </td>

                      {/* 6. Precio */}
                      <td className="font-mono" style={{ padding: '4px 2px', textAlign: 'right', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
                        ${stock.price !== undefined && stock.price !== null ? stock.price.toFixed(2) : '—'}
                      </td>

                      {/* 7. P/E */}
                      <td className="font-mono" style={{ padding: '4px 2px', textAlign: 'right', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {stock.pe ? stock.pe.toFixed(1) : '—'}
                      </td>

                      {/* 8. Forward P/E */}
                      <td className="font-mono" style={{ padding: '4px 2px', textAlign: 'right', color: 'var(--accent-cyan)', whiteSpace: 'nowrap' }}>
                        {stock.forward_pe ? stock.forward_pe.toFixed(1) : '—'}
                      </td>

                      {/* 9. P/S */}
                      <td className="font-mono" style={{ padding: '4px 2px', textAlign: 'right', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {stock.ps ? stock.ps.toFixed(1) : '—'}
                      </td>

                      {/* 10. RSI */}
                      <td className="font-mono" style={{ 
                        padding: '4px 2px', 
                        textAlign: 'right', 
                        whiteSpace: 'nowrap',
                        color: stock.rsi ? (stock.rsi >= 70 ? '#ef4444' : stock.rsi <= 35 ? 'var(--accent-cyan)' : '#fff') : 'var(--text-muted)'
                      }}>
                        {stock.rsi ? stock.rsi.toFixed(1) : '—'}
                      </td>

                      {/* 11. EV/EBITDA */}
                      <td className="font-mono" style={{ padding: '4px 2px', textAlign: 'right', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {stock.ev_ebitda ? stock.ev_ebitda.toFixed(1) : '—'}
                      </td>

                      {/* 12. Volume */}
                      <td className="font-mono" style={{ padding: '4px 2px', textAlign: 'right', color: 'var(--text-muted)', whiteSpace: 'nowrap' }} title={stock.volume?.toLocaleString()}>
                        {formatVolumeShares(stock.volume)}
                      </td>

                      {/* 13. Change % */}
                      <td className="font-mono" style={{ padding: '4px 2px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {stock.change_pct !== undefined && stock.change_pct !== null ? (
                          <span style={{ 
                            color: stock.change_pct >= 0 ? 'var(--accent-green)' : '#ef4444',
                            fontWeight: 700 
                          }}>
                            {stock.change_pct >= 0 ? '+' : ''}{stock.change_pct.toFixed(2)}%
                          </span>
                        ) : '—'}
                      </td>

                      {/* 14. EPS Past 5Y */}
                      <td className="font-mono" style={{ padding: '4px 2px', textAlign: 'right', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {stock.eps_past_5y ? formatPercentage(stock.eps_past_5y, 1) : '—'}
                      </td>

                      {/* 15. Profit Margin */}
                      <td className="font-mono" style={{ padding: '4px 2px', textAlign: 'right', fontWeight: 600, color: (stock.profit_m ?? 0) >= 15 ? 'var(--accent-green)' : 'inherit', whiteSpace: 'nowrap' }}>
                        {stock.profit_m !== undefined && stock.profit_m !== null ? `${stock.profit_m.toFixed(1)}%` : '—'}
                      </td>

                      {/* 16. EPS Q/Q */}
                      <td className="font-mono" style={{ padding: '4px 2px', textAlign: 'right', color: (stock.eps_qq ?? 0) >= 15 ? 'var(--accent-green)' : 'inherit', whiteSpace: 'nowrap' }}>
                        {stock.eps_qq !== undefined && stock.eps_qq !== null ? formatPercentage(stock.eps_qq, 1) : '—'}
                      </td>

                      {/* 17. Target Price */}
                      <td className="font-mono" style={{ padding: '4px 2px', textAlign: 'right', color: '#fff', whiteSpace: 'nowrap' }}>
                        {stock.target_price ? `$${stock.target_price.toFixed(1)}` : '—'}
                      </td>

                      {/* 18. PEG */}
                      <td className="font-mono" style={{ padding: '4px 2px', textAlign: 'right', fontWeight: 600, color: (stock.peg && stock.peg < 1.0) ? 'var(--accent-green)' : 'inherit', whiteSpace: 'nowrap' }}>
                        {stock.peg ? stock.peg.toFixed(2) : '—'}
                      </td>

                      {/* 19. Current Ratio */}
                      <td className="font-mono" style={{ padding: '4px 2px', textAlign: 'right', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {stock.curr_r ? stock.curr_r.toFixed(2) : '—'}
                      </td>

                      {/* 20. Debt / Equity */}
                      <td className="font-mono" style={{ padding: '4px 2px', textAlign: 'right', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {stock.debt_eq !== undefined && stock.debt_eq !== null ? stock.debt_eq.toFixed(2) : '—'}
                      </td>

                      {/* 21. EPS */}
                      <td className="font-mono" style={{ padding: '4px 2px', textAlign: 'right', color: '#fff', whiteSpace: 'nowrap' }}>
                        {stock.eps ? stock.eps.toFixed(2) : '—'}
                      </td>

                      {/* 22. EPS Past 3Y */}
                      <td className="font-mono" style={{ padding: '4px 2px', textAlign: 'right', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {stock.eps_past_3y ? formatPercentage(stock.eps_past_3y, 1) : '—'}
                      </td>

                      {/* 23. ROIC */}
                      <td className="font-mono" style={{ padding: '4px 2px', textAlign: 'right', fontWeight: 700, color: (stock.roic ?? 0) >= 15 ? 'var(--accent-green)' : 'inherit', whiteSpace: 'nowrap' }}>
                        {stock.roic ? `${stock.roic.toFixed(1)}%` : '—'}
                      </td>

                      {/* 24. SMA 200 */}
                      <td className="font-mono" style={{ padding: '4px 2px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {stock.sma200 !== undefined && stock.sma200 !== null ? (
                          <span style={{ color: stock.sma200 >= 0 ? 'var(--accent-green)' : '#ef4444', fontWeight: 600 }}>
                            {formatPercentage(stock.sma200, 1)}
                          </span>
                        ) : '—'}
                      </td>

                      {/* 25. Sales (Formato Moneda USD en B USD / M USD / T USD) */}
                      <td className="font-mono" style={{ padding: '4px 2px', textAlign: 'right', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={stock.sales ? `$${stock.sales.toLocaleString()} USD` : ''}>
                        {formatCurrencyUSD(stock.sales, { shortUnit: true })}
                      </td>

                      {/* 26. Sales YoY TTM */}
                      <td className="font-mono" style={{ padding: '4px 2px', textAlign: 'right', color: (stock.sales_yoy_ttm ?? 0) >= 10 ? 'var(--accent-green)' : 'inherit', whiteSpace: 'nowrap' }}>
                        {stock.sales_yoy_ttm ? formatPercentage(stock.sales_yoy_ttm, 1) : '—'}
                      </td>

                      {/* 27. Quant Rating (Pill Cuantitativo de Screener Quant) */}
                      <td style={{ padding: '4px 2px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <span 
                            style={{
                              padding: '1px 4px',
                              borderRadius: '4px',
                              fontWeight: 800,
                              fontSize: '0.62rem',
                              background: analysis.quantScore >= 4.0 ? 'rgba(16, 185, 129, 0.2)' : analysis.quantScore >= 3.0 ? 'rgba(6, 182, 212, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                              color: analysis.quantScore >= 4.0 ? 'var(--accent-green)' : analysis.quantScore >= 3.0 ? 'var(--accent-cyan)' : '#ef4444',
                              border: `1px solid ${analysis.quantScore >= 4.0 ? 'rgba(16, 185, 129, 0.4)' : analysis.quantScore >= 3.0 ? 'rgba(6, 182, 212, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`
                            }}
                          >
                            {analysis.quantScore}
                          </span>
                          <span style={{ fontSize: '0.60rem', fontWeight: 600, color: analysis.quantScore >= 3.6 ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
                            {analysis.quantRating.startsWith('Fuerte C') ? 'F. Compra' : analysis.quantRating}
                          </span>
                        </div>
                      </td>

                      {/* 28. Columna Acción (Ver / Analizar de Screener Quant) */}
                      <td style={{ padding: '4px 2px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '2px 6px', fontSize: '0.62rem' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectStock(stock);
                          }}
                          title="Abrir análisis exhaustivo e informe institucional"
                        >
                          <Eye size={10} /> Ver
                        </button>
                      </td>
                    </>
                  )}

                  {/* FILAS DE VISTAS PARCIALES (OVERVIEW, VALUATION, FINANCIAL, ETC) */}
                  {tableView !== 'custom' && (
                    <>
                      <td style={{ padding: '6px 4px' }}>
                        <span className="font-mono" style={{ fontWeight: 800, color: '#fff', fontSize: '0.80rem' }}>
                          {stock.ticker}
                        </span>
                      </td>
                      <td style={{ padding: '6px 4px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {stock.company}
                      </td>
                      <td className="font-mono" style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 700, color: '#fff' }}>
                        ${stock.price?.toFixed(2)}
                      </td>
                      <td className="font-mono" style={{ padding: '6px 4px', textAlign: 'right' }}>
                        <span style={{ color: (stock.change_pct ?? 0) >= 0 ? 'var(--accent-green)' : '#ef4444', fontWeight: 700 }}>
                          {formatPercentage(stock.change_pct)}
                        </span>
                      </td>
                      <td className="font-mono" style={{ padding: '6px 4px', textAlign: 'right', color: '#fff' }}>
                        {formatCurrencyUSD(stock.market_cap, { shortUnit: true })}
                      </td>

                      {tableView === 'overview' && (
                        <>
                          <td style={{ padding: '6px 4px', color: 'var(--text-muted)' }}>{stock.sector || '—'}</td>
                          <td className="font-mono" style={{ padding: '6px 4px', textAlign: 'right', color: 'var(--text-secondary)' }}>{stock.pe ? stock.pe.toFixed(1) : '—'}</td>
                          <td className="font-mono" style={{ padding: '6px 4px', textAlign: 'right', color: 'var(--text-muted)' }}>{formatVolumeShares(stock.volume)}</td>
                        </>
                      )}

                      {tableView === 'valuation' && (
                        <>
                          <td className="font-mono" style={{ padding: '6px 4px', textAlign: 'right', color: 'var(--text-secondary)' }}>{stock.pe ? stock.pe.toFixed(1) : '—'}</td>
                          <td className="font-mono" style={{ padding: '6px 4px', textAlign: 'right', color: 'var(--accent-cyan)' }}>{stock.forward_pe ? stock.forward_pe.toFixed(1) : '—'}</td>
                          <td className="font-mono" style={{ padding: '6px 4px', textAlign: 'right', color: (stock.peg && stock.peg < 1) ? 'var(--accent-green)' : 'inherit' }}>{stock.peg ? stock.peg.toFixed(2) : '—'}</td>
                          <td className="font-mono" style={{ padding: '6px 4px', textAlign: 'right', color: 'var(--text-muted)' }}>{stock.ps ? stock.ps.toFixed(1) : '—'}</td>
                        </>
                      )}

                      {tableView === 'financial' && (
                        <>
                          <td className="font-mono" style={{ padding: '6px 4px', textAlign: 'right', color: (stock.profit_m ?? 0) >= 15 ? 'var(--accent-green)' : 'inherit' }}>{stock.profit_m ? `${stock.profit_m.toFixed(1)}%` : '—'}</td>
                          <td className="font-mono" style={{ padding: '6px 4px', textAlign: 'right', color: (stock.roic ?? 0) >= 15 ? 'var(--accent-green)' : 'inherit' }}>{stock.roic ? `${stock.roic.toFixed(1)}%` : '—'}</td>
                          <td className="font-mono" style={{ padding: '6px 4px', textAlign: 'right' }}>{stock.curr_r ? stock.curr_r.toFixed(2) : '—'}</td>
                          <td className="font-mono" style={{ padding: '6px 4px', textAlign: 'right', color: '#fff' }}>{formatCurrencyUSD(stock.sales, { shortUnit: true })}</td>
                        </>
                      )}

                      {tableView === 'performance' && (
                        <>
                          <td className="font-mono" style={{ padding: '6px 4px', textAlign: 'right' }}>{stock.rsi ? stock.rsi.toFixed(1) : '—'}</td>
                          <td className="font-mono" style={{ padding: '6px 4px', textAlign: 'right', color: (stock.sma200 ?? 0) >= 0 ? 'var(--accent-green)' : '#ef4444' }}>{formatPercentage(stock.sma200)}</td>
                          <td className="font-mono" style={{ padding: '6px 4px', textAlign: 'right' }}>{formatVolumeShares(stock.volume)}</td>
                        </>
                      )}

                      {tableView === 'technical' && (
                        <>
                          <td className="font-mono" style={{ padding: '6px 4px', textAlign: 'right' }}>{stock.rsi ? stock.rsi.toFixed(1) : '—'}</td>
                          <td className="font-mono" style={{ padding: '6px 4px', textAlign: 'right', color: (stock.sma50 ?? 0) >= 0 ? 'var(--accent-green)' : '#ef4444' }}>{formatPercentage(stock.sma50)}</td>
                          <td className="font-mono" style={{ padding: '6px 4px', textAlign: 'right', color: (stock.sma200 ?? 0) >= 0 ? 'var(--accent-green)' : '#ef4444' }}>{formatPercentage(stock.sma200)}</td>
                        </>
                      )}

                      <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{
                            padding: '1px 5px',
                            borderRadius: '4px',
                            fontWeight: 800,
                            fontSize: '0.68rem',
                            background: analysis.quantScore >= 4.0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(6, 182, 212, 0.2)',
                            color: analysis.quantScore >= 4.0 ? 'var(--accent-green)' : 'var(--accent-cyan)'
                          }}>
                            {analysis.quantScore}
                          </span>
                          <span style={{ fontSize: '0.68rem', fontWeight: 600 }}>{analysis.quantRating}</span>
                        </div>
                      </td>

                      <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '3px 8px', fontSize: '0.68rem' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectStock(stock);
                          }}
                        >
                          <Eye size={11} /> Ver
                        </button>
                      </td>
                    </>
                  )}

                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 5. Controles de Paginación */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: '12px',
        padding: '0 4px',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Mostrando página <strong>{page}</strong> de <strong>{Math.max(1, totalPages)}</strong> ({filteredStocks.length} resultados)
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button 
            className="btn btn-secondary" 
            style={{ padding: '4px 8px', fontSize: '0.74rem' }}
            disabled={page === 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            <ChevronLeft size={13} /> Anterior
          </button>
          
          <div style={{ display: 'flex', gap: '2px' }}>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pNum: number;
              if (totalPages <= 5) {
                pNum = i + 1;
              } else if (page <= 3) {
                pNum = i + 1;
              } else if (page >= totalPages - 2) {
                pNum = totalPages - 4 + i;
              } else {
                pNum = page - 2 + i;
              }

              return (
                <button
                  key={pNum}
                  className={`btn ${page === pNum ? 'btn-active' : 'btn-secondary'}`}
                  style={{ padding: '4px 9px', fontSize: '0.74rem', minWidth: '28px' }}
                  onClick={() => setPage(pNum)}
                >
                  {pNum}
                </button>
              );
            })}
          </div>

          <button 
            className="btn btn-secondary" 
            style={{ padding: '4px 8px', fontSize: '0.74rem' }}
            disabled={page >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          >
            Siguiente <ChevronRight size={13} />
          </button>
        </div>
      </div>

    </div>
  );
};
