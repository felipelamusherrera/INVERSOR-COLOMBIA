import React, { useState, useMemo, useEffect } from 'react';
import { 
  Download, 
  TrendingUp, 
  DollarSign, 
  ShieldCheck, 
  Layers,
  Sparkles,
  Bot,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  Bookmark,
  ExternalLink,
  Star,
  Trash2,
  Check,
  SlidersHorizontal,
  LayoutGrid,
  Table2,
  MoreVertical,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';
import type { StockRecord } from '../types/stock';
import type { ScreenerUIFilterPayload } from '../types/agent';
import { parseNaturalLanguageToScreenerFilters } from '../services/agentRagService';
import { getLatestOfficialFinancials } from '../services/quarterlyFinancialsService';
import { calculateFactorGrades } from '../utils/quantRatings';
import { formatCurrencyUSD, formatPercentage, formatVolumeShares } from '../utils/formatters';
import { SCREENER_SESSION_STORAGE_KEY } from '../context/AuthContext';
import { useViewport } from '../context/ViewportContext';
import { AddPositionModal } from './AddPositionModal';
import { AddToWatchlistModal } from './AddToWatchlistModal';

const FAVORITE_VIEW_STORAGE_KEY = 'inversor_colombia_favorite_screener_view_v1';

interface StockScreenerProps {
  stocks: StockRecord[];
  onSelectStock: (stock: StockRecord) => void;
  selectedStock?: StockRecord | null;
  externalAIFilters?: { filters: ScreenerUIFilterPayload; timestamp: number } | null;
  onOpenAgentDrawerWithQuery?: (query: string) => void;
}

export type SortField = keyof StockRecord | 'quant_rating' | 'fcf' | 'target_diff';
type FilterCategory = 'descriptive' | 'fundamental' | 'technical' | 'all';
type TableView = 'custom' | 'overview' | 'valuation' | 'financial' | 'performance' | 'technical';

export function computeStockFCF(stock: StockRecord): number | null {
  const official = getLatestOfficialFinancials(stock.ticker);
  if (official?.secAnnualFCF !== undefined && official?.secAnnualFCF !== null) {
    return official.secAnnualFCF;
  }
  if (stock.income !== undefined && stock.income !== null && stock.income !== 0) {
    const incAbs = Math.abs(stock.income) > 1e6 ? stock.income : stock.income * 1e6;
    return Number((incAbs * 0.85).toFixed(2));
  }
  if (stock.sales && stock.sales > 0 && stock.profit_m !== undefined && stock.profit_m !== null) {
    const salesAbs = stock.sales > 1e6 ? stock.sales : stock.sales * 1e6;
    return Number((salesAbs * (stock.profit_m / 100) * 0.85).toFixed(2));
  }
  return null;
}

export function computeTargetDiff(stock: StockRecord): { diffUsd: number; diffPct: number } | null {
  if (!stock.target_price || !stock.price || stock.price <= 0) return null;
  const diffUsd = stock.target_price - stock.price;
  const diffPct = ((stock.target_price - stock.price) / stock.price) * 100;
  return { diffUsd, diffPct };
}

export interface ScreenerViewConfig {
  nlQuery: string;
  appliedAISummary: string | null;
  tickerQuery: string;
  presetFilter: string;
  sectorFilter: string;
  industryFilter: string;
  countryFilter: string;
  marketCapFilter: string;
  indexFilter: string;
  peFilter: string;
  forwardPeFilter: string;
  pegFilter: string;
  psFilter: string;
  epsGrowthQtrFilter: string;
  epsGrowthTtmFilter: string;
  salesGrowthQtrFilter: string;
  salesGrowthTtmFilter: string;
  currentRatioFilter: string;
  quickRatioFilter: string;
  debtEquityFilter: string;
  profitMarginFilter: string;
  roicFilter: string;
  rsiFilter: string;
  sma20Filter: string;
  sma50Filter: string;
  sma200Filter: string;
  changePctFilter: string;
  activeCategory: FilterCategory;
  tableView: TableView;
  sortField: SortField;
  sortAsc: boolean;
  pageSize: number;
  page: number;
  savedAt?: string;
}

const DEFAULT_SCREENER_FILTERS = {
  nlQuery: '',
  appliedAISummary: null as string | null,
  tickerQuery: '',
  presetFilter: 'ALL',
  sectorFilter: 'Any',
  industryFilter: 'Any',
  countryFilter: 'Any',
  marketCapFilter: 'Any',
  indexFilter: 'Any',
  peFilter: 'Any',
  forwardPeFilter: 'Any',
  pegFilter: 'Any',
  psFilter: 'Any',
  epsGrowthQtrFilter: 'Any',
  epsGrowthTtmFilter: 'Any',
  salesGrowthQtrFilter: 'Any',
  salesGrowthTtmFilter: 'Any',
  currentRatioFilter: 'Any',
  quickRatioFilter: 'Any',
  debtEquityFilter: 'Any',
  profitMarginFilter: 'Any',
  roicFilter: 'Any',
  rsiFilter: 'Any',
  sma20Filter: 'Any',
  sma50Filter: 'Any',
  sma200Filter: 'Any',
  changePctFilter: 'Any',
};

const DEFAULT_SCREENER_CONFIG: ScreenerViewConfig = {
  ...DEFAULT_SCREENER_FILTERS,
  activeCategory: 'fundamental',
  tableView: 'custom',
  sortField: 'market_cap',
  sortAsc: false,
  pageSize: 50,
  page: 1,
};

const COUNTABLE_FILTER_KEYS = Object.keys(DEFAULT_SCREENER_FILTERS).filter(
  (k) => k !== 'nlQuery' && k !== 'appliedAISummary'
) as (keyof typeof DEFAULT_SCREENER_FILTERS)[];

function countActiveFilters(cfg: ScreenerViewConfig): number {
  return COUNTABLE_FILTER_KEYS.reduce((count, key) => {
    const val = cfg[key];
    const def = DEFAULT_SCREENER_FILTERS[key];
    if (key === 'tickerQuery') {
      return typeof val === 'string' && val.trim() ? count + 1 : count;
    }
    return val !== def ? count + 1 : count;
  }, 0);
}

function loadScreenerConfigFromStorage(storage: Storage, key: string): ScreenerViewConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return { ...DEFAULT_SCREENER_CONFIG, ...parsed };
    }
  } catch (err) {
    console.warn(`Error leyendo configuración de screener (${key}):`, err);
  }
  return null;
}

interface ColumnDef {
  field: SortField;
  label: string;
  title?: string;
  align: 'left' | 'right' | 'center';
  width: string;
}

const CUSTOM_COLUMNS: ColumnDef[] = [
  { field: 'ticker', label: 'Ticker', title: 'Símbolo Bursátil', align: 'left', width: '4.3%' },
  { field: 'company', label: 'Empresa', title: 'Compañía', align: 'left', width: '5.9%' },
  { field: 'sector', label: 'Sector', title: 'Sector Económico', align: 'left', width: '4.6%' },
  { field: 'industry', label: 'Industria', title: 'Industria', align: 'left', width: '4.9%' },
  { field: 'market_cap', label: 'Cap. M.', title: 'Capitalización de Mercado (USD)', align: 'right', width: '4.3%' },
  { field: 'price', label: 'Precio', title: 'Precio de Cotización', align: 'right', width: '3.8%' },
  { field: 'pe', label: 'P/E', title: 'Price to Earnings', align: 'right', width: '2.9%' },
  { field: 'forward_pe', label: 'Fwd P/E', title: 'Forward P/E', align: 'right', width: '3.1%' },
  { field: 'ps', label: 'P/S', title: 'Price to Sales', align: 'right', width: '2.7%' },
  { field: 'rsi', label: 'RSI', title: 'RSI (14D)', align: 'right', width: '2.8%' },
  { field: 'ev_ebitda', label: 'EV/Eb.', title: 'EV / EBITDA', align: 'right', width: '3.2%' },
  { field: 'volume', label: 'Vol.', title: 'Volumen de Acciones', align: 'right', width: '3.7%' },
  { field: 'change_pct', label: 'Var %', title: 'Variación Diaria %', align: 'right', width: '3.5%' },
  { field: 'eps_past_5y', label: 'EPS 5A', title: 'Crecimiento EPS Pasado 5 Años %', align: 'right', width: '3.2%' },
  { field: 'profit_m', label: 'Margen N.', title: 'Margen de Beneficio Neto %', align: 'right', width: '3.4%' },
  { field: 'eps_qq', label: 'EPS Q/Q', title: 'Crecimiento EPS Q/Q %', align: 'right', width: '3.3%' },
  { field: 'target_price', label: 'Tgt Prc', title: 'Precio Objetivo de Analistas', align: 'right', width: '3.6%' },
  { field: 'target_diff', label: 'Dif. Tgt', title: 'Diferencia entre Precio Objetivo (Tgt Prc) y Precio Actual ($ y %)', align: 'right', width: '4.3%' },
  { field: 'peg', label: 'PEG', title: 'PEG Ratio', align: 'right', width: '2.7%' },
  { field: 'curr_r', label: 'Curr R', title: 'Current Ratio', align: 'right', width: '2.7%' },
  { field: 'debt_eq', label: 'Deuda/Eq', title: 'Deuda sobre Patrimonio', align: 'right', width: '2.9%' },
  { field: 'eps', label: 'EPS', title: 'EPS Diluido', align: 'right', width: '2.8%' },
  { field: 'fcf', label: 'FCF', title: 'Free Cash Flow — Flujo de Caja Libre Anual (USD)', align: 'right', width: '3.7%' },
  { field: 'roic', label: 'ROIC', title: 'Return on Invested Capital %', align: 'right', width: '3.0%' },
  { field: 'sma200', label: 'SMA200', title: 'Distancia a Media Móvil 200 Días %', align: 'right', width: '3.4%' },
  { field: 'sales', label: 'Ventas', title: 'Ventas Totales Anuales (USD)', align: 'right', width: '3.8%' },
  { field: 'sales_yoy_ttm', label: 'Vts YoY', title: 'Crecimiento Ventas YoY TTM %', align: 'right', width: '3.2%' },
  { field: 'quant_rating', label: 'Quant', title: 'Quant Factor Grades Rating', align: 'center', width: '4.3%' }
];

const PARTIAL_VIEW_EXTRA_COLUMNS: Record<Exclude<TableView, 'custom'>, ColumnDef[]> = {
  overview: [
    { field: 'sector', label: 'Sector', align: 'left', width: '14%' },
    { field: 'pe', label: 'P/E', align: 'right', width: '8%' },
    { field: 'volume', label: 'Volumen', align: 'right', width: '10%' },
  ],
  valuation: [
    { field: 'pe', label: 'P/E', align: 'right', width: '8%' },
    { field: 'forward_pe', label: 'Fwd P/E', align: 'right', width: '8%' },
    { field: 'peg', label: 'PEG', align: 'right', width: '8%' },
    { field: 'ps', label: 'P/S', align: 'right', width: '8%' },
  ],
  financial: [
    { field: 'profit_m', label: 'Margen N.', align: 'right', width: '8%' },
    { field: 'roic', label: 'ROIC', align: 'right', width: '8%' },
    { field: 'curr_r', label: 'Curr Ratio', align: 'right', width: '8%' },
    { field: 'sales', label: 'Ventas', align: 'right', width: '10%' },
  ],
  performance: [
    { field: 'rsi', label: 'RSI', align: 'right', width: '8%' },
    { field: 'sma200', label: 'SMA200 %', align: 'right', width: '8%' },
    { field: 'volume', label: 'Volumen', align: 'right', width: '10%' },
  ],
  technical: [
    { field: 'rsi', label: 'RSI', align: 'right', width: '8%' },
    { field: 'sma50', label: 'SMA50 %', align: 'right', width: '8%' },
    { field: 'sma200', label: 'SMA200 %', align: 'right', width: '8%' },
  ],
};

function getPartialViewColumns(view: Exclude<TableView, 'custom'>): ColumnDef[] {
  return [
    { field: 'ticker', label: 'Ticker', align: 'left', width: '9%' },
    { field: 'company', label: 'Empresa', align: 'left', width: '21%' },
    { field: 'price', label: 'Precio', align: 'right', width: '8%' },
    { field: 'change_pct', label: 'Var %', align: 'right', width: '8%' },
    { field: 'market_cap', label: 'Cap. Mercado', align: 'right', width: '12%' },
    ...PARTIAL_VIEW_EXTRA_COLUMNS[view],
    { field: 'quant_rating', label: 'Quant Rating', align: 'center', width: '14%' },
  ];
}

function getColumnLabel(field: SortField): string {
  const found = CUSTOM_COLUMNS.find((c) => c.field === field);
  return found ? found.label : String(field);
}

const TABLE_VIEW_LABELS: Record<TableView, string> = {
  custom: 'Custom (28 Col.)',
  overview: 'Overview',
  valuation: 'Valoración',
  financial: 'Financiero',
  performance: 'Rendimiento',
  technical: 'Técnico',
};

export const StockScreener: React.FC<StockScreenerProps> = ({
  stocks,
  onSelectStock,
  selectedStock,
  externalAIFilters,
  onOpenAgentDrawerWithQuery
}) => {
  const { isMobile, isDesktopWide, mobileScreenerLayout, setMobileScreenerLayout } = useViewport();
  const [mobileFiltersExpanded, setMobileFiltersExpanded] = useState(false);

  // Estado completo del Screener respaldado en sessionStorage mientras dure la sesión activa
  const [config, setConfig] = useState<ScreenerViewConfig>(() => {
    return loadScreenerConfigFromStorage(sessionStorage, SCREENER_SESSION_STORAGE_KEY) || DEFAULT_SCREENER_CONFIG;
  });

  // Vista Favorita persistente entre sesiones (localStorage)
  const [favoriteView, setFavoriteView] = useState<ScreenerViewConfig | null>(() => {
    return loadScreenerConfigFromStorage(localStorage, FAVORITE_VIEW_STORAGE_KEY);
  });

  const {
    nlQuery,
    appliedAISummary,
    tickerQuery,
    presetFilter,
    sectorFilter,
    industryFilter,
    countryFilter,
    marketCapFilter,
    indexFilter,
    peFilter,
    forwardPeFilter,
    pegFilter,
    psFilter,
    epsGrowthQtrFilter,
    epsGrowthTtmFilter,
    salesGrowthQtrFilter,
    salesGrowthTtmFilter,
    currentRatioFilter,
    quickRatioFilter,
    debtEquityFilter,
    profitMarginFilter,
    roicFilter,
    rsiFilter,
    sma20Filter,
    sma50Filter,
    sma200Filter,
    changePctFilter,
    activeCategory,
    tableView,
    sortField,
    sortAsc,
    pageSize,
    page,
  } = config;

  const updateConfig = (patch: Partial<ScreenerViewConfig>, resetPage = false) => {
    setConfig(prev => ({
      ...prev,
      ...patch,
      ...(resetPage ? { page: 1 } : {}),
    }));
  };

  // Persistir automáticamente cada cambio de filtros, vista u orden de columnas en sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(SCREENER_SESSION_STORAGE_KEY, JSON.stringify(config));
    } catch (err) {
      console.warn('Error guardando estado del Screener en sesión:', err);
    }
  }, [config]);

  // Menú contextual en clic derecho y modales de Cartera y Listas
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    stock: StockRecord;
  } | null>(null);
  const [modalStock, setModalStock] = useState<StockRecord | null>(null);
  const [showAddPositionModal, setShowAddPositionModal] = useState(false);
  const [showAddToWatchlistModal, setShowAddToWatchlistModal] = useState(false);

  useEffect(() => {
    const handleCloseMenu = () => setContextMenu(null);
    window.addEventListener('click', handleCloseMenu);
    return () => window.removeEventListener('click', handleCloseMenu);
  }, []);

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
  const activeFiltersCount = useMemo(() => countActiveFilters(config), [config]);

  // Verificar si la configuración actual coincide exactamente con la Vista Favorita guardada
  const isFavoriteViewActive = useMemo(() => {
    if (!favoriteView) return false;
    const comparableKeys = Object.keys(DEFAULT_SCREENER_CONFIG).filter(
      (k) => k !== 'page' && k !== 'savedAt'
    ) as (keyof ScreenerViewConfig)[];
    return comparableKeys.every((key) => config[key] === favoriteView[key]);
  }, [config, favoriteView]);

  // Guardar la configuración actual de filtros y orden de columnas como Vista Favorita
  const handleSaveFavoriteView = () => {
    const viewToSave: ScreenerViewConfig = {
      ...config,
      page: 1,
      savedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(FAVORITE_VIEW_STORAGE_KEY, JSON.stringify(viewToSave));
      setFavoriteView(viewToSave);
      toast.success('★ Vista Favorita guardada (filtros y orden de columnas)');
    } catch (err) {
      console.error('Error guardando Vista Favorita:', err);
      toast.error('No se pudo guardar la Vista Favorita en este navegador');
    }
  };

  // Aplicar Vista Favorita con un solo clic
  const handleApplyFavoriteView = () => {
    if (!favoriteView) {
      toast.info('Aún no tienes una Vista Favorita guardada. Configura tus filtros y orden de columnas, luego pulsa "Guardar Vista Favorita".');
      return;
    }
    setConfig({
      ...DEFAULT_SCREENER_CONFIG,
      ...favoriteView,
      page: 1,
    });
    toast.success('★ Vista Favorita aplicada');
  };

  // Eliminar Vista Favorita guardada
  const handleDeleteFavoriteView = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      localStorage.removeItem(FAVORITE_VIEW_STORAGE_KEY);
      setFavoriteView(null);
      toast.info('Vista Favorita eliminada');
    } catch (err) {
      console.error('Error eliminando Vista Favorita:', err);
    }
  };

  // Reset Completo de Filtros
  const handleResetFilters = () => {
    setConfig(prev => ({
      ...prev,
      ...DEFAULT_SCREENER_FILTERS,
      page: 1,
    }));
  };

  // Fase 3: Aplicar payload de filtros generado por Lenguaje Natural IA
  const applyAIFilterPayload = (payload: ScreenerUIFilterPayload, nlTextOverride?: string) => {
    setConfig(prev => ({
      ...prev,
      ...DEFAULT_SCREENER_FILTERS,
      nlQuery: nlTextOverride ?? prev.nlQuery,
      sectorFilter: payload.sectorFilter || 'Any',
      marketCapFilter: payload.marketCapFilter || 'Any',
      peFilter: payload.peFilter || 'Any',
      forwardPeFilter: payload.forwardPeFilter || 'Any',
      pegFilter: payload.pegFilter || 'Any',
      epsGrowthQtrFilter: payload.epsGrowthQtrFilter || 'Any',
      salesGrowthTtmFilter: payload.salesGrowthTtmFilter || 'Any',
      currentRatioFilter: payload.currentRatioFilter || 'Any',
      debtEquityFilter: payload.debtEquityFilter || 'Any',
      profitMarginFilter: payload.profitMarginFilter || 'Any',
      roicFilter: payload.roicFilter || 'Any',
      rsiFilter: payload.rsiFilter || 'Any',
      sma50Filter: payload.sma50Filter || 'Any',
      sma200Filter: payload.sma200Filter || 'Any',
      tickerQuery: payload.tickerQuery !== undefined ? payload.tickerQuery : '',
      activeCategory: 'all',
      appliedAISummary: payload.summaryText || 'Filtros cuantitativos aplicados por IA',
      page: 1,
    }));
  };

  const handleApplyNaturalLanguage = (customText?: string) => {
    const query = (customText ?? nlQuery).trim();
    if (!query) return;
    const parsed = parseNaturalLanguageToScreenerFilters(query);
    applyAIFilterPayload(parsed, customText ?? query);
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
      let valA: any;
      let valB: any;
      if (sortField === 'quant_rating') {
        valA = calculateFactorGrades(a).quantScore;
        valB = calculateFactorGrades(b).quantScore;
      } else if (sortField === 'fcf') {
        valA = computeStockFCF(a);
        valB = computeStockFCF(b);
      } else if (sortField === 'target_diff') {
        valA = computeTargetDiff(a)?.diffPct ?? null;
        valB = computeTargetDiff(b)?.diffPct ?? null;
      } else {
        valA = a[sortField as keyof StockRecord];
        valB = b[sortField as keyof StockRecord];
      }

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
      updateConfig({ sortAsc: !sortAsc });
    } else {
      const defaultDesc = [
        'market_cap', 'price', 'volume', 'roic', 'profit_m', 'change_pct',
        'quant_rating', 'sales', 'eps_qq', 'sales_yoy_ttm', 'eps_past_5y', 'eps', 'fcf', 'target_diff'
      ].includes(field);
      updateConfig({ sortField: field, sortAsc: !defaultDesc });
    }
  };

  const handleExportCSV = () => {
    if (!filteredStocks.length) return;
    const headers = [
      'Ticker', 'Company', 'Sector', 'Industry', 'Market Cap (USD)', 'Price',
      'P/E', 'Forward P/E', 'PEG', 'P/S', 'RSI', 'EV/EBITDA', 'Volume', 'Change %',
      'EPS Past 5Y', 'Profit Margin', 'EPS Q/Q', 'Target Price', 'Target Diff ($)', 'Target Diff (%)',
      'Current Ratio', 'Debt/Equity', 'EPS', 'FCF (USD)', 'ROIC', 'SMA200 %', 'Sales (USD)', 'Sales YoY TTM',
      'Quant Score', 'Quant Rating'
    ];

    const rows = filteredStocks.map(s => {
      const q = calculateFactorGrades(s);
      const fcfVal = computeStockFCF(s);
      const tgtDiff = computeTargetDiff(s);
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
        tgtDiff ? tgtDiff.diffUsd.toFixed(2) : '',
        tgtDiff ? tgtDiff.diffPct.toFixed(2) : '',
        s.curr_r || '',
        s.debt_eq || '',
        s.eps || '',
        fcfVal !== null ? fcfVal : '',
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

  const favoriteFiltersCount = favoriteView ? countActiveFilters(favoriteView) : 0;
  const favoriteSummaryTooltip = favoriteView
    ? `Aplicar Vista Favorita (${TABLE_VIEW_LABELS[favoriteView.tableView]} · Orden: ${getColumnLabel(favoriteView.sortField)} ${favoriteView.sortAsc ? '↑' : '↓'} · ${favoriteFiltersCount} ${favoriteFiltersCount === 1 ? 'filtro' : 'filtros'})`
    : 'Aún no hay una Vista Favorita guardada. Configura tus filtros y orden de columnas y presiona "Guardar Vista Favorita".';

  const renderFavoriteApplyButton = (compact = false) => (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
      <button
        type="button"
        onClick={handleApplyFavoriteView}
        className="btn"
        style={{
          padding: compact ? '4px 10px' : '6px 12px',
          fontSize: compact ? '0.74rem' : '0.78rem',
          fontWeight: 700,
          background: isFavoriteViewActive
            ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.28) 0%, rgba(217, 119, 6, 0.22) 100%)'
            : favoriteView
            ? 'rgba(245, 158, 11, 0.12)'
            : 'rgba(15, 23, 42, 0.65)',
          border: isFavoriteViewActive
            ? '1px solid #f59e0b'
            : favoriteView
            ? '1px solid rgba(245, 158, 11, 0.45)'
            : '1px dashed rgba(148, 163, 184, 0.35)',
          color: favoriteView ? '#fbbf24' : 'var(--text-muted)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          boxShadow: isFavoriteViewActive ? '0 0 12px rgba(245, 158, 11, 0.22)' : 'none',
        }}
        title={favoriteSummaryTooltip}
      >
        <Star
          size={compact ? 12 : 13}
          color={favoriteView ? '#fbbf24' : 'var(--text-muted)'}
          fill={favoriteView ? '#fbbf24' : 'none'}
        />
        <span>Vista Favorita</span>
        {favoriteView && (
          <span
            style={{
              fontSize: '0.66rem',
              opacity: 0.9,
              background: 'rgba(245, 158, 11, 0.16)',
              padding: '1px 5px',
              borderRadius: '4px',
              fontFamily: 'monospace',
            }}
          >
            {getColumnLabel(favoriteView.sortField)} {favoriteView.sortAsc ? '↑' : '↓'} · {favoriteFiltersCount}f
          </span>
        )}
        {isFavoriteViewActive && <Check size={12} color="#fbbf24" />}
      </button>
      {favoriteView && (
        <button
          type="button"
          onClick={handleDeleteFavoriteView}
          className="btn btn-secondary"
          style={{
            padding: compact ? '4px 6px' : '6px 7px',
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            borderColor: 'rgba(245, 158, 11, 0.25)',
          }}
          title="Eliminar Vista Favorita guardada"
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );

  const renderSaveFavoriteButton = (compact = false) => (
    <button
      type="button"
      onClick={handleSaveFavoriteView}
      className="btn btn-secondary"
      style={{
        padding: compact ? '4px 10px' : '6px 12px',
        fontSize: compact ? '0.74rem' : '0.78rem',
        fontWeight: 700,
        borderColor: 'rgba(245, 158, 11, 0.45)',
        color: '#fcd34d',
        background: 'rgba(245, 158, 11, 0.08)',
      }}
      title="Guardar los filtros, vista y orden de columnas actuales como tu Vista Favorita"
    >
      <Star size={compact ? 12 : 13} color="#fbbf24" />
      Guardar Vista Favorita
    </button>
  );

  return (
    <div style={{ maxWidth: '100%', margin: '0 auto', padding: 'var(--page-py, 16px) var(--page-px, 20px)' }} className="animate-fade-in">
      
      {/* 1. Cabecera Principal y Exportación */}
      <div className="glass-panel" style={{ padding: isMobile ? '12px 14px' : '16px 20px', marginBottom: isMobile ? '10px' : '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: isMobile ? '8px' : '12px' }}>
          <div>
            <h1 style={{ fontSize: 'var(--fs-h1, 1.4rem)', fontWeight: 800, margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={isMobile ? 19 : 22} color="var(--accent-green)" />
              Screener acciones
            </h1>
            <p style={{ fontSize: isMobile ? '0.73rem' : '0.8rem', color: 'var(--text-secondary)', margin: '3px 0 0 0' }}>
              {!isMobile && <>Filtrado cuantitativo institucional multicriterio sobre </>}
              <strong>{stocks.length.toLocaleString('es-CO')} acciones</strong>{!isMobile && ' globales'}.{' '}
              Mostrando <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>{filteredStocks.length}</span> coincidencias.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {!isMobile && renderFavoriteApplyButton(false)}
            {!isMobile && renderSaveFavoriteButton(false)}
            {isMobile && (
              <button
                type="button"
                onClick={() => setMobileFiltersExpanded(prev => !prev)}
                className={`btn ${mobileFiltersExpanded || activeFiltersCount > 0 ? 'btn-active' : 'btn-secondary'}`}
                style={{ padding: '6px 10px', fontSize: '0.74rem', fontWeight: 700 }}
              >
                <SlidersHorizontal size={13} />
                Filtros & IA {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''}
                {mobileFiltersExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            )}
            <button 
              onClick={handleResetFilters} 
              className="btn btn-secondary" 
              style={{ padding: isMobile ? '6px 9px' : '6px 12px', fontSize: isMobile ? '0.73rem' : '0.78rem' }}
              title="Restablecer todos los filtros"
            >
              <RotateCcw size={13} />
              {isMobile ? (activeFiltersCount > 0 ? `Reset (${activeFiltersCount})` : 'Reset') : `Reset Filters ${activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''}`}
            </button>
            <button 
              onClick={handleExportCSV} 
              className="btn btn-secondary" 
              style={{ padding: isMobile ? '6px 9px' : '6px 12px', fontSize: isMobile ? '0.73rem' : '0.78rem' }}
              title="Descargar tabla en archivo CSV"
            >
              <Download size={13} />
              {isMobile ? 'CSV' : `Exportar CSV (${filteredStocks.length})`}
            </button>
          </div>
        </div>

        {/* Barra de Tickers Múltiples (Estándar Finviz Tickers) */}
        <div style={{
          marginTop: isMobile ? '10px' : '12px',
          padding: isMobile ? '8px 10px' : '10px 14px',
          background: 'rgba(7, 11, 20, 0.75)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--accent-cyan)', whiteSpace: 'nowrap' }}>
            Tickers:
          </span>
          <div style={{ flex: 1, minWidth: isMobile ? '160px' : '260px', position: 'relative' }}>
            <input
              type="text"
              placeholder={isMobile ? 'Ej: NVDA, MU, AAPL, TSM...' : 'Introduce tickers separados por coma o espacio (ej: SNDK, MU, ASMI, NBIS, WDC, STX)...'}
              value={tickerQuery}
              onChange={(e) => updateConfig({ tickerQuery: e.target.value }, true)}
              style={{
                width: '100%',
                background: '#040711',
                border: '1px solid var(--border-medium)',
                borderRadius: '6px',
                padding: '6px 10px',
                color: '#fff',
                fontSize: '0.82rem',
                fontFamily: 'monospace'
              }}
            />
          </div>
          {tickerQuery && (
            <button 
              onClick={() => updateConfig({ tickerQuery: '' }, true)} 
              className="btn btn-secondary" 
              style={{ padding: '4px 10px', fontSize: '0.74rem' }}
            >
              Limpiar
            </button>
          )}
        </div>

        {/* Fase 3: Barra de Filtrado por Lenguaje Natural con IA (Colapsable en Móvil) */}
        <div
          style={{
            marginTop: '10px',
            padding: isMobile ? '10px 12px' : '10px 14px',
            background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.08) 0%, rgba(6, 182, 212, 0.08) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.28)',
            borderRadius: '8px',
            display: (!isMobile || mobileFiltersExpanded || Boolean(appliedAISummary)) ? 'flex' : 'none',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '0.76rem',
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
              style={{
                flex: 1,
                minWidth: isMobile ? '100%' : '280px',
                display: 'flex',
                flexWrap: isMobile ? 'wrap' : 'nowrap',
                gap: '6px',
              }}
            >
              <input
                type="text"
                placeholder="Ej: Tecnológicas con ROIC > 15%, margen > 20% y baja deuda..."
                value={nlQuery}
                onChange={(e) => updateConfig({ nlQuery: e.target.value })}
                style={{
                  flex: isMobile ? '1 1 100%' : 1,
                  minWidth: 0,
                  background: '#040711',
                  border: '1px solid rgba(52, 211, 153, 0.35)',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  color: '#fff',
                  fontSize: '0.8rem',
                }}
              />
              <button
                type="submit"
                className="btn"
                style={{
                  flex: isMobile ? 1 : 'none',
                  padding: '6px 12px',
                  fontSize: '0.75rem',
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
                    flex: isMobile ? 1 : 'none',
                    padding: '6px 10px',
                    fontSize: '0.74rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
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
                    padding: '3px 9px',
                    fontSize: '0.67rem',
                    color: '#cbd5e1',
                    cursor: 'pointer',
                    textAlign: 'left',
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

        {/* Presets Rápidos de Estrategia Institucional y Vista Favorita (Deslizables en móvil) */}
        <div
          className={isMobile ? 'hide-scrollbar' : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexWrap: isMobile ? 'nowrap' : 'wrap',
            overflowX: isMobile ? 'auto' : 'visible',
            WebkitOverflowScrolling: 'touch',
            marginTop: '10px',
            paddingBottom: isMobile ? '2px' : 0,
          }}
        >
          {!isMobile && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginRight: '4px' }}>
              Presets:
            </span>
          )}
          {renderFavoriteApplyButton(true)}
          {renderSaveFavoriteButton(true)}
          <button 
            className={`btn ${presetFilter === 'ALL' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '4px 10px', fontSize: '0.73rem', flexShrink: 0 }}
            onClick={() => updateConfig({ presetFilter: 'ALL' }, true)}
          >
            Todas ({stocks.length})
          </button>
          <button 
            className={`btn ${presetFilter === 'STRATEGY' ? 'btn-active' : 'btn-secondary'}`}
            style={{ 
              padding: '4px 10px', 
              fontSize: '0.73rem',
              flexShrink: 0,
              border: presetFilter === 'STRATEGY' ? '1px solid var(--accent-green)' : '1px solid rgba(16, 185, 129, 0.35)',
              color: presetFilter === 'STRATEGY' ? '#fff' : 'var(--accent-green)'
            }}
            onClick={() => updateConfig({ presetFilter: 'STRATEGY' }, true)}
          >
            <Sparkles size={12} color="var(--accent-green)" />
            Estrategia Inversor Colombia
          </button>
          <button 
            className={`btn ${presetFilter === 'VALUE' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '4px 10px', fontSize: '0.73rem', flexShrink: 0 }}
            onClick={() => updateConfig({ presetFilter: 'VALUE' }, true)}
          >
            <DollarSign size={12} />
            Gran Valor (PEG &lt; 1.0)
          </button>
          <button 
            className={`btn ${presetFilter === 'ROIC' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '4px 10px', fontSize: '0.73rem', flexShrink: 0 }}
            onClick={() => updateConfig({ presetFilter: 'ROIC' }, true)}
          >
            <ShieldCheck size={12} />
            Alta Rentabilidad (ROIC &gt; 15%)
          </button>
          <button 
            className={`btn ${presetFilter === 'RSI_BOUNCE' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '4px 10px', fontSize: '0.73rem', flexShrink: 0 }}
            onClick={() => updateConfig({ presetFilter: 'RSI_BOUNCE' }, true)}
          >
            <TrendingUp size={12} />
            Rebote Técnico (RSI 40-55)
          </button>
          <button 
            className={`btn ${presetFilter === 'MEGA_CAP' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '4px 10px', fontSize: '0.73rem', flexShrink: 0 }}
            onClick={() => updateConfig({ presetFilter: 'MEGA_CAP' }, true)}
          >
            Megacaps (&gt; $50B)
          </button>
        </div>
      </div>

      {/* 2. Tarjeta de Filtros Estilo Finviz (Descriptive, Fundamental, Technical, All) */}
      <div
        className="glass-panel"
        style={{
          padding: isMobile ? '12px' : '14px 18px',
          marginBottom: isMobile ? '10px' : '14px',
          display: (!isMobile || mobileFiltersExpanded) ? 'block' : 'none',
        }}
      >
        
        {/* Pestañas de Filtros de Finviz */}
        <div
          className="hide-scrollbar"
          style={{
            display: 'flex',
            gap: '4px',
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '10px',
            marginBottom: '12px',
            overflowX: 'auto',
          }}
        >
          <button
            className={`btn ${activeCategory === 'descriptive' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '4px 12px', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}
            onClick={() => updateConfig({ activeCategory: 'descriptive' })}
          >
            Descriptive
          </button>
          <button
            className={`btn ${activeCategory === 'fundamental' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '4px 12px', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}
            onClick={() => updateConfig({ activeCategory: 'fundamental' })}
          >
            Fundamental
          </button>
          <button
            className={`btn ${activeCategory === 'technical' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '4px 12px', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}
            onClick={() => updateConfig({ activeCategory: 'technical' })}
          >
            Technical
          </button>
          <button
            className={`btn ${activeCategory === 'all' ? 'btn-active' : 'btn-secondary'}`}
            style={{ padding: '4px 12px', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}
            onClick={() => updateConfig({ activeCategory: 'all' })}
          >
            All Filters
          </button>
        </div>

        {/* Rejilla de Selectores Dropdown Estilo Finviz */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fill, minmax(185px, 1fr))',
          gap: isMobile ? '8px' : '10px',
          fontSize: '0.76rem'
        }}>
          
          {/* DESCRIPTIVE FILTERS */}
          {(activeCategory === 'descriptive' || activeCategory === 'all') && (
            <>
              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '3px', fontSize: '0.72rem' }}>Sector</label>
                <select value={sectorFilter} onChange={e => updateConfig({ sectorFilter: e.target.value }, true)} style={selectStyle}>
                  <option value="Any">Any</option>
                  {sectors.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '3px', fontSize: '0.72rem' }}>Industry</label>
                <select value={industryFilter} onChange={e => updateConfig({ industryFilter: e.target.value }, true)} style={selectStyle}>
                  <option value="Any">Any</option>
                  {industries.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '3px', fontSize: '0.72rem' }}>Country</label>
                <select value={countryFilter} onChange={e => updateConfig({ countryFilter: e.target.value }, true)} style={selectStyle}>
                  <option value="Any">Any</option>
                  {countries.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '3px', fontSize: '0.72rem' }}>Market Cap</label>
                <select value={marketCapFilter} onChange={e => updateConfig({ marketCapFilter: e.target.value }, true)} style={selectStyle}>
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
                <select value={peFilter} onChange={e => updateConfig({ peFilter: e.target.value }, true)} style={selectStyle}>
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
                <select value={forwardPeFilter} onChange={e => updateConfig({ forwardPeFilter: e.target.value }, true)} style={selectStyle}>
                  <option value="Any">Any</option>
                  <option value="Under 15">Under 15</option>
                  <option value="Under 20">Under 20</option>
                  <option value="Under 30">Under 30</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '3px', fontSize: '0.72rem' }}>PEG</label>
                <select value={pegFilter} onChange={e => updateConfig({ pegFilter: e.target.value }, true)} style={selectStyle}>
                  <option value="Any">Any</option>
                  <option value="Under 1">Under 1</option>
                  <option value="Under 2">Under 2</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '3px', fontSize: '0.72rem' }}>P/S</label>
                <select value={psFilter} onChange={e => updateConfig({ psFilter: e.target.value }, true)} style={selectStyle}>
                  <option value="Any">Any</option>
                  <option value="Under 1">Under 1</option>
                  <option value="Under 3">Under 3</option>
                  <option value="Over 5">Over 5</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '3px', fontSize: '0.72rem' }}>Current Ratio</label>
                <select value={currentRatioFilter} onChange={e => updateConfig({ currentRatioFilter: e.target.value }, true)} style={selectStyle}>
                  <option value="Any">Any</option>
                  <option value="Over 1">Over 1</option>
                  <option value="Over 1.5">Over 1.5</option>
                  <option value="Over 2">Over 2</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '3px', fontSize: '0.72rem' }}>Quick Ratio</label>
                <select value={quickRatioFilter} onChange={e => updateConfig({ quickRatioFilter: e.target.value }, true)} style={selectStyle}>
                  <option value="Any">Any</option>
                  <option value="Over 1">Over 1</option>
                  <option value="Over 1.5">Over 1.5</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '3px', fontSize: '0.72rem' }}>EPS Growth Q/Q</label>
                <select value={epsGrowthQtrFilter} onChange={e => updateConfig({ epsGrowthQtrFilter: e.target.value }, true)} style={selectStyle}>
                  <option value="Any">Any</option>
                  <option value="Over 10%">Over 10%</option>
                  <option value="Over 15%">Over 15%</option>
                  <option value="Over 25%">Over 25%</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '3px', fontSize: '0.72rem' }}>EPS Growth TTM</label>
                <select value={epsGrowthTtmFilter} onChange={e => updateConfig({ epsGrowthTtmFilter: e.target.value }, true)} style={selectStyle}>
                  <option value="Any">Any</option>
                  <option value="Over 10%">Over 10%</option>
                  <option value="Over 15%">Over 15%</option>
                  <option value="Over 25%">Over 25%</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '3px', fontSize: '0.72rem' }}>Net Profit Margin</label>
                <select value={profitMarginFilter} onChange={e => updateConfig({ profitMarginFilter: e.target.value }, true)} style={selectStyle}>
                  <option value="Any">Any</option>
                  <option value="Positive (>0%)">Positive (&gt;0%)</option>
                  <option value="Over 15%">Over 15%</option>
                  <option value="Over 20%">Over 20%</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '3px', fontSize: '0.72rem' }}>Debt / Equity</label>
                <select value={debtEquityFilter} onChange={e => updateConfig({ debtEquityFilter: e.target.value }, true)} style={selectStyle}>
                  <option value="Any">Any</option>
                  <option value="Under 0.5">Under 0.5</option>
                  <option value="Under 1">Under 1</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '3px', fontSize: '0.72rem' }}>ROIC</label>
                <select value={roicFilter} onChange={e => updateConfig({ roicFilter: e.target.value }, true)} style={selectStyle}>
                  <option value="Any">Any</option>
                  <option value="Over 10%">Over 10%</option>
                  <option value="Over 15%">Over 15%</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '3px', fontSize: '0.72rem' }}>Sales Growth Q/Q</label>
                <select value={salesGrowthQtrFilter} onChange={e => updateConfig({ salesGrowthQtrFilter: e.target.value }, true)} style={selectStyle}>
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
                <select value={rsiFilter} onChange={e => updateConfig({ rsiFilter: e.target.value }, true)} style={selectStyle}>
                  <option value="Any">Any</option>
                  <option value="Oversold (30)">Oversold (30)</option>
                  <option value="Overbought (70)">Overbought (70)</option>
                  <option value="Bullish (50-70)">Bullish (50-70)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '3px', fontSize: '0.72rem' }}>Change %</label>
                <select value={changePctFilter} onChange={e => updateConfig({ changePctFilter: e.target.value }, true)} style={selectStyle}>
                  <option value="Any">Any</option>
                  <option value="Up">Up (&gt;0%)</option>
                  <option value="Down">Down (&lt;0%)</option>
                  <option value="Up 3%+">Up 3%+</option>
                  <option value="Down 3%+">Down 3%+</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '3px', fontSize: '0.72rem' }}>20-Day SMA</label>
                <select value={sma20Filter} onChange={e => updateConfig({ sma20Filter: e.target.value }, true)} style={selectStyle}>
                  <option value="Any">Any</option>
                  <option value="Price above SMA20">Price above SMA20</option>
                  <option value="Price below SMA20">Price below SMA20</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '3px', fontSize: '0.72rem' }}>50-Day SMA</label>
                <select value={sma50Filter} onChange={e => updateConfig({ sma50Filter: e.target.value }, true)} style={selectStyle}>
                  <option value="Any">Any</option>
                  <option value="Price above SMA50">Price above SMA50</option>
                  <option value="Price below SMA50">Price below SMA50</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '3px', fontSize: '0.72rem' }}>200-Day SMA</label>
                <select value={sma200Filter} onChange={e => updateConfig({ sma200Filter: e.target.value }, true)} style={selectStyle}>
                  <option value="Any">Any</option>
                  <option value="Price above SMA200">Price above SMA200</option>
                  <option value="Price below SMA200">Price below SMA200</option>
                </select>
              </div>
            </>
          )}

        </div>
      </div>

      {/* 3. Selector de Vistas + Conmutador Móvil (Tarjetas | Tabla) + Ordenamiento */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        marginBottom: '10px',
        padding: '0 2px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
        }}>
          <div
            className={isMobile ? 'hide-scrollbar' : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              flexWrap: isMobile ? 'nowrap' : 'wrap',
              overflowX: isMobile ? 'auto' : 'visible',
              WebkitOverflowScrolling: 'touch',
              maxWidth: '100%',
              paddingBottom: isMobile ? '2px' : 0,
            }}
          >
            {(
              [
                { id: 'custom', label: isMobile ? 'Custom (28)' : 'Custom (28 Columnas)', bold: true },
                { id: 'overview', label: 'Overview', bold: false },
                { id: 'valuation', label: 'Valoración', bold: false },
                { id: 'financial', label: 'Financiero', bold: false },
                { id: 'performance', label: 'Rendimiento', bold: false },
                { id: 'technical', label: 'Técnico', bold: false },
              ] as { id: TableView; label: string; bold: boolean }[]
            ).map(({ id, label, bold }) => (
              <button
                key={id}
                className={`btn ${tableView === id ? 'btn-active' : 'btn-secondary'}`}
                style={{ padding: '4px 10px', fontSize: '0.73rem', fontWeight: bold ? 700 : 600, flexShrink: 0 }}
                onClick={() => updateConfig({ tableView: id })}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'space-between' : 'flex-end' }}>
            {/* Conmutador Tarjetas / Tabla en Celular */}
            {isMobile && (
              <div style={{
                display: 'inline-flex',
                background: '#080d18',
                border: '1px solid var(--border-medium)',
                borderRadius: '8px',
                padding: '2px',
                gap: '2px',
              }}>
                <button
                  type="button"
                  onClick={() => setMobileScreenerLayout('cards')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 9px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    background: mobileScreenerLayout === 'cards' ? 'var(--accent-green-bg)' : 'transparent',
                    color: mobileScreenerLayout === 'cards' ? 'var(--accent-green)' : 'var(--text-muted)',
                  }}
                >
                  <LayoutGrid size={13} />
                  Tarjetas
                </button>
                <button
                  type="button"
                  onClick={() => setMobileScreenerLayout('table')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 9px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    background: mobileScreenerLayout === 'table' ? 'var(--accent-green-bg)' : 'transparent',
                    color: mobileScreenerLayout === 'table' ? 'var(--accent-green)' : 'var(--text-muted)',
                  }}
                >
                  <Table2 size={13} />
                  Tabla
                </button>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              <span>{isMobile ? 'Filas:' : 'Mostrar:'}</span>
              <select 
                value={pageSize} 
                onChange={(e) => updateConfig({ pageSize: Number(e.target.value) }, true)}
                style={{ ...selectStyle, width: 'auto', padding: '3px 8px', fontSize: '0.73rem' }}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>

        {/* Selector de Ordenamiento Rápido en Modo Tarjetas Móvil */}
        {isMobile && mobileScreenerLayout === 'cards' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(11, 17, 30, 0.75)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: '5px 8px',
          }}>
            <span style={{ fontSize: '0.71rem', color: 'var(--text-muted)', fontWeight: 700, whiteSpace: 'nowrap' }}>
              Ordenar por:
            </span>
            <select
              value={sortField}
              onChange={(e) => handleSort(e.target.value as SortField)}
              style={{ ...selectStyle, flex: 1, padding: '4px 8px', fontSize: '0.74rem' }}
            >
              {CUSTOM_COLUMNS.map((col) => (
                <option key={col.field} value={col.field}>
                  {col.title ? `${col.label} — ${col.title}` : col.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => updateConfig({ sortAsc: !sortAsc })}
              className="btn btn-secondary"
              style={{ padding: '4px 8px', fontSize: '0.72rem', fontWeight: 800, flexShrink: 0 }}
              title={sortAsc ? 'Orden Ascendente' : 'Orden Descendente'}
            >
              {sortAsc ? <ArrowUp size={13} color="var(--accent-green)" /> : <ArrowDown size={13} color="var(--accent-green)" />}
              {sortAsc ? 'ASC' : 'DESC'}
            </button>
          </div>
        )}
      </div>

      {/* 4A. MODO TARJETAS BURSÁTILES COMPACTAS (Por defecto en Celular < 768px) */}
      {isMobile && mobileScreenerLayout === 'cards' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
          {paginatedStocks.map((stock) => {
            const analysis = calculateFactorGrades(stock);
            const isSelected = selectedStock?.ticker === stock.ticker;
            const fcfVal = computeStockFCF(stock);
            const tgtDiff = computeTargetDiff(stock);

            // Métricas dinámicas según la pestaña de vista activa
            let cardMetrics: { label: string; value: React.ReactNode }[] = [];
            if (tableView === 'valuation') {
              cardMetrics = [
                { label: 'Cap. Mercado', value: formatCurrencyUSD(stock.market_cap, { shortUnit: true }) },
                { label: 'P/E Actual', value: stock.pe ? stock.pe.toFixed(1) : '—' },
                { label: 'Forward P/E', value: <span style={{ color: 'var(--accent-cyan)' }}>{stock.forward_pe ? stock.forward_pe.toFixed(1) : '—'}</span> },
                { label: 'PEG Ratio', value: <span style={{ color: stock.peg && stock.peg < 1 ? 'var(--accent-green)' : 'inherit' }}>{stock.peg ? stock.peg.toFixed(2) : '—'}</span> },
                { label: 'P/S · EV/Eb', value: `${stock.ps ? stock.ps.toFixed(1) : '—'} · ${stock.ev_ebitda ? stock.ev_ebitda.toFixed(1) : '—'}` },
                { label: 'FCF Anual', value: fcfVal !== null ? <span style={{ color: fcfVal >= 0 ? 'var(--accent-green)' : '#ef4444' }}>{formatCurrencyUSD(fcfVal, { shortUnit: true, decimals: 1, spaceBeforeUnit: false })}</span> : '—' },
              ];
            } else if (tableView === 'financial') {
              cardMetrics = [
                { label: 'Ventas TTM', value: formatCurrencyUSD(stock.sales, { shortUnit: true }) },
                { label: 'Ventas YoY', value: stock.sales_yoy_ttm ? <span style={{ color: stock.sales_yoy_ttm >= 10 ? 'var(--accent-green)' : 'inherit' }}>{formatPercentage(stock.sales_yoy_ttm, 1)}</span> : '—' },
                { label: 'Margen Neto', value: stock.profit_m !== undefined && stock.profit_m !== null ? <span style={{ color: stock.profit_m >= 15 ? 'var(--accent-green)' : 'inherit' }}>{stock.profit_m.toFixed(1)}%</span> : '—' },
                { label: 'ROIC', value: stock.roic ? <span style={{ color: stock.roic >= 15 ? 'var(--accent-green)' : 'inherit' }}>{stock.roic.toFixed(1)}%</span> : '—' },
                { label: 'Curr · Deuda/Eq', value: `${stock.curr_r ? stock.curr_r.toFixed(2) : '—'} · ${stock.debt_eq !== undefined && stock.debt_eq !== null ? stock.debt_eq.toFixed(2) : '—'}` },
                { label: 'FCF Anual', value: fcfVal !== null ? <span style={{ color: fcfVal >= 0 ? 'var(--accent-green)' : '#ef4444' }}>{formatCurrencyUSD(fcfVal, { shortUnit: true, decimals: 1, spaceBeforeUnit: false })}</span> : '—' },
              ];
            } else if (tableView === 'performance' || tableView === 'technical') {
              cardMetrics = [
                { label: 'RSI (14D)', value: stock.rsi ? <span style={{ color: stock.rsi >= 70 ? '#ef4444' : stock.rsi <= 35 ? 'var(--accent-cyan)' : '#fff' }}>{stock.rsi.toFixed(1)}</span> : '—' },
                { label: 'SMA 50 %', value: stock.sma50 !== undefined && stock.sma50 !== null ? <span style={{ color: stock.sma50 >= 0 ? 'var(--accent-green)' : '#ef4444' }}>{formatPercentage(stock.sma50, 1)}</span> : '—' },
                { label: 'SMA 200 %', value: stock.sma200 !== undefined && stock.sma200 !== null ? <span style={{ color: stock.sma200 >= 0 ? 'var(--accent-green)' : '#ef4444' }}>{formatPercentage(stock.sma200, 1)}</span> : '—' },
                { label: 'EPS Q/Q · 5A', value: `${stock.eps_qq !== undefined && stock.eps_qq !== null ? formatPercentage(stock.eps_qq, 1) : '—'} · ${stock.eps_past_5y ? formatPercentage(stock.eps_past_5y, 1) : '—'}` },
                { label: 'Target · Dif.', value: tgtDiff ? <span style={{ color: tgtDiff.diffPct >= 0 ? 'var(--accent-green)' : '#ef4444' }}>${stock.target_price?.toFixed(0)} ({tgtDiff.diffPct >= 0 ? '+' : ''}{tgtDiff.diffPct.toFixed(1)}%)</span> : '—' },
                { label: 'Volumen', value: formatVolumeShares(stock.volume) },
              ];
            } else {
              // Custom (28 cols) u Overview: resumen ejecutivo de las métricas clave
              cardMetrics = [
                { label: 'Cap. Mercado', value: formatCurrencyUSD(stock.market_cap, { shortUnit: true }) },
                { label: 'P/E · Fwd P/E', value: <span>{stock.pe ? stock.pe.toFixed(1) : '—'} · <span style={{ color: 'var(--accent-cyan)' }}>{stock.forward_pe ? stock.forward_pe.toFixed(1) : '—'}</span></span> },
                { label: 'PEG · ROIC', value: <span><span style={{ color: stock.peg && stock.peg < 1 ? 'var(--accent-green)' : 'inherit' }}>{stock.peg ? stock.peg.toFixed(2) : '—'}</span> · <span style={{ color: (stock.roic ?? 0) >= 15 ? 'var(--accent-green)' : 'inherit' }}>{stock.roic ? `${stock.roic.toFixed(1)}%` : '—'}</span></span> },
                { label: 'FCF Anual', value: fcfVal !== null ? <span style={{ color: fcfVal >= 0 ? 'var(--accent-green)' : '#ef4444' }}>{formatCurrencyUSD(fcfVal, { shortUnit: true, decimals: 1, spaceBeforeUnit: false })}</span> : '—' },
                { label: 'Margen · RSI', value: `${stock.profit_m !== undefined && stock.profit_m !== null ? `${stock.profit_m.toFixed(1)}%` : '—'} · ${stock.rsi ? stock.rsi.toFixed(0) : '—'}` },
                { label: 'Dif. Target', value: tgtDiff ? <span style={{ color: tgtDiff.diffPct >= 0 ? 'var(--accent-green)' : '#ef4444' }}>{tgtDiff.diffPct >= 0 ? '+' : ''}{tgtDiff.diffPct.toFixed(1)}% (${stock.target_price?.toFixed(0)})</span> : '—' },
              ];
            }

            return (
              <div
                key={stock.ticker}
                onClick={() => onSelectStock(stock)}
                className="glass-panel"
                style={{
                  padding: '11px 12px',
                  borderRadius: '11px',
                  border: isSelected ? '1px solid var(--accent-green)' : '1px solid var(--border-subtle)',
                  background: isSelected ? 'rgba(16, 185, 129, 0.08)' : 'rgba(13, 19, 31, 0.88)',
                  cursor: 'pointer',
                }}
              >
                {/* Cabecera de Tarjeta: Ticker + Quant + Precio + Botón Menú */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span className="font-mono" style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff' }}>
                        {stock.ticker}
                      </span>
                      <span
                        style={{
                          padding: '1px 5px',
                          borderRadius: '4px',
                          fontWeight: 800,
                          fontSize: '0.64rem',
                          background: analysis.quantScore >= 4.0 ? 'rgba(16, 185, 129, 0.2)' : analysis.quantScore >= 3.0 ? 'rgba(6, 182, 212, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                          color: analysis.quantScore >= 4.0 ? 'var(--accent-green)' : analysis.quantScore >= 3.0 ? 'var(--accent-cyan)' : '#ef4444',
                          border: `1px solid ${analysis.quantScore >= 4.0 ? 'rgba(16, 185, 129, 0.4)' : analysis.quantScore >= 3.0 ? 'rgba(6, 182, 212, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                        }}
                      >
                        ★ {analysis.quantScore} · {analysis.quantRating.startsWith('Fuerte C') ? 'F. Compra' : analysis.quantRating}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                      {stock.company || '—'} {stock.sector ? <span style={{ color: 'var(--text-muted)' }}>• {stock.sector}</span> : null}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div className="font-mono" style={{ fontSize: '0.94rem', fontWeight: 800, color: '#fff' }}>
                        ${stock.price !== undefined && stock.price !== null ? stock.price.toFixed(2) : '—'}
                      </div>
                      {stock.change_pct !== undefined && stock.change_pct !== null && (
                        <div
                          className="font-mono"
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: stock.change_pct >= 0 ? 'var(--accent-green)' : '#ef4444',
                          }}
                        >
                          {stock.change_pct >= 0 ? '+' : ''}{stock.change_pct.toFixed(2)}%
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      aria-label={`Opciones para ${stock.ticker}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setContextMenu({ x: 16, y: 120, stock });
                      }}
                      style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '7px',
                        border: '1px solid var(--border-subtle)',
                        background: 'rgba(255, 255, 255, 0.04)',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <MoreVertical size={15} />
                    </button>
                  </div>
                </div>

                {/* Grilla 3x2 de Métricas Clave */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: '6px',
                    paddingTop: '7px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  {cardMetrics.map((m, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'rgba(6, 10, 18, 0.65)',
                        borderRadius: '6px',
                        padding: '4px 6px',
                        minWidth: 0,
                      }}
                    >
                      <div style={{ fontSize: '0.59rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {m.label}
                      </div>
                      <div className="font-mono" style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f1f5f9', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {m.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4B. Tabla Unificada de Alta Densidad (100% Fija en Monitores >= 1400px | Scroll Suave + Ticker Sticky en Portátiles/Tablets/Móvil) */}
      {(!isMobile || mobileScreenerLayout === 'table') && (
      <div 
        className="glass-panel" 
        style={{ 
          width: '100%', 
          overflowX: isDesktopWide ? 'hidden' : 'auto', 
          WebkitOverflowScrolling: 'touch',
          padding: '0', 
          borderRadius: '8px', 
          border: '1px solid var(--border-medium)' 
        }}
      >
        <table style={{
          width: '100%',
          minWidth: isDesktopWide ? '100%' : (tableView === 'custom' ? '1580px' : '820px'),
          tableLayout: 'fixed',
          borderCollapse: 'collapse',
          fontSize: isDesktopWide ? '0.67rem' : '0.71rem',
          letterSpacing: '-0.2px'
        }}>
          <thead>
            <tr style={{ background: '#090e1a', borderBottom: '1px solid var(--border-medium)' }}>
              {(tableView === 'custom' ? CUSTOM_COLUMNS : getPartialViewColumns(tableView)).map(({ field, label, title, align, width }) => {
                const isSorted = sortField === field;
                const isCustom = tableView === 'custom';
                const isStickyTicker = !isDesktopWide && field === 'ticker';
                return (
                  <th
                    key={field}
                    className={isStickyTicker ? 'sticky-col-left' : undefined}
                    onClick={() => handleSort(field)}
                    style={{
                      width,
                      textAlign: align,
                      padding: isCustom ? '7px 3px' : '7px 5px',
                      cursor: 'pointer',
                      userSelect: 'none',
                      color: isSorted ? '#fff' : 'var(--text-secondary)',
                      background: isStickyTicker
                        ? '#090e1a'
                        : isSorted
                        ? 'rgba(16, 185, 129, 0.12)'
                        : 'transparent',
                      borderBottom: isSorted ? '2px solid var(--accent-green)' : '1px solid var(--border-medium)',
                      fontWeight: 700,
                      fontSize: isCustom ? '0.63rem' : '0.67rem',
                      textTransform: isCustom ? 'uppercase' : 'none',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                    title={`${title || label} (${isSorted ? (sortAsc ? 'Ascendente' : 'Descendente') : 'Clic para ordenar'})`}
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
            </tr>
          </thead>
          <tbody>
            {paginatedStocks.map(stock => {
              const analysis = calculateFactorGrades(stock);
              const isSelected = selectedStock?.ticker === stock.ticker;
              const fcfVal = computeStockFCF(stock);
              const tgtDiff = computeTargetDiff(stock);

              return (
                <tr 
                  key={stock.ticker}
                  style={{
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(16, 185, 129, 0.10)' : 'transparent',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    transition: 'background 0.12s ease'
                  }}
                  className={`data-row-hover ${isSelected ? 'selected-row' : ''}`}
                  onClick={() => onSelectStock(stock)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const x = Math.min(e.clientX, window.innerWidth - 240);
                    const y = Math.min(e.clientY, window.innerHeight - 200);
                    setContextMenu({ x, y, stock });
                  }}
                >
                  
                  {/* FILAS DE VISTA CUSTOM (28 COLUMNAS EXACTAS) */}
                  {tableView === 'custom' && (
                    <>
                      {/* 1. Ticker */}
                      <td
                        className={!isDesktopWide ? 'sticky-col-left' : undefined}
                        style={{ padding: '5px 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                      >
                        <span className="font-mono" style={{ fontWeight: 800, color: '#fff', fontSize: '0.73rem' }}>
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

                      {/* 18. Dif. Tgt (Target Price vs Precio Actual) */}
                      <td
                        className="font-mono"
                        style={{
                          padding: '3px 2px',
                          textAlign: 'right',
                          whiteSpace: 'nowrap',
                          lineHeight: 1.15
                        }}
                        title={
                          tgtDiff
                            ? `Diferencia Tgt Prc ($${stock.target_price?.toFixed(2)}) vs Precio ($${stock.price?.toFixed(2)}): ${tgtDiff.diffUsd >= 0 ? '+' : ''}$${tgtDiff.diffUsd.toFixed(2)} USD (${tgtDiff.diffPct >= 0 ? '+' : ''}${tgtDiff.diffPct.toFixed(2)}%)`
                            : 'Sin Target Price disponible'
                        }
                      >
                        {tgtDiff ? (
                          <div style={{ color: tgtDiff.diffPct >= 0 ? 'var(--accent-green)' : '#ef4444', fontWeight: 700 }}>
                            <div>{tgtDiff.diffPct >= 0 ? '+' : ''}{tgtDiff.diffPct.toFixed(1)}%</div>
                            <div style={{ fontSize: '0.57rem', opacity: 0.85 }}>
                              {tgtDiff.diffUsd >= 0 ? '+$' : '-$'}{Math.abs(tgtDiff.diffUsd).toFixed(1)}
                            </div>
                          </div>
                        ) : '—'}
                      </td>

                      {/* 19. PEG */}
                      <td className="font-mono" style={{ padding: '4px 2px', textAlign: 'right', fontWeight: 600, color: (stock.peg && stock.peg < 1.0) ? 'var(--accent-green)' : 'inherit', whiteSpace: 'nowrap' }}>
                        {stock.peg ? stock.peg.toFixed(2) : '—'}
                      </td>

                      {/* 20. Current Ratio */}
                      <td className="font-mono" style={{ padding: '4px 2px', textAlign: 'right', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {stock.curr_r ? stock.curr_r.toFixed(2) : '—'}
                      </td>

                      {/* 21. Debt / Equity */}
                      <td className="font-mono" style={{ padding: '4px 2px', textAlign: 'right', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {stock.debt_eq !== undefined && stock.debt_eq !== null ? stock.debt_eq.toFixed(2) : '—'}
                      </td>

                      {/* 22. EPS */}
                      <td className="font-mono" style={{ padding: '4px 2px', textAlign: 'right', color: '#fff', whiteSpace: 'nowrap' }}>
                        {stock.eps ? stock.eps.toFixed(2) : '—'}
                      </td>

                      {/* 23. FCF (Free Cash Flow) */}
                      <td
                        className="font-mono"
                        style={{
                          padding: '4px 2px',
                          textAlign: 'right',
                          fontWeight: 600,
                          color: fcfVal !== null ? (fcfVal >= 0 ? 'var(--accent-green)' : '#ef4444') : 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                        title={fcfVal !== null ? `Free Cash Flow: ${formatCurrencyUSD(fcfVal)}` : 'FCF no disponible'}
                      >
                        {fcfVal !== null ? formatCurrencyUSD(fcfVal, { shortUnit: true, decimals: 1, spaceBeforeUnit: false }) : '—'}
                      </td>

                      {/* 24. ROIC */}
                      <td className="font-mono" style={{ padding: '4px 2px', textAlign: 'right', fontWeight: 700, color: (stock.roic ?? 0) >= 15 ? 'var(--accent-green)' : 'inherit', whiteSpace: 'nowrap' }}>
                        {stock.roic ? `${stock.roic.toFixed(1)}%` : '—'}
                      </td>

                      {/* 25. SMA 200 */}
                      <td className="font-mono" style={{ padding: '4px 2px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {stock.sma200 !== undefined && stock.sma200 !== null ? (
                          <span style={{ color: stock.sma200 >= 0 ? 'var(--accent-green)' : '#ef4444', fontWeight: 600 }}>
                            {formatPercentage(stock.sma200, 1)}
                          </span>
                        ) : '—'}
                      </td>

                      {/* 26. Sales (Formato Moneda USD en B USD / M USD / T USD) */}
                      <td className="font-mono" style={{ padding: '4px 2px', textAlign: 'right', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={stock.sales ? `$${stock.sales.toLocaleString()} USD` : ''}>
                        {formatCurrencyUSD(stock.sales, { shortUnit: true })}
                      </td>

                      {/* 27. Sales YoY TTM */}
                      <td className="font-mono" style={{ padding: '4px 2px', textAlign: 'right', color: (stock.sales_yoy_ttm ?? 0) >= 10 ? 'var(--accent-green)' : 'inherit', whiteSpace: 'nowrap' }}>
                        {stock.sales_yoy_ttm ? formatPercentage(stock.sales_yoy_ttm, 1) : '—'}
                      </td>

                      {/* 28. Quant Rating (Pill Cuantitativo de Screener Quant) */}
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
                    </>
                  )}

                  {/* FILAS DE VISTAS PARCIALES (OVERVIEW, VALUATION, FINANCIAL, ETC) */}
                  {tableView !== 'custom' && (
                    <>
                      <td
                        className={!isDesktopWide ? 'sticky-col-left' : undefined}
                        style={{ padding: '6px 6px' }}
                      >
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
                    </>
                  )}

                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}

      {/* 5. Controles de Paginación */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: isMobile ? 'center' : 'space-between',
        marginTop: '12px',
        padding: '0 4px',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ fontSize: isMobile ? '0.73rem' : '0.78rem', color: 'var(--text-muted)' }}>
          Pág. <strong>{page}</strong> de <strong>{Math.max(1, totalPages)}</strong> ({filteredStocks.length} resultados)
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button 
            className="btn btn-secondary" 
            style={{ padding: '5px 9px', fontSize: '0.74rem' }}
            disabled={page === 1}
            onClick={() => updateConfig({ page: Math.max(1, page - 1) })}
          >
            <ChevronLeft size={13} /> {!isMobile && 'Anterior'}
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
                  onClick={() => updateConfig({ page: pNum })}
                >
                  {pNum}
                </button>
              );
            })}
          </div>

          <button 
            className="btn btn-secondary" 
            style={{ padding: '5px 9px', fontSize: '0.74rem' }}
            disabled={page >= totalPages}
            onClick={() => updateConfig({ page: Math.min(totalPages, page + 1) })}
          >
            {!isMobile && 'Siguiente'} <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {/* Menú Contextual Flotante (Clic Derecho en PC / Hoja de Acciones en Celular) */}
      {contextMenu && (
        <div
          style={
            isMobile
              ? {
                  position: 'fixed',
                  left: '12px',
                  right: '12px',
                  bottom: 'calc(var(--mobile-bottom-nav-h, 64px) + env(safe-area-inset-bottom, 0px) + 12px)',
                  zIndex: 9999,
                  background: 'rgba(11, 19, 32, 0.99)',
                  backdropFilter: 'blur(18px)',
                  border: '1px solid rgba(56, 189, 248, 0.45)',
                  borderRadius: '14px',
                  boxShadow: '0 20px 45px rgba(0, 0, 0, 0.85)',
                  padding: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }
              : {
                  position: 'fixed',
                  top: contextMenu.y,
                  left: contextMenu.x,
                  zIndex: 9999,
                  background: 'rgba(11, 19, 32, 0.98)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  borderRadius: '10px',
                  boxShadow: '0 16px 36px rgba(0, 0, 0, 0.75)',
                  minWidth: '230px',
                  padding: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                }
          }
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="font-mono" style={{ fontWeight: 900, color: 'var(--accent-cyan)', fontSize: '0.90rem' }}>
                {contextMenu.stock.ticker}
              </span>
              <span className="font-mono" style={{ fontSize: '0.80rem', color: '#fff', fontWeight: 700 }}>
                ${(contextMenu.stock.price || 0).toFixed(2)}
              </span>
            </div>
            <span style={{ fontSize: '0.70rem', color: 'var(--text-muted)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {contextMenu.stock.company}
            </span>
          </div>

          <button
            onClick={() => {
              setModalStock(contextMenu.stock);
              setShowAddPositionModal(true);
              setContextMenu(null);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 10px',
              borderRadius: '6px',
              border: 'none',
              background: 'transparent',
              color: '#fff',
              fontSize: '0.80rem',
              fontWeight: 700,
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <Briefcase size={14} color="var(--accent-green)" />
            Agregar a Mi Cartera (Long/Short)
          </button>

          <button
            onClick={() => {
              setModalStock(contextMenu.stock);
              setShowAddToWatchlistModal(true);
              setContextMenu(null);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 10px',
              borderRadius: '6px',
              border: 'none',
              background: 'transparent',
              color: '#fff',
              fontSize: '0.80rem',
              fontWeight: 700,
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(6, 182, 212, 0.15)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <Bookmark size={14} color="var(--accent-cyan)" />
            Agregar a Lista de Seguimiento
          </button>

          <button
            onClick={() => {
              onSelectStock(contextMenu.stock);
              setContextMenu(null);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 10px',
              borderRadius: '6px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '0.80rem',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <ExternalLink size={14} />
            Ver Análisis Completo
          </button>
        </div>
      )}

      {/* Modal Registrar Posición Real en Mi Cartera */}
      <AddPositionModal
        isOpen={showAddPositionModal}
        onClose={() => setShowAddPositionModal(false)}
        stock={modalStock}
      />

      {/* Modal Agregar a Listas de Seguimiento */}
      <AddToWatchlistModal
        isOpen={showAddToWatchlistModal}
        onClose={() => setShowAddToWatchlistModal(false)}
        stock={modalStock}
      />

    </div>
  );
};
