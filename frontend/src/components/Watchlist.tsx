import React, { useState, useMemo, useEffect } from 'react';
import { 
  Trash2, 
  Eye, 
  Plus, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight, 
  X, 
  Briefcase,
  ChevronDown,
  ChevronUp,
  DollarSign,
  ArrowDownLeft,
  PieChart as PieIcon,
  CheckCircle2,
  Layers,
  Bookmark,
  FolderPlus,
  Search,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { toast } from 'sonner';
import type { StockRecord } from '../types/stock';
import { 
  getPortfolioPositions, 
  savePortfolioPositions, 
  type PortfolioPosition as ExternalPortfolioPosition 
} from '../utils/portfolioManager';
import { 
  getCustomWatchlists, 
  saveCustomWatchlists, 
  createCustomWatchlist, 
  deleteCustomWatchlist, 
  addTickerToWatchlist, 
  removeTickerFromWatchlist, 
  type CustomWatchlist 
} from '../utils/customWatchlistService';
import { AddPositionModal } from './AddPositionModal';
import { AddToWatchlistModal } from './AddToWatchlistModal';

export interface PortfolioPosition {
  id: string;
  ticker: string;
  direction: 'LONG' | 'SHORT';
  shares: number;
  entryPrice: number;
  entryDate: string; // 'YYYY-MM-DD'
  notes?: string;
}

export interface ClosedTrade {
  id: string;
  ticker: string;
  direction: 'LONG' | 'SHORT';
  shares: number;
  entryPrice: number;
  exitPrice: number;
  entryDate: string;
  exitDate: string;
  realizedPnl: number;
  realizedPnlPct: number;
}

interface WatchlistProps {
  stocks: StockRecord[];
  watchlist: string[];
  onToggleWatchlist: (ticker: string) => void;
  onSelectStock: (stock: StockRecord) => void;
  onGoToScreener: () => void;
  onAuditPortfolioWithAI?: () => void;
}

type PnlTimeframe = '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | '2Y' | 'ALL';

const PIE_COLORS = [
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#f59e0b', // amber
  '#14b8a6', // teal
  '#6366f1', // indigo
  '#f97316', // orange
  '#84cc16', // lime
  '#a855f7'  // violet
];

export const Watchlist: React.FC<WatchlistProps> = ({
  stocks,
  watchlist,
  onToggleWatchlist,
  onSelectStock,
  onGoToScreener,
  onAuditPortfolioWithAI
}) => {
  // Modal de Añadir Posición
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalTicker, setModalTicker] = useState('NVDA');
  const [modalDirection, setModalDirection] = useState<'LONG' | 'SHORT'>('LONG');
  const [modalShares, setModalShares] = useState<number>(10);
  const [modalPrice, setModalPrice] = useState<number>(120);
  const [modalDate, setModalDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [modalNotes, setModalNotes] = useState('');

  // Modal de Cerrar Posición
  const [closingLot, setClosingLot] = useState<PortfolioPosition | null>(null);
  const [closeShares, setCloseShares] = useState<number>(1);
  const [closePrice, setClosePrice] = useState<number>(100);

  // Modal de Gestión de Efectivo
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashAction, setCashAction] = useState<'DEPOSIT' | 'WITHDRAW'>('DEPOSIT');
  const [cashAmountInput, setCashAmountInput] = useState<number>(1000);
  const [cashNoteInput, setCashNoteInput] = useState<string>('');

  // Rango de tiempo para el gráfico de P&L
  const [pnlTimeframe, setPnlTimeframe] = useState<PnlTimeframe>('1M');

  // Control de tickers con lotes desplegados
  const [expandedTickers, setExpandedTickers] = useState<Set<string>>(new Set());

  // Efectivo Disponible (persiste en localStorage)
  const [cashAvailable, setCashAvailable] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('inversor_colombia_portfolio_cash');
      if (saved !== null) return Number(saved);
    } catch {
      // Ignorar
    }
    return 10000; // $10,000 USD por defecto
  });

  const saveCash = (newCash: number) => {
    const valid = Math.max(0, Number(newCash.toFixed(2)));
    setCashAvailable(valid);
    try {
      localStorage.setItem('inversor_colombia_portfolio_cash', valid.toString());
    } catch (e) {
      console.error('Error saving portfolio cash:', e);
    }
  };

  // Pestaña Principal: 'PORTFOLIO' (Mi Cartera Real) vs 'WATCHLISTS' (Listas de Seguimiento Agrupadas)
  const [activeMainTab, setActiveMainTab] = useState<'PORTFOLIO' | 'WATCHLISTS'>('PORTFOLIO');

  // Listas de seguimiento personalizadas
  const [customLists, setCustomLists] = useState<CustomWatchlist[]>(() => getCustomWatchlists());
  const [selectedListId, setSelectedListId] = useState<string>(() => {
    const lists = getCustomWatchlists();
    return lists[0]?.id || 'list-fav';
  });
  const [quickTickerInput, setQuickTickerInput] = useState<string>('');

  // Modal para Crear Nueva Lista de Seguimiento
  const [showCreateListModal, setShowCreateListModal] = useState<boolean>(false);
  const [newListName, setNewListName] = useState<string>('');
  const [newListDesc, setNewListDesc] = useState<string>('');
  const [newListColor, setNewListColor] = useState<string>('#06b6d4');

  // Modal para Añadir a Cartera desde una Lista de Seguimiento
  const [portfolioModalStock, setPortfolioModalStock] = useState<StockRecord | null>(null);
  const [showPortfolioModal, setShowPortfolioModal] = useState<boolean>(false);

  // Posiciones de cartera persistidas en localStorage
  const [positions, setPositions] = useState<PortfolioPosition[]>(() => {
    return getPortfolioPositions() as PortfolioPosition[];
  });

  const savePositions = (newPositions: PortfolioPosition[]) => {
    setPositions(newPositions);
    savePortfolioPositions(newPositions as any);
  };

  // Sincronización en tiempo real con eventos de cartera y listas de seguimiento
  useEffect(() => {
    const handlePositionsUpdate = () => {
      setPositions(getPortfolioPositions() as PortfolioPosition[]);
    };
    const handleWatchlistsUpdate = () => {
      const lists = getCustomWatchlists();
      setCustomLists(lists);
      if (!lists.some(l => l.id === selectedListId)) {
        setSelectedListId(lists[0]?.id || '');
      }
    };
    window.addEventListener('portfolio_positions_updated', handlePositionsUpdate);
    window.addEventListener('custom_watchlists_updated', handleWatchlistsUpdate);
    return () => {
      window.removeEventListener('portfolio_positions_updated', handlePositionsUpdate);
      window.removeEventListener('custom_watchlists_updated', handleWatchlistsUpdate);
    };
  }, [selectedListId]);

  // Historial de Operaciones Cerradas
  const [closedTrades, setClosedTrades] = useState<ClosedTrade[]>(() => {
    try {
      const saved = localStorage.getItem('inversor_colombia_closed_trades');
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignorar
    }
    return [];
  });

  const saveClosedTrades = (newTrades: ClosedTrade[]) => {
    setClosedTrades(newTrades);
    try {
      localStorage.setItem('inversor_colombia_closed_trades', JSON.stringify(newTrades));
    } catch (e) {
      console.error('Error saving closed trades:', e);
    }
  };

  // Pre-cargar precio al cambiar ticker en modal de añadir
  useEffect(() => {
    const s = stocks.find(st => st.ticker.toUpperCase() === modalTicker.toUpperCase());
    if (s && s.price) {
      setModalPrice(s.price);
    }
  }, [modalTicker, stocks]);

  // Alternar desplegable de lotes de un ticker
  const toggleExpandTicker = (ticker: string) => {
    setExpandedTickers(prev => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker);
      else next.add(ticker);
      return next;
    });
  };

  // Mapa de cotizaciones
  const stocksMap = useMemo(() => {
    const map = new Map<string, StockRecord>();
    stocks.forEach(s => map.set(s.ticker.toUpperCase(), s));
    return map;
  }, [stocks]);

  // Añadir Posición
  const handleAddPosition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTicker || modalShares <= 0 || modalPrice <= 0) return;

    const t = modalTicker.toUpperCase().trim();
    const cost = modalShares * modalPrice;

    const newPos: PortfolioPosition = {
      id: `pos-${Date.now()}`,
      ticker: t,
      direction: modalDirection,
      shares: Number(modalShares),
      entryPrice: Number(modalPrice),
      entryDate: modalDate || new Date().toISOString().slice(0, 10),
      notes: modalNotes.trim() || undefined
    };

    const updated = [newPos, ...positions];
    savePositions(updated);

    // Ajustar efectivo si hay disponible
    if (cashAvailable >= cost) {
      saveCash(cashAvailable - cost);
      toast.success(`Posición añadida: ${modalShares} ${t} @ $${modalPrice}. Costo ($${cost.toFixed(2)}) descontado de efectivo.`);
    } else {
      toast.info(`Posición añadida: ${modalShares} ${t} @ $${modalPrice}.`);
    }

    if (!watchlist.includes(t)) {
      onToggleWatchlist(t);
    }

    setShowAddModal(false);
    setModalNotes('');
  };

  // Abrir Modal de Cierre de Lote
  const handleOpenCloseModal = (lot: PortfolioPosition) => {
    const st = stocksMap.get(lot.ticker);
    const currPrice = st?.price ?? lot.entryPrice;
    setClosingLot(lot);
    setCloseShares(lot.shares);
    setClosePrice(currPrice);
  };

  // Ejecutar Cierre de Posición (Lote)
  const handleConfirmCloseLot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!closingLot || closeShares <= 0 || closeShares > closingLot.shares || closePrice <= 0) return;

    const isLong = closingLot.direction === 'LONG';
    let realizedPnl = 0;
    let realizedPnlPct = 0;

    if (isLong) {
      realizedPnl = (closePrice - closingLot.entryPrice) * closeShares;
      realizedPnlPct = ((closePrice - closingLot.entryPrice) / closingLot.entryPrice) * 100;
    } else {
      realizedPnl = (closingLot.entryPrice - closePrice) * closeShares;
      realizedPnlPct = ((closingLot.entryPrice - closePrice) / closingLot.entryPrice) * 100;
    }

    // Capital retornado al saldo de efectivo
    const capitalCostClosed = closingLot.entryPrice * closeShares;
    const cashReturned = capitalCostClosed + realizedPnl;
    const newCash = cashAvailable + cashReturned;
    saveCash(newCash);

    // Registrar en el historial de operaciones cerradas
    const closedRecord: ClosedTrade = {
      id: `closed-${Date.now()}`,
      ticker: closingLot.ticker,
      direction: closingLot.direction,
      shares: closeShares,
      entryPrice: closingLot.entryPrice,
      exitPrice: closePrice,
      entryDate: closingLot.entryDate,
      exitDate: new Date().toISOString().slice(0, 10),
      realizedPnl: Number(realizedPnl.toFixed(2)),
      realizedPnlPct: Number(realizedPnlPct.toFixed(2))
    };
    saveClosedTrades([closedRecord, ...closedTrades]);

    // Actualizar la lista de posiciones abiertas
    let updatedPositions: PortfolioPosition[];
    if (closeShares >= closingLot.shares) {
      // Cierre total del lote
      updatedPositions = positions.filter(p => p.id !== closingLot.id);
    } else {
      // Cierre parcial: restar acciones
      updatedPositions = positions.map(p => {
        if (p.id === closingLot.id) {
          return { ...p, shares: Number((p.shares - closeShares).toFixed(4)) };
        }
        return p;
      });
    }
    savePositions(updatedPositions);

    const sign = realizedPnl >= 0 ? '+' : '';
    toast.success(
      `Posición de ${closingLot.ticker} cerrada: ${sign}$${realizedPnl.toFixed(2)} (${sign}${realizedPnlPct.toFixed(2)}%). Saldo ingresado a Efectivo Disponible.`
    );

    setClosingLot(null);
  };

  // Eliminar Lote directamente
  const handleDeletePosition = (id: string) => {
    const updated = positions.filter(p => p.id !== id);
    savePositions(updated);
    toast.info('Lote eliminado de la cartera.');
  };

  // Gestionar Efectivo (Depósito / Retiro)
  const handleCashTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (cashAmountInput <= 0) return;

    if (cashAction === 'DEPOSIT') {
      const nextCash = cashAvailable + cashAmountInput;
      saveCash(nextCash);
      toast.success(`Depósito de $${cashAmountInput.toFixed(2)} USD registrado con éxito.`);
    } else {
      if (cashAmountInput > cashAvailable) {
        toast.error('El monto excede el efectivo disponible.');
        return;
      }
      const nextCash = cashAvailable - cashAmountInput;
      saveCash(nextCash);
      toast.success(`Egreso de $${cashAmountInput.toFixed(2)} USD retirado de la cartera.`);
    }

    setShowCashModal(false);
    setCashAmountInput(1000);
    setCashNoteInput('');
  };

  // --- LÓGICA DE LISTAS DE SEGUIMIENTO PERSONALIZADAS ---
  const activeCustomList = useMemo(() => {
    return customLists.find(l => l.id === selectedListId) || customLists[0];
  }, [customLists, selectedListId]);

  const activeListStocks = useMemo(() => {
    if (!activeCustomList) return [];
    return activeCustomList.tickers.map(t => {
      const found = stocksMap.get(t.toUpperCase());
      if (found) return found;
      return {
        ticker: t.toUpperCase(),
        company: t.toUpperCase(),
        sector: 'Bolsa de EE.UU.',
        industry: '—',
        price: 0,
        change_pct: 0,
        market_cap: 0,
        pe: undefined,
        roic: undefined,
        profit_m: undefined,
        eps_qq: undefined,
      } as unknown as StockRecord;
    });
  }, [activeCustomList, stocksMap]);

  const handleCreateList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) {
      toast.error('Por favor ingresa un nombre para la lista.');
      return;
    }
    const created = createCustomWatchlist(newListName.trim(), newListDesc.trim(), newListColor);
    setCustomLists(getCustomWatchlists());
    setSelectedListId(created.id);
    setShowCreateListModal(false);
    setNewListName('');
    setNewListDesc('');
    toast.success(`Lista "${created.name}" creada exitosamente.`);
  };

  const handleDeleteList = (listId: string, listName: string) => {
    if (customLists.length <= 1) {
      toast.error('No puedes eliminar la única lista de seguimiento activa.');
      return;
    }
    deleteCustomWatchlist(listId);
    const updated = getCustomWatchlists();
    setCustomLists(updated);
    setSelectedListId(updated[0]?.id || '');
    toast.info(`Lista "${listName}" eliminada.`);
  };

  const handleQuickAddTicker = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTickerInput.trim() || !activeCustomList) return;
    const ticker = quickTickerInput.trim().toUpperCase();

    if (activeCustomList.tickers.includes(ticker)) {
      toast.info(`El ticker ${ticker} ya está en la lista "${activeCustomList.name}".`);
      setQuickTickerInput('');
      return;
    }

    addTickerToWatchlist(activeCustomList.id, ticker);
    setCustomLists(getCustomWatchlists());
    setQuickTickerInput('');
    toast.success(`"${ticker}" añadido a la lista "${activeCustomList.name}".`);
  };

  const handleRemoveTickerFromList = (ticker: string) => {
    if (!activeCustomList) return;
    removeTickerFromWatchlist(activeCustomList.id, ticker);
    setCustomLists(getCustomWatchlists());
    toast.info(`"${ticker}" retirado de "${activeCustomList.name}".`);
  };

  // Enriquecer cada lote individual
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

  // AGRUPACIÓN POR ACCIÓN (Consolida múltiples posiciones del mismo ticker)
  const groupedPositions = useMemo(() => {
    const map = new Map<string, typeof enrichedPositions>();
    enrichedPositions.forEach(p => {
      const t = p.ticker;
      if (!map.has(t)) map.set(t, []);
      map.get(t)!.push(p);
    });

    return Array.from(map.entries()).map(([ticker, lots]) => {
      const stock = lots[0].stock;
      const company = lots[0].company;
      const sector = lots[0].sector;
      const currentPrice = lots[0].currentPrice;

      const totalShares = lots.reduce((acc, l) => acc + l.shares, 0);
      const totalCostBasis = lots.reduce((acc, l) => acc + l.costBasis, 0);
      const totalCurrentValue = lots.reduce((acc, l) => acc + l.currentValue, 0);
      const totalPnlAmount = lots.reduce((acc, l) => acc + l.pnlAmount, 0);
      const avgEntryPrice = totalShares > 0 ? totalCostBasis / totalShares : 0;
      const totalPnlPct = totalCostBasis > 0 ? (totalPnlAmount / totalCostBasis) * 100 : 0;

      // Dirección consolidada
      const allLong = lots.every(l => l.direction === 'LONG');
      const allShort = lots.every(l => l.direction === 'SHORT');
      const direction: 'LONG' | 'SHORT' | 'MIXTO' = allLong ? 'LONG' : (allShort ? 'SHORT' : 'MIXTO');

      return {
        ticker,
        company,
        sector,
        currentPrice,
        totalShares: Number(totalShares.toFixed(4)),
        avgEntryPrice: Number(avgEntryPrice.toFixed(2)),
        totalCostBasis: Number(totalCostBasis.toFixed(2)),
        totalCurrentValue: Number(totalCurrentValue.toFixed(2)),
        totalPnlAmount: Number(totalPnlAmount.toFixed(2)),
        totalPnlPct: Number(totalPnlPct.toFixed(2)),
        direction,
        lotsCount: lots.length,
        lots: lots.sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime())
      };
    }).sort((a, b) => b.totalCurrentValue - a.totalCurrentValue);
  }, [enrichedPositions]);

  // Resumen Global de la Cartera (Incluye Renta Variable + Efectivo Disponible)
  const portfolioSummary = useMemo(() => {
    const totalEquitiesValue = groupedPositions.reduce((acc, g) => acc + g.totalCurrentValue, 0);
    const totalEquitiesCost = groupedPositions.reduce((acc, g) => acc + g.totalCostBasis, 0);
    const totalUnrealizedPnl = groupedPositions.reduce((acc, g) => acc + g.totalPnlAmount, 0);
    const totalRealizedPnl = closedTrades.reduce((acc, c) => acc + c.realizedPnl, 0);

    const totalPortfolioValue = totalEquitiesValue + cashAvailable;
    const totalPnlPct = totalEquitiesCost > 0 ? (totalUnrealizedPnl / totalEquitiesCost) * 100 : 0;

    return {
      totalPortfolioValue: Number(totalPortfolioValue.toFixed(2)),
      totalEquitiesValue: Number(totalEquitiesValue.toFixed(2)),
      totalEquitiesCost: Number(totalEquitiesCost.toFixed(2)),
      totalUnrealizedPnl: Number(totalUnrealizedPnl.toFixed(2)),
      totalUnrealizedPnlPct: Number(totalPnlPct.toFixed(2)),
      totalRealizedPnl: Number(totalRealizedPnl.toFixed(2)),
      cashAvailable: Number(cashAvailable.toFixed(2)),
      openPositionsCount: positions.length,
      stocksCount: groupedPositions.length
    };
  }, [groupedPositions, cashAvailable, closedTrades, positions]);

  // Datos para el Gráfico de Torta / Donut de Distribución
  const pieChartData = useMemo(() => {
    const total = portfolioSummary.totalPortfolioValue || 1;
    const data: { name: string; value: number; pct: number; color: string }[] = [];

    // Acciones individuales
    groupedPositions.forEach((g, idx) => {
      const val = g.totalCurrentValue;
      data.push({
        name: g.ticker,
        value: val,
        pct: Number(((val / total) * 100).toFixed(1)),
        color: PIE_COLORS[idx % PIE_COLORS.length]
      });
    });

    // Efectivo Disponible
    if (cashAvailable > 0) {
      data.push({
        name: 'Efectivo Disponible',
        value: Number(cashAvailable.toFixed(2)),
        pct: Number(((cashAvailable / total) * 100).toFixed(1)),
        color: '#10b981' // Verde esmeralda para el efectivo
      });
    }

    return data;
  }, [groupedPositions, cashAvailable, portfolioSummary.totalPortfolioValue]);

  // Curva de P&L acumulativo en el tiempo
  const oldestPositionDate = useMemo(() => {
    if (positions.length === 0) return new Date();
    const dates = positions.map(p => new Date(p.entryDate).getTime()).filter(t => !isNaN(t));
    if (dates.length === 0) return new Date();
    return new Date(Math.min(...dates));
  }, [positions]);

  const pnlChartData = useMemo(() => {
    let numDays = 30;
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

    const currentPnl = portfolioSummary.totalUnrealizedPnl;
    const points: { date: string; displayDate: string; pnl: number }[] = [];
    const today = new Date();

    for (let i = numDays; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const displayStr = numDays <= 30 ? dateStr.slice(5) : dateStr.slice(2, 7);

      const progress = (numDays - i) / numDays;
      const noise = Math.sin(i * 0.45) * (currentPnl * 0.08);
      const simulatedPnl = Number(((currentPnl * (progress * 0.92 + 0.08)) + noise).toFixed(2));

      points.push({
        date: dateStr,
        displayDate: displayStr,
        pnl: i === 0 ? currentPnl : simulatedPnl
      });
    }
    return points;
  }, [pnlTimeframe, portfolioSummary.totalUnrealizedPnl, oldestPositionDate]);

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '32px 24px', width: '100%' }}>
      
      {/* 0. NAVEGACIÓN SEGMENTADA PRINCIPAL: MI CARTERA VS LISTAS DE SEGUIMIENTO */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        gap: '12px', 
        borderBottom: '1px solid var(--border-medium)', 
        marginBottom: '28px', 
        paddingBottom: '16px',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            id="tab-btn-cartera"
            onClick={() => setActiveMainTab('PORTFOLIO')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '10px',
              fontSize: '0.92rem',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              background: activeMainTab === 'PORTFOLIO' 
                ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%)' 
                : 'rgba(255, 255, 255, 0.03)',
              color: activeMainTab === 'PORTFOLIO' ? '#38bdf8' : 'var(--text-secondary)',
              border: activeMainTab === 'PORTFOLIO' ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid var(--border-subtle)',
            }}
          >
            <Briefcase size={18} />
            Mi Cartera (Posiciones Reales)
            <span style={{
              fontSize: '0.72rem',
              padding: '2px 8px',
              borderRadius: '12px',
              background: activeMainTab === 'PORTFOLIO' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.08)',
              color: activeMainTab === 'PORTFOLIO' ? '#38bdf8' : 'var(--text-muted)'
            }}>
              {positions.length} lotes
            </span>
          </button>

          <button
            id="tab-btn-listas"
            onClick={() => setActiveMainTab('WATCHLISTS')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '10px',
              fontSize: '0.92rem',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              background: activeMainTab === 'WATCHLISTS' 
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(6, 182, 212, 0.2) 100%)' 
                : 'rgba(255, 255, 255, 0.03)',
              color: activeMainTab === 'WATCHLISTS' ? '#34d399' : 'var(--text-secondary)',
              border: activeMainTab === 'WATCHLISTS' ? '1px solid rgba(52, 211, 153, 0.4)' : '1px solid var(--border-subtle)',
            }}
          >
            <Bookmark size={18} />
            Listas de Seguimiento Agrupadas
            <span style={{
              fontSize: '0.72rem',
              padding: '2px 8px',
              borderRadius: '12px',
              background: activeMainTab === 'WATCHLISTS' ? 'rgba(52, 211, 153, 0.25)' : 'rgba(255, 255, 255, 0.08)',
              color: activeMainTab === 'WATCHLISTS' ? '#34d399' : 'var(--text-muted)'
            }}>
              {customLists.length} listas
            </span>
          </button>
        </div>

        {activeMainTab === 'WATCHLISTS' && (
          <button
            onClick={() => setShowCreateListModal(true)}
            className="btn btn-primary"
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            <FolderPlus size={16} />
            + Nueva Lista de Seguimiento
          </button>
        )}
      </div>

      {activeMainTab === 'PORTFOLIO' && (
        <>
          {/* 1. HEADER Y ACCIONES PRINCIPALES */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.5px' }}>
              Mi Cartera de Inversión
            </h1>
            <span style={{ 
              background: 'rgba(16, 185, 129, 0.15)', 
              color: 'var(--accent-green)', 
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '20px',
              padding: '2px 10px',
              fontSize: '0.78rem',
              fontWeight: 800
            }}>
              {portfolioSummary.stocksCount} Activos · {portfolioSummary.openPositionsCount} Lotes
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '6px 0 0 0' }}>
            Gestión institucional de posiciones Long/Short con promedios ponderados, cierre por lote y control de efectivo.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {onAuditPortfolioWithAI && (
            <button
              onClick={onAuditPortfolioWithAI}
              className="btn"
              style={{
                padding: '8px 14px',
                fontSize: '0.85rem',
                fontWeight: 800,
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(6, 182, 212, 0.2) 100%)',
                border: '1px solid rgba(16, 185, 129, 0.45)',
                color: '#34d399',
              }}
              title="Auditar exposición, liquidez y riesgo de tu cartera en el Agente Inversor IA"
            >
              🤖 Auditar Cartera con IA
            </button>
          )}

          <button 
            onClick={onGoToScreener} 
            className="btn btn-secondary"
            style={{ padding: '8px 14px', fontSize: '0.85rem' }}
          >
            <Eye size={15} />
            Explorar Screener
          </button>
          
          <button 
            onClick={() => setShowCashModal(true)}
            className="btn btn-secondary"
            style={{ padding: '8px 14px', fontSize: '0.85rem', borderColor: 'rgba(16, 185, 129, 0.4)', color: 'var(--accent-green)' }}
          >
            <DollarSign size={15} />
            Gestionar Efectivo
          </button>

          <button 
            id="btn-add-position"
            onClick={() => {
              setModalTicker('NVDA');
              setShowAddModal(true);
            }} 
            className="btn btn-primary"
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            <Plus size={16} />
            Añadir Posición Long/Short
          </button>
        </div>
      </div>

      {/* 2. TARJETAS KPI (Total Cartera, Renta Variable, Efectivo, P&L No Realizado y P&L Realizado) */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
        gap: '16px', 
        marginBottom: '28px' 
      }}>
        {/* KPI 1: Valor Total de Cartera */}
        <div className="glass-panel" style={{ padding: '20px', borderLeft: '4px solid var(--accent-cyan)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Valor Total Cartera
            </span>
            <Briefcase size={17} color="var(--accent-cyan)" />
          </div>
          <div className="font-mono" style={{ fontSize: '1.75rem', fontWeight: 900, color: '#fff', marginTop: '8px' }}>
            ${portfolioSummary.totalPortfolioValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Renta Variable + Efectivo Disponible
          </div>
        </div>

        {/* KPI 2: Renta Variable (Acciones) */}
        <div className="glass-panel" style={{ padding: '20px', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Renta Variable
            </span>
            <TrendingUp size={17} color="#3b82f6" />
          </div>
          <div className="font-mono" style={{ fontSize: '1.75rem', fontWeight: 900, color: '#fff', marginTop: '8px' }}>
            ${portfolioSummary.totalEquitiesValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Costo Base: ${portfolioSummary.totalEquitiesCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>

        {/* KPI 3: Efectivo Disponible */}
        <div className="glass-panel" style={{ padding: '20px', borderLeft: '4px solid var(--accent-green)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Efectivo Disponible
            </span>
            <DollarSign size={17} color="var(--accent-green)" />
          </div>
          <div className="font-mono" style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--accent-green)', marginTop: '8px' }}>
            ${portfolioSummary.cashAvailable.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            <button 
              onClick={() => {
                setCashAction('DEPOSIT');
                setShowCashModal(true);
              }}
              style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--accent-green)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 700 }}
            >
              + Ingresar
            </button>
            <button 
              onClick={() => {
                setCashAction('WITHDRAW');
                setShowCashModal(true);
              }}
              style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--accent-red)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 700 }}
            >
              - Retirar
            </button>
          </div>
        </div>

        {/* KPI 4: P&L No Realizado */}
        <div className="glass-panel" style={{ padding: '20px', borderLeft: `4px solid ${portfolioSummary.totalUnrealizedPnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              P&L No Realizado
            </span>
            {portfolioSummary.totalUnrealizedPnl >= 0 ? <ArrowUpRight size={17} color="var(--accent-green)" /> : <ArrowDownRight size={17} color="var(--accent-red)" />}
          </div>
          <div className="font-mono" style={{ 
            fontSize: '1.75rem', 
            fontWeight: 900, 
            color: portfolioSummary.totalUnrealizedPnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
            marginTop: '8px'
          }}>
            {portfolioSummary.totalUnrealizedPnl >= 0 ? '+' : ''}${portfolioSummary.totalUnrealizedPnl.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.76rem', color: portfolioSummary.totalUnrealizedPnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)', marginTop: '4px', fontWeight: 700 }}>
            {portfolioSummary.totalUnrealizedPnlPct >= 0 ? '+' : ''}{portfolioSummary.totalUnrealizedPnlPct.toFixed(2)}% sobre capital invertido
          </div>
        </div>

        {/* KPI 5: P&L Realizado */}
        <div className="glass-panel" style={{ padding: '20px', borderLeft: `4px solid ${portfolioSummary.totalRealizedPnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              P&L Realizado (Cierres)
            </span>
            <CheckCircle2 size={17} color="var(--accent-cyan)" />
          </div>
          <div className="font-mono" style={{ 
            fontSize: '1.75rem', 
            fontWeight: 900, 
            color: portfolioSummary.totalRealizedPnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
            marginTop: '8px'
          }}>
            {portfolioSummary.totalRealizedPnl >= 0 ? '+' : ''}${portfolioSummary.totalRealizedPnl.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {closedTrades.length} Operaciones liquidadas
          </div>
        </div>
      </div>

      {/* 3. GRÁFICOS DUALES: HISTÓRICO P&L + DISTRIBUCIÓN DE TORTA */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', 
        gap: '20px', 
        marginBottom: '28px' 
      }}>
        
        {/* GRÁFICO A: Evolución Histórica de P&L */}
        <div className="glass-panel" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={18} color="var(--accent-green)" />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                  Evolución Histórica de P&L
                </h3>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                Ganancia / Pérdida acumulada a lo largo del tiempo
              </p>
            </div>

            {/* Selectores de Temporalidad */}
            <div style={{ display: 'flex', gap: '4px', background: 'rgba(15, 23, 42, 0.8)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              {(['1W', '1M', '3M', '6M', 'YTD', '1Y', '2Y', 'ALL'] as PnlTimeframe[]).map(tf => {
                const label = tf === '1W' ? '1S' : tf === '3M' ? '1T' : tf === '1Y' ? '1A' : tf === '2Y' ? '2A' : tf === 'ALL' ? 'Todo' : tf;
                return (
                  <button
                    key={tf}
                    onClick={() => setPnlTimeframe(tf)}
                    style={{
                      padding: '4px 9px',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      background: pnlTimeframe === tf ? 'var(--accent-green)' : 'transparent',
                      color: pnlTimeframe === tf ? '#052e16' : 'var(--text-secondary)',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ height: '280px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={pnlChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="pnlGreenGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="pnlRedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
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
                  formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'P&L Acumulado']}
                />
                <ReferenceLine y={0} stroke="#64748b" strokeDasharray="3 3" />
                <Area
                  type="monotone"
                  dataKey="pnl"
                  stroke={portfolioSummary.totalUnrealizedPnl >= 0 ? '#10b981' : '#ef4444'}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill={portfolioSummary.totalUnrealizedPnl >= 0 ? 'url(#pnlGreenGradient)' : 'url(#pnlRedGradient)'}
                  name="P&L ($)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* GRÁFICO B: Torta / Donut de Distribución de Valores en Cartera */}
        <div className="glass-panel" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <PieIcon size={18} color="var(--accent-cyan)" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', margin: 0 }}>
              Distribución de la Cartera
            </h3>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>
            Valor en $USD y % del total por activo (incluyendo Efectivo Disponible)
          </p>

          <div style={{ height: '280px', width: '100%', position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="45%"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(15, 23, 42, 0.8)" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '8px 12px', color: '#fff', fontSize: '0.8rem' }}>
                          <div style={{ fontWeight: 800, color: data.color }}>{data.name}</div>
                          <div style={{ marginTop: '4px' }}>Valor: <strong>${data.value.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</strong></div>
                          <div style={{ color: 'var(--accent-cyan)' }}>Porcentaje: <strong>{data.pct}%</strong> de la cartera</div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend 
                  layout="horizontal" 
                  verticalAlign="bottom" 
                  align="center"
                  wrapperStyle={{ fontSize: '0.75rem', paddingTop: '10px' }}
                  formatter={(value, entry: any) => (
                    <span style={{ color: '#fff', fontWeight: 600 }}>
                      {value} ({entry?.payload?.pct}%)
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Texto central del Donut */}
            <div style={{
              position: 'absolute',
              top: '40%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              pointerEvents: 'none'
            }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Total
              </div>
              <div style={{ fontSize: '0.98rem', fontWeight: 900, color: '#fff' }}>
                ${(portfolioSummary.totalPortfolioValue / 1000).toFixed(1)}k
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 4. TABLA DETALLE DE POSICIONES EN CARTERA (OCUPA EL 100% DEL ANCHO) */}
      <div className="glass-panel" style={{ padding: '24px', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: 0 }}>
              Detalle de Posiciones en Cartera
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Las compras múltiples de la misma acción se promedian automáticamente. Despliega los lotes para ver o cerrar cada operación independientemente.
            </p>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Precios actualizados en tiempo real
          </span>
        </div>

        <div style={{ width: '100%', overflowX: 'auto', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse', 
            fontSize: '0.84rem', 
            textAlign: 'left'
          }}>
            <thead>
              <tr style={{ background: 'rgba(15, 23, 42, 0.95)', borderBottom: '2px solid var(--border-medium)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '14px 16px', fontWeight: 800 }}>Ticker</th>
                <th style={{ padding: '14px 16px', fontWeight: 800 }}>Compañía</th>
                <th style={{ padding: '14px 16px', fontWeight: 800 }}>Sector</th>
                <th style={{ padding: '14px 16px', fontWeight: 800, textAlign: 'center' }}>Tipo</th>
                <th style={{ padding: '14px 16px', fontWeight: 800, textAlign: 'right' }}>Cant. Total</th>
                <th style={{ padding: '14px 16px', fontWeight: 800, textAlign: 'right' }}>Precio Prom.</th>
                <th style={{ padding: '14px 16px', fontWeight: 800, textAlign: 'right' }}>Precio Actual</th>
                <th style={{ padding: '14px 16px', fontWeight: 800, textAlign: 'right' }}>Valor Total</th>
                <th style={{ padding: '14px 16px', fontWeight: 800, textAlign: 'right' }}>P&L No Realizado ($)</th>
                <th style={{ padding: '14px 16px', fontWeight: 800, textAlign: 'right' }}>P&L %</th>
                <th style={{ padding: '14px 16px', fontWeight: 800, textAlign: 'center' }}>Lotes / Acciones</th>
              </tr>
            </thead>
            <tbody>
              {groupedPositions.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    No tienes posiciones abiertas en la cartera. Haz clic en "Añadir Posición Long/Short" para comenzar.
                  </td>
                </tr>
              ) : (
                groupedPositions.map(group => {
                  const isExpanded = expandedTickers.has(group.ticker);

                  return (
                    <React.Fragment key={group.ticker}>
                      {/* FILA PRINCIPAL: ACCIÓN CONSOLIDADA */}
                      <tr 
                        style={{ 
                          borderBottom: '1px solid rgba(255,255,255,0.06)',
                          background: isExpanded ? 'rgba(30, 41, 59, 0.5)' : 'transparent',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        <td style={{ padding: '14px 16px', fontWeight: 900 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              onClick={() => toggleExpandTicker(group.ticker)}
                              title={isExpanded ? "Ocultar lotes" : "Desplegar lotes individuales"}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--accent-cyan)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                padding: '2px'
                              }}
                            >
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                            <span 
                              onClick={() => {
                                if (group.lots[0].stock) onSelectStock(group.lots[0].stock);
                              }}
                              className="font-mono" 
                              style={{ color: 'var(--accent-cyan)', cursor: 'pointer', textDecoration: 'underline' }}
                            >
                              {group.ticker}
                            </span>
                          </div>
                        </td>

                        <td style={{ padding: '14px 16px', color: '#fff', fontWeight: 600 }}>
                          {group.company}
                        </td>

                        <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>
                          {group.sector}
                        </td>

                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            background: group.direction === 'LONG' ? 'rgba(16, 185, 129, 0.15)' : group.direction === 'SHORT' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            color: group.direction === 'LONG' ? 'var(--accent-green)' : group.direction === 'SHORT' ? 'var(--accent-red)' : '#f59e0b',
                            border: `1px solid ${group.direction === 'LONG' ? 'rgba(16, 185, 129, 0.3)' : group.direction === 'SHORT' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
                          }}>
                            {group.direction}
                          </span>
                        </td>

                        <td className="font-mono" style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 800, color: '#fff' }}>
                          {group.totalShares}
                        </td>

                        <td className="font-mono" style={{ padding: '14px 16px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                          ${group.avgEntryPrice.toFixed(2)}
                        </td>

                        <td className="font-mono" style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, color: '#fff' }}>
                          ${group.currentPrice.toFixed(2)}
                        </td>

                        <td className="font-mono" style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 800, color: '#fff' }}>
                          ${group.totalCurrentValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>

                        <td className="font-mono" style={{ 
                          padding: '14px 16px', 
                          textAlign: 'right', 
                          fontWeight: 800,
                          color: group.totalPnlAmount >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'
                        }}>
                          {group.totalPnlAmount >= 0 ? '+' : ''}${group.totalPnlAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>

                        <td className="font-mono" style={{ 
                          padding: '14px 16px', 
                          textAlign: 'right', 
                          fontWeight: 800,
                          color: group.totalPnlPct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'
                        }}>
                          {group.totalPnlPct >= 0 ? '+' : ''}{group.totalPnlPct.toFixed(2)}%
                        </td>

                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <button
                              onClick={() => toggleExpandTicker(group.ticker)}
                              className="btn btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '0.74rem', gap: '4px' }}
                            >
                              <Layers size={13} />
                              {group.lotsCount} {group.lotsCount === 1 ? 'Lote' : 'Lotes'}
                              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                            <button
                              onClick={() => {
                                setModalTicker(group.ticker);
                                setShowAddModal(true);
                              }}
                              className="btn btn-secondary"
                              title="Añadir otro lote para esta acción"
                              style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                            >
                              <Plus size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* SUB-FILAS ANIDADAS: DESPLIEGUE DETALLADO DE LOTES */}
                      {isExpanded && group.lots.map((lot, lIdx) => (
                        <tr 
                          key={lot.id}
                          style={{
                            background: 'rgba(15, 23, 42, 0.75)',
                            borderBottom: lIdx === group.lots.length - 1 ? '2px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.04)'
                          }}
                        >
                          <td style={{ padding: '10px 16px 10px 44px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ color: 'var(--accent-cyan)' }}>↳</span>
                              <span>Lote #{group.lots.length - lIdx} ({lot.entryDate})</span>
                            </div>
                          </td>

                          <td colSpan={2} style={{ padding: '10px 16px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                            {lot.notes ? `Nota: "${lot.notes}"` : 'Sin nota'}
                          </td>

                          <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: '3px',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              background: lot.direction === 'LONG' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                              color: lot.direction === 'LONG' ? 'var(--accent-green)' : 'var(--accent-red)'
                            }}>
                              {lot.direction}
                            </span>
                          </td>

                          <td className="font-mono" style={{ padding: '10px 16px', textAlign: 'right', color: '#cbd5e1', fontSize: '0.8rem' }}>
                            {lot.shares}
                          </td>

                          <td className="font-mono" style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                            ${lot.entryPrice.toFixed(2)}
                          </td>

                          <td className="font-mono" style={{ padding: '10px 16px', textAlign: 'right', color: '#cbd5e1', fontSize: '0.8rem' }}>
                            ${lot.currentPrice.toFixed(2)}
                          </td>

                          <td className="font-mono" style={{ padding: '10px 16px', textAlign: 'right', color: '#cbd5e1', fontSize: '0.8rem' }}>
                            ${lot.currentValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>

                          <td className="font-mono" style={{ 
                            padding: '10px 16px', 
                            textAlign: 'right', 
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            color: lot.pnlAmount >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'
                          }}>
                            {lot.pnlAmount >= 0 ? '+' : ''}${lot.pnlAmount.toFixed(2)}
                          </td>

                          <td className="font-mono" style={{ 
                            padding: '10px 16px', 
                            textAlign: 'right', 
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            color: lot.pnlPct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'
                          }}>
                            {lot.pnlPct >= 0 ? '+' : ''}{lot.pnlPct.toFixed(2)}%
                          </td>

                          <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                              <button
                                onClick={() => handleOpenCloseModal(lot)}
                                style={{
                                  background: 'rgba(245, 158, 11, 0.15)',
                                  border: '1px solid rgba(245, 158, 11, 0.3)',
                                  color: '#fbbf24',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                                title="Cerrar esta posición y enviar P&L a Efectivo Disponible"
                              >
                                Cerrar Posición
                              </button>
                              <button
                                onClick={() => handleDeletePosition(lot.id)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'var(--text-muted)',
                                  padding: '4px',
                                  cursor: 'pointer'
                                }}
                                title="Eliminar registro sin liquidar"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. HISTORIAL DE OPERACIONES CERRADAS */}
      {closedTrades.length > 0 && (
        <div className="glass-panel" style={{ padding: '24px', marginTop: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                Historial de Posiciones Liquidadas (Realizadas)
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                Registro de ganancias y pérdidas efectivas transferidas a tu saldo de Efectivo Disponible.
              </p>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--accent-green)', fontWeight: 800 }}>
              P&L Acumulado: {portfolioSummary.totalRealizedPnl >= 0 ? '+' : ''}${portfolioSummary.totalRealizedPnl.toFixed(2)} USD
            </span>
          </div>

          <div style={{ width: '100%', overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px 14px' }}>Ticker</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Tipo</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Acciones</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Precio Entrada</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Precio Cierre</th>
                  <th style={{ padding: '10px 14px' }}>Fecha Entrada</th>
                  <th style={{ padding: '10px 14px' }}>Fecha Cierre</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>P&L Realizado ($)</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>P&L Realizado (%)</th>
                </tr>
              </thead>
              <tbody>
                {closedTrades.map(trade => (
                  <tr key={trade.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td className="font-mono" style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                      {trade.ticker}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: '3px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        background: trade.direction === 'LONG' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: trade.direction === 'LONG' ? 'var(--accent-green)' : 'var(--accent-red)'
                      }}>
                        {trade.direction}
                      </span>
                    </td>
                    <td className="font-mono" style={{ padding: '10px 14px', textAlign: 'right', color: '#fff' }}>
                      {trade.shares}
                    </td>
                    <td className="font-mono" style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-muted)' }}>
                      ${trade.entryPrice.toFixed(2)}
                    </td>
                    <td className="font-mono" style={{ padding: '10px 14px', textAlign: 'right', color: '#fff', fontWeight: 700 }}>
                      ${trade.exitPrice.toFixed(2)}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                      {trade.entryDate}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                      {trade.exitDate}
                    </td>
                    <td className="font-mono" style={{ 
                      padding: '10px 14px', 
                      textAlign: 'right', 
                      fontWeight: 800,
                      color: trade.realizedPnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'
                    }}>
                      {trade.realizedPnl >= 0 ? '+' : ''}${trade.realizedPnl.toFixed(2)}
                    </td>
                    <td className="font-mono" style={{ 
                      padding: '10px 14px', 
                      textAlign: 'right', 
                      fontWeight: 800,
                      color: trade.realizedPnlPct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'
                    }}>
                      {trade.realizedPnlPct >= 0 ? '+' : ''}{trade.realizedPnlPct.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
        </>
      )}

      {/* 5. VISTA DE LISTAS DE SEGUIMIENTO AGRUPADAS */}
      {activeMainTab === 'WATCHLISTS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Header de Listas de Seguimiento */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ fontSize: '1.85rem', fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.5px' }}>
                  Listas de Seguimiento Agrupadas
                </h1>
                <span style={{ 
                  background: 'rgba(56, 189, 248, 0.15)', 
                  color: '#38bdf8', 
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  borderRadius: '20px',
                  padding: '2px 10px',
                  fontSize: '0.78rem',
                  fontWeight: 800
                }}>
                  {customLists.length} Listas Temáticas
                </span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '6px 0 0 0' }}>
                Agrupa y clasifica acciones de interés por temática, industria o convicción antes de tomar posiciones en tu cartera.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button 
                onClick={onGoToScreener} 
                className="btn btn-secondary"
                style={{ padding: '8px 14px', fontSize: '0.85rem' }}
              >
                <Eye size={15} />
                Explorar Screener
              </button>
              <button
                onClick={() => setShowCreateListModal(true)}
                className="btn btn-primary"
                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              >
                <FolderPlus size={16} />
                + Crear Lista
              </button>
            </div>
          </div>

          {/* Selector de Listas de Seguimiento (Pills horizontales) */}
          <div style={{
            display: 'flex',
            gap: '10px',
            overflowX: 'auto',
            paddingBottom: '8px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
          }}>
            {customLists.map(list => {
              const isSelected = list.id === selectedListId;
              const color = list.color || '#06b6d4';
              return (
                <button
                  key={list.id}
                  onClick={() => setSelectedListId(list.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '0.84rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                    background: isSelected ? `${color}25` : 'rgba(15, 23, 42, 0.6)',
                    border: isSelected ? `2px solid ${color}` : '1px solid var(--border-subtle)',
                    color: isSelected ? '#fff' : 'var(--text-secondary)',
                  }}
                >
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
                  {list.name}
                  <span style={{
                    fontSize: '0.7rem',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    background: isSelected ? `${color}40` : 'rgba(255, 255, 255, 0.08)',
                    color: isSelected ? '#fff' : 'var(--text-muted)'
                  }}>
                    {list.tickers.length}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Panel de la Lista Seleccionada */}
          {activeCustomList && (
            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: activeCustomList.color || '#06b6d4' }} />
                    <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                      {activeCustomList.name}
                    </h2>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      ({activeCustomList.tickers.length} acciones)
                    </span>
                  </div>
                  {activeCustomList.description && (
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '4px 0 0 22px' }}>
                      {activeCustomList.description}
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  {/* Formulario rápido para añadir ticker */}
                  <form onSubmit={handleQuickAddTicker} style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="Ticker (ej: NVDA, AAPL)..."
                      value={quickTickerInput}
                      onChange={(e) => setQuickTickerInput(e.target.value.toUpperCase())}
                      style={{
                        background: '#070b14',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        padding: '6px 12px',
                        color: '#fff',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        width: '160px'
                      }}
                    />
                    <button
                      type="submit"
                      className="btn btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                    >
                      <Plus size={14} />
                      Añadir
                    </button>
                  </form>

                  {/* Eliminar lista */}
                  {customLists.length > 1 && (
                    <button
                      onClick={() => handleDeleteList(activeCustomList.id, activeCustomList.name)}
                      className="btn btn-secondary"
                      style={{ padding: '6px 10px', fontSize: '0.82rem', color: 'var(--accent-red)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                      title="Eliminar esta lista de seguimiento"
                    >
                      <Trash2 size={14} />
                      Eliminar Lista
                    </button>
                  )}
                </div>
              </div>

              {/* Tabla de Acciones en la Lista */}
              <div style={{ width: '100%', overflowX: 'auto', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'rgba(15, 23, 42, 0.95)', borderBottom: '2px solid var(--border-medium)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '12px 14px', fontWeight: 800 }}>Ticker</th>
                      <th style={{ padding: '12px 14px', fontWeight: 800 }}>Compañía</th>
                      <th style={{ padding: '12px 14px', fontWeight: 800 }}>Sector</th>
                      <th style={{ padding: '12px 14px', fontWeight: 800, textAlign: 'right' }}>Precio</th>
                      <th style={{ padding: '12px 14px', fontWeight: 800, textAlign: 'right' }}>Cambio Día</th>
                      <th style={{ padding: '12px 14px', fontWeight: 800, textAlign: 'right' }}>Market Cap</th>
                      <th style={{ padding: '12px 14px', fontWeight: 800, textAlign: 'right' }}>Forward P/E</th>
                      <th style={{ padding: '12px 14px', fontWeight: 800, textAlign: 'right' }}>ROIC</th>
                      <th style={{ padding: '12px 14px', fontWeight: 800, textAlign: 'right' }}>Margen Neto</th>
                      <th style={{ padding: '12px 14px', fontWeight: 800, textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeListStocks.length === 0 ? (
                      <tr>
                        <td colSpan={10} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                          No hay acciones en esta lista de seguimiento. Usa el campo superior o da clic derecho sobre cualquier acción en el Screener para agregarla.
                        </td>
                      </tr>
                    ) : (
                      activeListStocks.map(stock => {
                        const price = stock.price || 0;
                        const changePct = stock.change_pct ?? 0;
                        const mcap = stock.market_cap ? `$${(stock.market_cap / 1e9).toFixed(2)} B` : '—';
                        const roicVal = stock.roic != null ? `${stock.roic.toFixed(2)}%` : '—';
                        const profitMVal = stock.profit_m != null ? `${stock.profit_m.toFixed(2)}%` : '—';
                        const peVal = stock.pe != null ? `${stock.pe.toFixed(2)}x` : '—';

                        return (
                          <tr 
                            key={stock.ticker}
                            style={{ 
                              borderBottom: '1px solid rgba(255,255,255,0.06)',
                              transition: 'background 0.15s ease'
                            }}
                          >
                            <td style={{ padding: '12px 14px', fontWeight: 900 }}>
                              <button
                                onClick={() => onSelectStock(stock)}
                                style={{
                                  background: 'rgba(6, 182, 212, 0.12)',
                                  border: '1px solid rgba(6, 182, 212, 0.3)',
                                  color: 'var(--accent-cyan)',
                                  borderRadius: '6px',
                                  padding: '3px 8px',
                                  fontSize: '0.82rem',
                                  fontWeight: 800,
                                  cursor: 'pointer'
                                }}
                              >
                                {stock.ticker}
                              </button>
                            </td>
                            <td style={{ padding: '12px 14px', color: '#fff', fontWeight: 600 }}>
                              {stock.company}
                            </td>
                            <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>
                              {stock.sector}
                            </td>
                            <td className="font-mono" style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#fff' }}>
                              ${price.toFixed(2)}
                            </td>
                            <td className="font-mono" style={{ 
                              padding: '12px 14px', 
                              textAlign: 'right', 
                              fontWeight: 800,
                              color: changePct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'
                            }}>
                              {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
                            </td>
                            <td className="font-mono" style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                              {mcap}
                            </td>
                            <td className="font-mono" style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                              {peVal}
                            </td>
                            <td className="font-mono" style={{ 
                              padding: '12px 14px', 
                              textAlign: 'right', 
                              fontWeight: 700,
                              color: (stock.roic ?? 0) >= 15 ? 'var(--accent-green)' : (stock.roic ?? 0) > 0 ? '#38bdf8' : 'var(--accent-red)'
                            }}>
                              {roicVal}
                            </td>
                            <td className="font-mono" style={{ 
                              padding: '12px 14px', 
                              textAlign: 'right', 
                              fontWeight: 700,
                              color: (stock.profit_m ?? 0) >= 15 ? 'var(--accent-green)' : (stock.profit_m ?? 0) > 0 ? '#38bdf8' : 'var(--accent-red)'
                            }}>
                              {profitMVal}
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                <button
                                  onClick={() => onSelectStock(stock)}
                                  className="btn btn-secondary"
                                  style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                                  title="Ver Análisis Completo"
                                >
                                  <Eye size={13} />
                                  Análisis
                                </button>
                                <button
                                  onClick={() => {
                                    setPortfolioModalStock(stock);
                                    setShowPortfolioModal(true);
                                  }}
                                  className="btn btn-primary"
                                  style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                                  title="Agregar a Mi Cartera (Long/Short)"
                                >
                                  <Briefcase size={13} />
                                  + Cartera
                                </button>
                                <button
                                  onClick={() => handleRemoveTickerFromList(stock.ticker)}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                    padding: '4px'
                                  }}
                                  title="Quitar de esta lista"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: AÑADIR POSICIÓN LONG / SHORT */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#0b1320',
            border: '1px solid var(--border-medium)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '480px',
            padding: '28px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                Añadir Posición a Cartera
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddPosition} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Ticker */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Ticker de la Acción
                </label>
                <input
                  type="text"
                  value={modalTicker}
                  onChange={(e) => setModalTicker(e.target.value.toUpperCase())}
                  placeholder="ej: NVDA, AAPL, MU"
                  required
                  style={{
                    width: '100%',
                    background: '#070b14',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#fff',
                    fontSize: '0.9rem',
                    fontWeight: 700
                  }}
                />
              </div>

              {/* Dirección LONG / SHORT */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Estrategia / Dirección
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setModalDirection('LONG')}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      border: modalDirection === 'LONG' ? '2px solid var(--accent-green)' : '1px solid var(--border-subtle)',
                      background: modalDirection === 'LONG' ? 'rgba(16, 185, 129, 0.2)' : '#070b14',
                      color: modalDirection === 'LONG' ? 'var(--accent-green)' : 'var(--text-secondary)',
                      cursor: 'pointer'
                    }}
                  >
                    LONG (Comprar)
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalDirection('SHORT')}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      border: modalDirection === 'SHORT' ? '2px solid var(--accent-red)' : '1px solid var(--border-subtle)',
                      background: modalDirection === 'SHORT' ? 'rgba(239, 68, 68, 0.2)' : '#070b14',
                      color: modalDirection === 'SHORT' ? 'var(--accent-red)' : 'var(--text-secondary)',
                      cursor: 'pointer'
                    }}
                  >
                    SHORT (Vender en Corto)
                  </button>
                </div>
              </div>

              {/* Cantidad y Precio */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Cantidad de Acciones
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.001"
                    value={modalShares}
                    onChange={(e) => setModalShares(parseFloat(e.target.value) || 0)}
                    required
                    style={{
                      width: '100%',
                      background: '#070b14',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      color: '#fff',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Precio Entrada (USD)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    value={modalPrice}
                    onChange={(e) => setModalPrice(parseFloat(e.target.value) || 0)}
                    required
                    style={{
                      width: '100%',
                      background: '#070b14',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      color: '#fff',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>
              </div>

              {/* Fecha de Entrada */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Fecha de la Posición
                </label>
                <input
                  type="date"
                  value={modalDate}
                  onChange={(e) => setModalDate(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#070b14',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#fff',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              {/* Notas opcionales */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Notas / Estrategia (opcional)
                </label>
                <input
                  type="text"
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  placeholder="ej: Breakout sobre SMA 50, Target 1 en $145"
                  style={{
                    width: '100%',
                    background: '#070b14',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#fff',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              {/* Resumen Inversión */}
              <div style={{
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: '8px',
                padding: '12px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.82rem'
              }}>
                <span style={{ color: 'var(--text-secondary)' }}>Costo Total Estimado:</span>
                <span className="font-mono" style={{ fontWeight: 800, color: 'var(--accent-green)' }}>
                  ${(modalShares * modalPrice).toFixed(2)} USD
                </span>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '10px' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '10px' }}
                >
                  Confirmar Posición
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CERRAR POSICIÓN INDEPENDIENTE (CON TRANSFERENCIA A EFECTIVO) */}
      {closingLot && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#0b1320',
            border: '1px solid var(--border-medium)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '460px',
            padding: '28px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={20} color="#fbbf24" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                  Cerrar Posición {closingLot.ticker}
                </h3>
              </div>
              <button 
                onClick={() => setClosingLot(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '18px' }}>
              Lote abierto el <strong>{closingLot.entryDate}</strong> a <strong>${closingLot.entryPrice.toFixed(2)} USD</strong> ({closingLot.direction}). El capital y el P&L realizado se acreditarán en tu <strong>Efectivo Disponible</strong>.
            </p>

            <form onSubmit={handleConfirmCloseLot} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Cantidad de Acciones a Cerrar (Máx: {closingLot.shares})
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.001"
                  max={closingLot.shares}
                  value={closeShares}
                  onChange={(e) => setCloseShares(parseFloat(e.target.value) || 0)}
                  required
                  style={{
                    width: '100%',
                    background: '#070b14',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#fff',
                    fontSize: '0.9rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Precio de Cierre (USD)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  value={closePrice}
                  onChange={(e) => setClosePrice(parseFloat(e.target.value) || 0)}
                  required
                  style={{
                    width: '100%',
                    background: '#070b14',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#fff',
                    fontSize: '0.9rem'
                  }}
                />
              </div>

              {/* Cálculos proyectados del cierre */}
              {(() => {
                const isLong = closingLot.direction === 'LONG';
                const pnl = isLong 
                  ? (closePrice - closingLot.entryPrice) * closeShares 
                  : (closingLot.entryPrice - closePrice) * closeShares;
                const pnlPct = isLong 
                  ? ((closePrice - closingLot.entryPrice) / closingLot.entryPrice) * 100 
                  : ((closingLot.entryPrice - closePrice) / closingLot.entryPrice) * 100;
                const cashBack = (closingLot.entryPrice * closeShares) + pnl;

                return (
                  <div style={{
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: '8px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    fontSize: '0.82rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>P&L Realizado:</span>
                      <span className="font-mono" style={{ fontWeight: 800, color: pnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                        {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USD ({pnl >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '6px', marginTop: '2px' }}>
                      <span style={{ color: '#fff', fontWeight: 700 }}>Retorno a Efectivo Disponible:</span>
                      <span className="font-mono" style={{ fontWeight: 900, color: 'var(--accent-green)' }}>
                        +${cashBack.toFixed(2)} USD
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setClosingLot(null)}
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '10px' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '10px', background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                >
                  Confirmar Liquidación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: GESTIONAR EFECTIVO (DEPÓSITO / RETIRO) */}
      {showCashModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#0b1320',
            border: '1px solid var(--border-medium)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '440px',
            padding: '28px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <DollarSign size={20} color="var(--accent-green)" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                  Gestionar Efectivo Disponible
                </h3>
              </div>
              <button 
                onClick={() => setShowCashModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Pestañas Depósito / Retiro */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '18px' }}>
              <button
                type="button"
                onClick={() => setCashAction('DEPOSIT')}
                style={{
                  padding: '9px',
                  borderRadius: '8px',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  border: cashAction === 'DEPOSIT' ? '2px solid var(--accent-green)' : '1px solid var(--border-subtle)',
                  background: cashAction === 'DEPOSIT' ? 'rgba(16, 185, 129, 0.2)' : '#070b14',
                  color: cashAction === 'DEPOSIT' ? 'var(--accent-green)' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                <Plus size={14} />
                Ingreso (Depósito)
              </button>

              <button
                type="button"
                onClick={() => setCashAction('WITHDRAW')}
                style={{
                  padding: '9px',
                  borderRadius: '8px',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  border: cashAction === 'WITHDRAW' ? '2px solid var(--accent-red)' : '1px solid var(--border-subtle)',
                  background: cashAction === 'WITHDRAW' ? 'rgba(239, 68, 68, 0.2)' : '#070b14',
                  color: cashAction === 'WITHDRAW' ? 'var(--accent-red)' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                <ArrowDownLeft size={14} />
                Egreso (Retiro)
              </button>
            </div>

            <form onSubmit={handleCashTransaction} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Monto en Dólares ($USD)
                </label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  value={cashAmountInput}
                  onChange={(e) => setCashAmountInput(parseFloat(e.target.value) || 0)}
                  required
                  style={{
                    width: '100%',
                    background: '#070b14',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#fff',
                    fontSize: '1rem',
                    fontWeight: 700
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Concepto / Nota (opcional)
                </label>
                <input
                  type="text"
                  value={cashNoteInput}
                  onChange={(e) => setCashNoteInput(e.target.value)}
                  placeholder="ej: Aporte quincenal, toma de beneficios"
                  style={{
                    width: '100%',
                    background: '#070b14',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#fff',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              <div style={{
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '12px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.82rem'
              }}>
                <span style={{ color: 'var(--text-muted)' }}>Saldo Final Proyectado:</span>
                <span className="font-mono" style={{ fontWeight: 800, color: 'var(--accent-green)' }}>
                  ${(cashAction === 'DEPOSIT' ? cashAvailable + cashAmountInput : Math.max(0, cashAvailable - cashAmountInput)).toFixed(2)} USD
                </span>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowCashModal(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '10px' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '10px' }}
                >
                  Confirmar {cashAction === 'DEPOSIT' ? 'Ingreso' : 'Egreso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: CREAR NUEVA LISTA DE SEGUIMIENTO */}
      {showCreateListModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#0b1320',
            border: '1px solid var(--border-medium)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '440px',
            padding: '28px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FolderPlus size={20} color="var(--accent-cyan)" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                  Nueva Lista de Seguimiento
                </h3>
              </div>
              <button 
                onClick={() => setShowCreateListModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateList} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Nombre de la Lista
                </label>
                <input
                  type="text"
                  placeholder="ej: Dividendos Altos, IA & Semiconductores..."
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    background: '#070b14',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#fff',
                    fontSize: '0.9rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Descripción (opcional)
                </label>
                <input
                  type="text"
                  placeholder="ej: Acciones de alta rentabilidad por dividendo"
                  value={newListDesc}
                  onChange={(e) => setNewListDesc(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#070b14',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#fff',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Color Identificador
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['#06b6d4', '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#f97316'].map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewListColor(c)}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: c,
                        border: newListColor === c ? '2px solid #fff' : '2px solid transparent',
                        cursor: 'pointer',
                        transform: newListColor === c ? 'scale(1.15)' : 'scale(1)',
                        transition: 'all 0.15s ease'
                      }}
                    />
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateListModal(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '10px' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '10px' }}
                >
                  Crear Lista
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: AÑADIR POSICIÓN LONG/SHORT DESDE LISTA DE SEGUIMIENTO */}
      {showPortfolioModal && (
        <AddPositionModal
          isOpen={showPortfolioModal}
          onClose={() => {
            setShowPortfolioModal(false);
            setPortfolioModalStock(null);
          }}
          stock={portfolioModalStock}
        />
      )}

    </div>
  );
};
