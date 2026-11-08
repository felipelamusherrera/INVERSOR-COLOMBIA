import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  Bookmark, 
  Award, 
  Activity, 
  TrendingUp, 
  TrendingDown,
  Bell,
  BellRing,
  Trash2,
  X
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  ComposedChart,
  AreaChart, 
  Area, 
  Bar,
  Line,
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend,
  CartesianGrid, 
  ReferenceLine 
} from 'recharts';
import type { StockRecord } from '../types/stock';
import { calculateFactorGrades } from '../utils/quantRatings';
import { supabase } from '../lib/supabase';
import { TradingViewChart } from './TradingViewChart';
import { CandlestickChart } from './CandlestickChart';
import { SectorNewsRadar } from './SectorNewsRadar';
import { StockAIAnalysisPanel } from './StockAIAnalysisPanel';

export interface PricePoint {
  date: string;
  displayDate: string;
  price?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  rsi?: number;
  volume?: number;
  dollarVolume?: number; // Volumen en millones de dólares ($M USD)
  profit_m?: number; // Margen neto (%)
  fcf?: number; // Flujo de caja libre en USD
  sales_yoy?: number; // % crecimiento ingresos YoY
  eps_yoy?: number; // % crecimiento EPS YoY
  isReportDate?: boolean;
  reportLabel?: string;
  reportPeriod?: string;
}

export interface QuarterlyFinancialPoint {
  period: string; // e.g. "Q3 2026"
  quarterLabel: string; // e.g. "Q3 '26"
  date: string; // e.g. "2026-10-27"
  sales: number; // Ingresos trimestrales en USD
  sales_yoy: number; // % YoY (mismo periodo año anterior)
  sales_qoq: number; // % QoQ (periodo inmediatamente anterior)
  eps: number; // BPA trimestral en USD
  eps_yoy: number; // % YoY (mismo periodo año anterior)
  eps_qoq: number; // % QoQ (periodo inmediatamente anterior)
}

export type ActiveChartType = 'price' | 'rsi' | 'volume' | 'profit_m' | 'fcf' | 'sales' | 'eps';

export function formatCurrencyB(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '—';
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}$ ${(abs / 1e12).toFixed(2).replace('.', ',')} T`;
  if (abs >= 1e9) return `${sign}$ ${(abs / 1e9).toFixed(2).replace('.', ',')} B`;
  if (abs >= 1e6) return `${sign}$ ${(abs / 1e6).toFixed(2).replace('.', ',')} M`;
  return `${sign}$ ${abs.toFixed(2).replace('.', ',')}`;
}

export function formatTickB(val: number): string {
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}$ ${(abs / 1e12).toFixed(1).replace('.', ',')} T`;
  if (abs >= 1e9) return `${sign}$ ${(abs / 1e9).toFixed(1).replace('.', ',')} B`;
  if (abs >= 1e6) return `${sign}$ ${(abs / 1e6).toFixed(0).replace('.', ',')} M`;
  return `${sign}$ ${abs.toFixed(0)}`;
}

export interface PriceAlert {
  id: string;
  ticker: string;
  targetPrice: number;
  condition: 'ABOVE' | 'BELOW';
  note?: string;
  createdAt: string;
  triggered: boolean;
  triggeredAt?: string;
}

function playAlertBeep() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioCtx = new AudioContextClass();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.25);
  } catch {
    // Audio context permissions
  }
}

function computeRSI(prices: number[], period = 14): (number | undefined)[] {
  const rsi: (number | undefined)[] = new Array(prices.length).fill(undefined);
  if (prices.length <= period) return rsi;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  rsi[period] = Number((100 - (100 / (1 + rs))).toFixed(1));

  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi[i] = Number((100 - (100 / (1 + rs))).toFixed(1));
  }

  return rsi;
}

// Genera serie histórica diaria de 3 años (756 sesiones bursátiles) matemáticamente coherente con los ratios de Finviz
export function generateSyntheticPriceHistory(stock: StockRecord, count = 756): PricePoint[] {
  const currentPrice = Number(stock.price && stock.price > 0 ? stock.price : 100);
  const perfWeek = stock.perf_week;
  const perfMonth = stock.perf_month;
  const perfQuart = stock.perf_quart;
  const perfHalf = stock.perf_half;
  const perfYear = stock.perf_year;
  const perf3y = stock.perf_3y;
  const beta = Number(stock.beta && stock.beta > 0 ? stock.beta : 1.15);
  const baseVol = Number(stock.volume && stock.volume > 0 ? stock.volume : (stock.avg_volume && stock.avg_volume > 0 ? stock.avg_volume : 2000000));

  // Semilla pseudo-aleatoria determinista basada en el ticker para consistencia total entre recargas
  let seed = 0;
  for (let i = 0; i < (stock.ticker || '').length; i++) {
    seed = (seed * 31 + stock.ticker.charCodeAt(i)) % 100000;
  }
  const pseudoRand = (offset: number) => {
    const x = Math.sin(seed + offset) * 10000;
    return x - Math.floor(x);
  };

  // 1. Generar fechas hábiles (Lunes a Viernes) hacia atrás
  const dates: string[] = [];
  let curr = new Date(stock.snapshot_date ? stock.snapshot_date : new Date());
  if (isNaN(curr.getTime())) curr = new Date();

  // Asegurar que si la fecha ancla cae en fin de semana, retroceda al viernes hábil
  while (curr.getDay() === 0 || curr.getDay() === 6) {
    curr.setDate(curr.getDate() - 1);
  }

  while (dates.length < count) {
    const dayOfWeek = curr.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      dates.push(curr.toISOString().slice(0, 10));
    }
    curr.setDate(curr.getDate() - 1);
  }
  dates.reverse();

  // 2. Establecer precios ancla según rendimiento Finviz
  const anchors: { [index: number]: number } = {};
  const lastIdx = count - 1;

  // Hoy (índice 755)
  anchors[lastIdx] = currentPrice;

  // Ayer (índice 754)
  const pPrev = stock.prev_close && stock.prev_close > 0
    ? stock.prev_close
    : (stock.change_pct !== undefined && (1 + stock.change_pct / 100) > 0
        ? currentPrice / (1 + stock.change_pct / 100)
        : currentPrice * 0.995);
  anchors[Math.max(0, lastIdx - 1)] = Math.max(0.01, pPrev);

  // 1 Semana (~5 sesiones)
  anchors[Math.max(0, lastIdx - 5)] = Math.max(0.01, (perfWeek !== undefined && perfWeek !== null && (1 + perfWeek / 100) > 0)
    ? currentPrice / (1 + perfWeek / 100)
    : currentPrice * 0.99);

  // 1 Mes (~21 sesiones)
  anchors[Math.max(0, lastIdx - 21)] = Math.max(0.01, (perfMonth !== undefined && perfMonth !== null && (1 + perfMonth / 100) > 0)
    ? currentPrice / (1 + perfMonth / 100)
    : currentPrice * 0.97);

  // 3 Meses (~63 sesiones)
  anchors[Math.max(0, lastIdx - 63)] = Math.max(0.01, (perfQuart !== undefined && perfQuart !== null && (1 + perfQuart / 100) > 0)
    ? currentPrice / (1 + perfQuart / 100)
    : currentPrice * 0.94);

  // 6 Meses (~126 sesiones)
  anchors[Math.max(0, lastIdx - 126)] = Math.max(0.01, (perfHalf !== undefined && perfHalf !== null && (1 + perfHalf / 100) > 0)
    ? currentPrice / (1 + perfHalf / 100)
    : currentPrice * 0.90);

  // 1 Año (~252 sesiones)
  const p1y = Math.max(0.01, (perfYear !== undefined && perfYear !== null && (1 + perfYear / 100) > 0)
    ? currentPrice / (1 + perfYear / 100)
    : currentPrice * 0.85);
  anchors[Math.max(0, lastIdx - 252)] = p1y;

  // 3 Años (~756 sesiones, índice 0)
  const p3y = Math.max(0.01, (perf3y !== undefined && perf3y !== null && (1 + perf3y / 100) > 0)
    ? currentPrice / (1 + perf3y / 100)
    : p1y * 0.70);
  anchors[0] = p3y;

  // 2 Años intermedio (~504 sesiones)
  anchors[Math.max(0, lastIdx - 504)] = Math.sqrt(p1y * p3y);

  // 3. Interpolar la serie mediante puente browniano logarítmico con volatilidad
  const sortedAnchors = Object.keys(anchors).map(Number).sort((a, b) => a - b);
  const dailyVol = Math.max(0.008, Math.min(0.035, 0.012 * beta));
  const closes: number[] = new Array(count).fill(currentPrice);

  for (let a = 0; a < sortedAnchors.length - 1; a++) {
    const idxA = sortedAnchors[a];
    const idxB = sortedAnchors[a + 1];
    const pA = Math.max(0.01, anchors[idxA]);
    const pB = Math.max(0.01, anchors[idxB]);
    const span = idxB - idxA;
    if (span <= 0) continue;

    let arNoise = 0.0;
    for (let i = idxA; i <= idxB; i++) {
      const u = (i - idxA) / span;
      const logTrend = (1 - u) * Math.log(pA) + u * Math.log(pB);
      const envelope = Math.sqrt(Math.max(0, u * (1 - u))) * 2.0;
      const rawR = (pseudoRand(i * 13 + 7) - 0.5) * 2.0;
      arNoise = arNoise * 0.65 + rawR * 0.35;
      const noise = arNoise * dailyVol * envelope * Math.sqrt(span / 20.0);
      closes[i] = Number(Math.exp(logTrend + noise).toFixed(2));
    }
  }

  // Garantizar valores exactos en los anclas
  for (const idxStr of Object.keys(anchors)) {
    const idx = Number(idxStr);
    closes[idx] = Number(anchors[idx].toFixed(2));
  }

  // 4. Calcular RSI sobre los precios de cierre generados
  const calculatedRsi = computeRSI(closes);

  // 5. Construir los PricePoint con OHLCV completo
  const points: PricePoint[] = [];
  for (let i = 0; i < count; i++) {
    const cl = closes[i];
    const isToday = (i === lastIdx);

    let op: number;
    let hi: number;
    let lo: number;
    let vol: number;
    let rsiVal = calculatedRsi[i];

    if (isToday) {
      op = stock.open && stock.open > 0 ? stock.open : cl;
      hi = stock.high && stock.high > 0 ? Math.max(stock.high, cl, op) : Math.max(cl, op);
      lo = stock.low && stock.low > 0 ? Math.min(stock.low, cl, op) : Math.min(cl, op);
      vol = stock.volume && stock.volume > 0 ? stock.volume : baseVol;
      if (stock.rsi !== undefined && stock.rsi !== null) {
        rsiVal = stock.rsi;
      }
    } else {
      const prevCl = i > 0 ? closes[i - 1] : cl;
      const gap = (pseudoRand(i * 17 + 3) - 0.5) * 0.006;
      op = Number((prevCl * (1 + gap)).toFixed(2));
      const wickHigh = Math.abs(cl * dailyVol * (0.3 + pseudoRand(i * 19 + 5) * 0.7));
      const wickLow = Math.abs(cl * dailyVol * (0.3 + pseudoRand(i * 23 + 2) * 0.7));
      hi = Number((Math.max(op, cl) + wickHigh).toFixed(2));
      lo = Number((Math.min(op, cl) - wickLow).toFixed(2));
      vol = Math.round(baseVol * (0.60 + pseudoRand(i * 29 + 11) * 0.80));
    }

    const dt = dates[i];
    points.push({
      date: dt,
      displayDate: dt.slice(5),
      price: cl,
      open: op,
      high: hi,
      low: lo,
      close: cl,
      rsi: rsiVal,
      volume: vol
    });
  }

  return points;
}

// Reconstruye series fundamentales trimestrales y volumen en millones de USD
function computeHistoricalFundamentals(points: PricePoint[], stock: StockRecord): PricePoint[] {
  if (!points || points.length === 0) return [];

  // Semilla pseudo-aleatoria determinista basada en el ticker para coherencia entre recargas
  let seed = 0;
  for (let i = 0; i < stock.ticker.length; i++) {
    seed = (seed * 31 + stock.ticker.charCodeAt(i)) % 100000;
  }
  const pseudoRand = (offset: number) => {
    const x = Math.sin(seed + offset) * 10000;
    return x - Math.floor(x);
  };

  const baseProfitM = stock.profit_m ?? (stock.oper_m ? stock.oper_m * 0.75 : 12.0);
  const baseIncome = stock.income ?? (stock.market_cap ? (stock.market_cap / (stock.pe && stock.pe > 0 ? stock.pe : 20)) : 500);
  const baseFCF = baseIncome * 0.85; // FCF estimado en ~85% del Ingreso Neto
  const baseSalesYoY = stock.sales_yoy_ttm ?? (stock.sales_qq ?? 10.5);
  const baseEpsYoY = stock.eps_yoy_ttm ?? (stock.eps_qq ?? 12.0);

  // Determinar trimestre ancla a partir de la fecha de reporte más reciente
  let latestReportYear = 2026;
  let latestReportQuarter = 3;
  if (stock.earnings_date) {
    const d = new Date(stock.earnings_date);
    if (!isNaN(d.getTime())) {
      latestReportYear = d.getFullYear();
      latestReportQuarter = Math.floor(d.getMonth() / 3) + 1;
    }
  }

  // Precalcular los últimos 16 trimestres (~4 años)
  const quarterData: {
    period: string;
    profit_m: number;
    fcf: number;
    sales_yoy: number;
    eps_yoy: number;
  }[] = [];

  for (let q = 0; q <= 16; q++) {
    let qNum = latestReportQuarter - q;
    let yNum = latestReportYear;
    while (qNum <= 0) {
      qNum += 4;
      yNum -= 1;
    }
    const period = `Q${qNum} ${yNum}`;

    const variance = (pseudoRand(q * 7 + 1) - 0.5) * 2; // de -1 a +1
    const pMargin = Number((baseProfitM + variance * 2.2 - (q * 0.25)).toFixed(2));
    const fcfVal = Number((baseFCF * (1 + variance * 0.12 - (q * 0.035))).toFixed(1));
    const sYoY = Number((baseSalesYoY + variance * 3.5 - (q * 0.4)).toFixed(2));
    const eYoY = Number((baseEpsYoY + variance * 5.0 - (q * 0.6)).toFixed(2));

    quarterData.push({
      period,
      profit_m: pMargin,
      fcf: Math.max(10, fcfVal),
      sales_yoy: sYoY,
      eps_yoy: eYoY
    });
  }

  const n = points.length;
  const quarterLength = 63; // ~63 sesiones bursátiles por trimestre

  return points.map((p, idx) => {
    const daysFromEnd = n - 1 - idx;
    const quarterIndex = Math.min(quarterData.length - 1, Math.floor(daysFromEnd / quarterLength));
    const qInfo = quarterData[quarterIndex];

    // Marcar hito si coincide con fecha de reporte trimestral o última sesión
    const isReportDate = (daysFromEnd % quarterLength === 0) || (daysFromEnd === 0);
    const reportLabel = `Reporte ${qInfo.period}`;

    // Volumen en Millones de Dólares ($M USD) = (Volumen * Precio de Cierre) / 1,000,000
    const currentPrice = p.close ?? p.price ?? stock.price ?? 1;
    const rawVol = p.volume ?? stock.volume ?? 1_000_000;
    const dollarVol = Number(((rawVol * currentPrice) / 1_000_000).toFixed(2));

    return {
      ...p,
      dollarVolume: dollarVol,
      profit_m: qInfo.profit_m,
      fcf: qInfo.fcf,
      sales_yoy: qInfo.sales_yoy,
      eps_yoy: qInfo.eps_yoy,
      isReportDate,
      reportLabel: isReportDate ? reportLabel : undefined,
      reportPeriod: qInfo.period
    };
  });
}

// Genera serie histórica trimestral de Ingresos y BPA con crecimiento YoY y QoQ exactos
export function generateQuarterlyFinancials(stock: StockRecord): QuarterlyFinancialPoint[] {
  let latestReportYear = 2026;
  let latestReportQuarter = 3;
  if (stock.earnings_date) {
    const d = new Date(stock.earnings_date);
    if (!isNaN(d.getTime())) {
      latestReportYear = d.getFullYear();
      latestReportQuarter = Math.floor(d.getMonth() / 3) + 1;
    }
  }

  const baseSalesQ = (stock.sales && stock.sales > 0 ? stock.sales / 4 : (stock.market_cap ? stock.market_cap / 12 : 2500000000));
  const baseEpsQ = (stock.eps !== undefined && stock.eps !== null ? stock.eps / 4 : 1.0);
  const salesQoqRate = (stock.sales_qq !== undefined && stock.sales_qq !== null ? stock.sales_qq / 100 : 0.02);
  const salesYoyRate = (stock.sales_yoy_ttm !== undefined && stock.sales_yoy_ttm !== null ? stock.sales_yoy_ttm / 100 : 0.08);
  const epsQoqRate = (stock.eps_qq !== undefined && stock.eps_qq !== null ? stock.eps_qq / 100 : 0.03);
  const epsYoyRate = (stock.eps_yoy_ttm !== undefined && stock.eps_yoy_ttm !== null ? stock.eps_yoy_ttm / 100 : 0.10);

  let seed = 0;
  for (let i = 0; i < (stock.ticker || '').length; i++) {
    seed = (seed * 31 + stock.ticker.charCodeAt(i)) % 100000;
  }
  const pseudoRand = (offset: number) => {
    const x = Math.sin(seed + offset) * 10000;
    return x - Math.floor(x);
  };

  const quartersRaw: { period: string; quarterLabel: string; date: string; sales: number; eps: number }[] = [];
  const totalQ = 14;

  for (let q = totalQ - 1; q >= 0; q--) {
    let qNum = latestReportQuarter - q;
    let yNum = latestReportYear;
    while (qNum <= 0) {
      qNum += 4;
      yNum -= 1;
    }
    const period = `Q${qNum} ${yNum}`;
    const quarterLabel = `Q${qNum} '${String(yNum).slice(2)}`;
    const m = (qNum * 3) - 1;
    const dStr = `${yNum}-${String(m).padStart(2, '0')}-25`;

    const trendQuarter = Math.pow(1 + salesYoyRate / 4, -q);
    const seasonalPattern = [0.03, -0.02, -0.01, 0.02];
    const sFactor = 1 + seasonalPattern[qNum % 4] + (pseudoRand(q * 5 + 3) - 0.5) * 0.03;

    let qSales: number;
    if (q === 0) {
      qSales = baseSalesQ;
    } else if (q === 1) {
      qSales = baseSalesQ / (1 + salesQoqRate);
    } else if (q === 4) {
      qSales = baseSalesQ / (1 + salesYoyRate);
    } else {
      qSales = baseSalesQ * trendQuarter * sFactor;
    }

    const epsTrend = Math.pow(1 + epsYoyRate / 4, -q);
    const epsSeason = 1 + (pseudoRand(q * 7 + 2) - 0.5) * 0.04;
    let qEps: number;
    if (q === 0) {
      qEps = baseEpsQ;
    } else if (q === 1) {
      qEps = baseEpsQ / (1 + epsQoqRate);
    } else if (q === 4) {
      qEps = baseEpsQ / (1 + epsYoyRate);
    } else {
      qEps = baseEpsQ * epsTrend * epsSeason;
    }

    quartersRaw.push({
      period,
      quarterLabel,
      date: dStr,
      sales: Math.max(1000000, Number(qSales.toFixed(0))),
      eps: Number(qEps.toFixed(2))
    });
  }

  return quartersRaw.map((item, idx) => {
    let sales_qoq = 0;
    let sales_yoy = 0;
    let eps_qoq = 0;
    let eps_yoy = 0;

    if (idx > 0) {
      sales_qoq = Number((((item.sales - quartersRaw[idx - 1].sales) / quartersRaw[idx - 1].sales) * 100).toFixed(2));
      eps_qoq = Number((((item.eps - quartersRaw[idx - 1].eps) / Math.abs(quartersRaw[idx - 1].eps || 1)) * 100).toFixed(2));
    } else {
      sales_qoq = Number((stock.sales_qq ?? 2.5).toFixed(2));
      eps_qoq = Number((stock.eps_qq ?? 3.0).toFixed(2));
    }

    if (idx >= 4) {
      sales_yoy = Number((((item.sales - quartersRaw[idx - 4].sales) / quartersRaw[idx - 4].sales) * 100).toFixed(2));
      eps_yoy = Number((((item.eps - quartersRaw[idx - 4].eps) / Math.abs(quartersRaw[idx - 4].eps || 1)) * 100).toFixed(2));
    } else {
      sales_yoy = Number((stock.sales_yoy_ttm ?? 5.0).toFixed(2));
      eps_yoy = Number((stock.eps_yoy_ttm ?? 6.0).toFixed(2));
    }

    return {
      ...item,
      sales_qoq,
      sales_yoy,
      eps_qoq,
      eps_yoy
    };
  });
}

interface StockDetailProps {
  stock: StockRecord;
  onBack: () => void;
  onToggleWatchlist: (ticker: string) => void;
  isWatchlisted: boolean;
}

export const StockDetail: React.FC<StockDetailProps> = ({
  stock,
  onBack,
  onToggleWatchlist,
  isWatchlisted
}) => {
  const analysis = calculateFactorGrades(stock);

  // Estados de Terminal Dual
  const [terminalMode, setTerminalMode] = useState<'local' | 'tradingview'>('local');
  const [chartType, setChartType] = useState<'area' | 'candles'>('area');
  const [activeChart, setActiveChart] = useState<ActiveChartType>('price');
  const [timeframe, setTimeframe] = useState<'1M' | '6M' | '1Y' | '3Y'>('1Y');
  const [rawPoints, setRawPoints] = useState<PricePoint[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Estados de Alertas de Cruce de Precio
  const [alerts, setAlerts] = useState<PriceAlert[]>(() => {
    try {
      const saved = localStorage.getItem('inversor_colombia_alerts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [newAlertPrice, setNewAlertPrice] = useState<number>(stock.price || 100);
  const [newAlertCondition, setNewAlertCondition] = useState<'ABOVE' | 'BELOW'>('ABOVE');
  const [newAlertNote, setNewAlertNote] = useState('');
  const [triggeredToast, setTriggeredToast] = useState<{ ticker: string; message: string; note?: string } | null>(null);

  // Alertas específicas para este activo
  const activeAlertsForStock = useMemo(() => {
    return alerts.filter(a => a.ticker === stock.ticker && !a.triggered);
  }, [alerts, stock.ticker]);

  // Actualizar precio por defecto al abrir modal
  useEffect(() => {
    if (stock.price) {
      setNewAlertPrice(stock.price);
    }
  }, [stock.price]);

  // Detector en vivo de cruce de alertas
  useEffect(() => {
    if (!stock.price) return;
    const currentPrice = stock.price;

    setAlerts(prevAlerts => {
      let changed = false;
      const next = prevAlerts.map(a => {
        if (a.ticker === stock.ticker && !a.triggered) {
          const crossedAbove = a.condition === 'ABOVE' && currentPrice >= a.targetPrice;
          const crossedBelow = a.condition === 'BELOW' && currentPrice <= a.targetPrice;

          if (crossedAbove || crossedBelow) {
            changed = true;
            playAlertBeep();
            setTriggeredToast({
              ticker: a.ticker,
              message: `¡Alerta Ejecutada! ${a.ticker} cotiza a $${currentPrice.toFixed(2)} USD (cruzó tu umbral de $${a.targetPrice.toFixed(2)} USD)`,
              note: a.note
            });
            return { ...a, triggered: true, triggeredAt: new Date().toISOString() };
          }
        }
        return a;
      });

      if (changed) {
        localStorage.setItem('inversor_colombia_alerts', JSON.stringify(next));
      }
      return changed ? next : prevAlerts;
    });
  }, [stock.price, stock.ticker]);

  // Crear Alerta
  const handleSaveAlert = () => {
    if (!newAlertPrice || newAlertPrice <= 0) return;
    const newAlert: PriceAlert = {
      id: `${stock.ticker}-${Date.now()}`,
      ticker: stock.ticker,
      targetPrice: Number(newAlertPrice.toFixed(2)),
      condition: newAlertCondition,
      note: newAlertNote.trim() || undefined,
      createdAt: new Date().toISOString(),
      triggered: false
    };

    const updated = [...alerts, newAlert];
    setAlerts(updated);
    localStorage.setItem('inversor_colombia_alerts', JSON.stringify(updated));
    setShowAlertModal(false);
    setNewAlertNote('');
  };

  // Eliminar Alerta
  const handleDeleteAlert = (id: string) => {
    const updated = alerts.filter(a => a.id !== id);
    setAlerts(updated);
    localStorage.setItem('inversor_colombia_alerts', JSON.stringify(updated));
  };

  // Cargar histórico de 3 años para este ticker (Escenario B)
  useEffect(() => {
    let isMounted = true;
    async function loadHistoricalData() {
      setLoadingHistory(true);
      try {
        // 1. Intentar consultar stock_prices_history en Supabase
        const { data: dbData, error: dbError } = await supabase
          .from('stock_prices_history')
          .select('*')
          .eq('ticker', stock.ticker)
          .order('price_date', { ascending: true });

        if (!dbError && dbData && dbData.length >= 20) {
          if (!isMounted) return;
          const validCloses = dbData.map((d: any) => Number(d.close_price));
          const calculatedRsi = computeRSI(validCloses);
          const pts: PricePoint[] = dbData.map((d: any, idx: number) => ({
            date: d.price_date,
            displayDate: d.price_date.slice(5),
            price: Number(d.close_price),
            open: d.open_price ? Number(d.open_price) : Number(d.close_price),
            high: d.high_price ? Number(d.high_price) : Number(d.close_price),
            low: d.low_price ? Number(d.low_price) : Number(d.close_price),
            close: Number(d.close_price),
            rsi: (d.rsi !== null && d.rsi !== undefined) ? Number(d.rsi) : calculatedRsi[idx],
            volume: d.volume ? Number(d.volume) : undefined
          }));
          const enriched = computeHistoricalFundamentals(pts, stock);
          setRawPoints(enriched);
          return;
        }

        // 2. Si hay proxy local disponible (/api/chart), intentar obtener datos reales de Yahoo Finance
        try {
          const res = await fetch(`/api/chart/${stock.ticker}?range=3y&interval=1d`).catch(() => null);
          if (res && res.ok && (res.headers.get('content-type') || '').includes('json')) {
            const json = await res.json();
            const result = json?.chart?.result?.[0];
            const timestamps: number[] = result?.timestamp || [];
            const quotes = result?.indicators?.quote?.[0] || {};
            const opens: (number | null)[] = quotes.open || [];
            const highs: (number | null)[] = quotes.high || [];
            const lows: (number | null)[] = quotes.low || [];
            const closes: (number | null)[] = quotes.close || [];
            const volumes: (number | null)[] = quotes.volume || [];

            const validIndices: number[] = [];
            const validCloses: number[] = [];
            for (let i = 0; i < timestamps.length; i++) {
              if (closes[i] !== null && closes[i] !== undefined && closes[i]! > 0) {
                validIndices.push(i);
                validCloses.push(Number(closes[i]!.toFixed(2)));
              }
            }

            if (validIndices.length >= 20) {
              const calculatedRsi = computeRSI(validCloses);
              const pts: PricePoint[] = validIndices.map((idx, i) => {
                const dt = new Date(timestamps[idx] * 1000).toISOString().slice(0, 10);
                const cl = validCloses[i];
                const op = (opens[idx] !== null && opens[idx] !== undefined) ? Number(opens[idx]!.toFixed(2)) : cl;
                const hi = (highs[idx] !== null && highs[idx] !== undefined) ? Number(highs[idx]!.toFixed(2)) : Math.max(cl, op);
                const lo = (lows[idx] !== null && lows[idx] !== undefined) ? Number(lows[idx]!.toFixed(2)) : Math.min(cl, op);

                return {
                  date: dt,
                  displayDate: dt.slice(5),
                  price: cl,
                  open: op,
                  high: hi,
                  low: lo,
                  close: cl,
                  rsi: calculatedRsi[i],
                  volume: volumes[idx] || undefined
                };
              });

              if (!isMounted) return;
              const enriched = computeHistoricalFundamentals(pts, stock);
              setRawPoints(enriched);

              // Guardar en Supabase en segundo plano para enriquecer la tabla histórica
              try {
                const toInsert = pts.map(p => ({
                  ticker: stock.ticker,
                  price_date: p.date,
                  open_price: p.open,
                  high_price: p.high,
                  low_price: p.low,
                  close_price: p.price,
                  volume: p.volume,
                  rsi: p.rsi
                }));
                for (let b = 0; b < toInsert.length; b += 200) {
                  await supabase.from('stock_prices_history').upsert(toInsert.slice(b, b + 200), { onConflict: 'ticker,price_date' });
                }
              } catch {
                // Silencioso si la tabla tiene restricciones
              }
              return;
            }
          }
        } catch {
          // Si falla el fetch local, continuar con snapshots y serie calibrada
        }

        // 3. Consultar si hay snapshots diarios en inversor_colombia_stocks
        const { data: snapData } = await supabase
          .from('inversor_colombia_stocks')
          .select('snapshot_date, price, open, high, low, volume, rsi')
          .eq('ticker', stock.ticker)
          .order('snapshot_date', { ascending: true });

        // 4. Generar la serie histórica matemática completa (756 sesiones bursátiles = 3 años)
        const synthPoints = generateSyntheticPriceHistory(stock);

        // Si tenemos snapshots reales en Supabase, sobreponer los días conocidos
        if (snapData && snapData.length > 0) {
          const snapMap = new Map<string, any>();
          for (const s of snapData) {
            if (s.snapshot_date && s.price) {
              snapMap.set(s.snapshot_date, s);
            }
          }
          for (let i = 0; i < synthPoints.length; i++) {
            const dt = synthPoints[i].date;
            const realSnap = snapMap.get(dt);
            if (realSnap) {
              synthPoints[i].price = Number(realSnap.price);
              synthPoints[i].close = Number(realSnap.price);
              if (realSnap.open) synthPoints[i].open = Number(realSnap.open);
              if (realSnap.high) synthPoints[i].high = Number(realSnap.high);
              if (realSnap.low) synthPoints[i].low = Number(realSnap.low);
              if (realSnap.volume) synthPoints[i].volume = Number(realSnap.volume);
              if (realSnap.rsi) synthPoints[i].rsi = Number(realSnap.rsi);
            }
          }
        }

        if (!isMounted) return;
        const enriched = computeHistoricalFundamentals(synthPoints, stock);
        setRawPoints(enriched);
      } catch (err) {
        console.error('Error fetching prices history:', err);
        if (isMounted) {
          const fallback = computeHistoricalFundamentals(generateSyntheticPriceHistory(stock), stock);
          setRawPoints(fallback);
        }
      } finally {
        if (isMounted) setLoadingHistory(false);
      }
    }

    loadHistoricalData();
    return () => { isMounted = false; };
  }, [stock.ticker, stock.snapshot_date, stock.price]);

  // Filtrar los puntos según la ventana temporal seleccionada (garantiza siempre serie completa)
  const chartData = useMemo<PricePoint[]>(() => {
    const pointsToUse = (rawPoints && rawPoints.length >= 20)
      ? rawPoints
      : computeHistoricalFundamentals(generateSyntheticPriceHistory(stock), stock);

    let days = 252; // 1Y por defecto
    if (timeframe === '1M') days = 22;
    else if (timeframe === '6M') days = 126;
    else if (timeframe === '1Y') days = 252;
    else if (timeframe === '3Y') days = 756;

    const slice = pointsToUse.slice(-days);
    return slice.map(s => ({
      ...s,
      displayDate: (timeframe === '1Y' || timeframe === '3Y') ? s.date.slice(2, 7) : s.date.slice(5)
    }));
  }, [rawPoints, timeframe, stock]);

  // Retorno porcentual de la ventana temporal seleccionada
  const timeframeReturn = useMemo(() => {
    if (chartData.length < 2) return null;
    const firstP = chartData[0].price;
    const lastP = chartData[chartData.length - 1].price;
    if (!firstP || !lastP) return null;
    return Number((((lastP - firstP) / firstP) * 100).toFixed(1));
  }, [chartData]);

  // Datos trimestrales para Ingresos y BPA (EPS) con crecimiento YoY y QoQ exactos
  const allQuarterlyData = useMemo(() => generateQuarterlyFinancials(stock), [stock]);
  const quarterlyData = useMemo(() => {
    let count = 8;
    if (timeframe === '1M' || timeframe === '6M') count = 4;
    else if (timeframe === '1Y') count = 8;
    else if (timeframe === '3Y') count = 14;
    return allQuarterlyData.slice(-count);
  }, [allQuarterlyData, timeframe]);

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px' }} className="animate-fade-in">
      
      {/* Toast Notificación de Alerta de Cruce */}
      {triggeredToast && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 2000,
          background: 'rgba(15, 23, 42, 0.96)',
          backdropFilter: 'blur(16px)',
          border: '2px solid #f59e0b',
          borderRadius: '12px',
          padding: '16px 20px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.7)',
          maxWidth: '400px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          animation: 'fade-in 0.3s ease-out'
        }}>
          <BellRing size={24} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#fff', marginBottom: '4px' }}>
              🚨 Alerta Bursátil: {triggeredToast.ticker}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {triggeredToast.message}
            </div>
            {triggeredToast.note && (
              <div style={{ fontSize: '0.78rem', color: '#f59e0b', marginTop: '6px' }}>
                Nota: {triggeredToast.note}
              </div>
            )}
          </div>
          <button 
            onClick={() => setTriggeredToast(null)} 
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Botón Volver y Acciones de Cabecera */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <button className="btn btn-secondary" onClick={onBack}>
          <ArrowLeft size={16} /> Volver al Screener
        </button>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            id="btn-toggle-watchlist"
            className={`btn ${isWatchlisted ? 'btn-active' : 'btn-secondary'}`}
            onClick={() => onToggleWatchlist(stock.ticker)}
          >
            <Bookmark size={16} fill={isWatchlisted ? 'var(--accent-green)' : 'none'} />
            {isWatchlisted ? 'En Mi Cartera' : 'Agregar a Mi Cartera'}
          </button>
        </div>
      </div>

      {/* Ficha Principal de la Acción (Estilo Seeking Alpha) */}
      <div className="glass-panel" style={{ padding: '28px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
              <h1 className="font-mono" style={{ fontSize: '2.2rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>
                {stock.ticker}
              </h1>
              <span style={{
                background: 'var(--bg-surface-hover)',
                color: 'var(--text-secondary)',
                fontSize: '0.8rem',
                fontWeight: 600,
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)'
              }}>
                {stock.country || 'USA'} · {stock.asset_type || 'Common Stock'}
              </span>
              {stock.index_name && (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Índice: {stock.index_name}
                </span>
              )}
            </div>
            <div style={{ fontSize: '1.15rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '8px' }}>
              {stock.company}
            </div>
            <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <span>Sector: <strong style={{ color: 'var(--text-primary)' }}>{stock.sector || '-'}</strong></span>
              <span>·</span>
              <span>Industria: <strong style={{ color: 'var(--text-primary)' }}>{stock.industry || '-'}</strong></span>
            </div>
          </div>

          {/* Precio y Rendimiento */}
          <div style={{ textAlign: 'right' }}>
            <div className="font-mono" style={{ fontSize: '2.4rem', fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>
              ${stock.price?.toFixed(2)}
            </div>
            {stock.change_pct !== undefined && stock.change_pct !== null && (
              <div style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: '4px' }} className={stock.change_pct >= 0 ? 'delta-positive' : 'delta-negative'}>
                {stock.change_pct >= 0 ? '+' : ''}{stock.change_pct.toFixed(2)}% Hoy
              </div>
            )}
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Cierre Anterior: ${stock.prev_close?.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Barra de Rango 52 Semanas */}
        {stock.price !== undefined && stock.price !== null && (stock.w52_low !== undefined || stock.w52_high !== undefined || stock.w52_range) && (() => {
          // En Finviz, w52_low y w52_high vienen como distancia porcentual respecto al precio actual:
          // Ejemplo PYPL ($58.96): w52_low = +53.30% (sobre el mínimo), w52_high = -13.56% (bajo el máximo)
          // Fórmula exacta: Precio Base = Precio Actual / (1 + Porcentaje / 100)
          let lowPrice: number | null = null;
          let highPrice: number | null = null;

          if (stock.w52_range && stock.w52_range.includes('-')) {
            const parts = stock.w52_range.split('-').map(p => parseFloat(p.trim()));
            if (!isNaN(parts[0]) && !isNaN(parts[1]) && parts[0] > 0 && parts[1] > 0) {
              lowPrice = Math.min(parts[0], parts[1]);
              highPrice = Math.max(parts[0], parts[1]);
            }
          }

          if (lowPrice === null && stock.w52_low !== undefined && stock.w52_low !== null) {
            const factorLow = 1 + (stock.w52_low / 100);
            if (factorLow > 0) {
              lowPrice = stock.price / factorLow;
            }
          }

          if (highPrice === null && stock.w52_high !== undefined && stock.w52_high !== null) {
            const factorHigh = 1 + (stock.w52_high / 100);
            if (factorHigh > 0) {
              highPrice = stock.price / factorHigh;
            }
          }

          if (lowPrice === null || highPrice === null) return null;

          const min52 = Math.min(lowPrice, highPrice);
          const max52 = Math.max(lowPrice, highPrice);
          const progressPct = max52 > min52
            ? Math.min(100, Math.max(0, ((stock.price - min52) / (max52 - min52)) * 100))
            : 50;

          return (
            <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                flexWrap: 'wrap',
                gap: '8px',
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
                marginBottom: '8px'
              }}>
                <div>
                  <div>Mínimo 52 Semanas</div>
                  <strong className="font-mono" style={{ color: '#fff', fontSize: '0.88rem' }}>
                    ${min52.toFixed(2)}
                  </strong>
                  {stock.w52_low !== undefined && stock.w52_low !== null && (
                    <span className="delta-positive" style={{ fontSize: '0.72rem', marginLeft: '5px' }}>
                      ({stock.w52_low >= 0 ? '+' : ''}{stock.w52_low.toFixed(1)}%)
                    </span>
                  )}
                </div>

                <div style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Rango 52S ({progressPct.toFixed(0)}%)
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div>Máximo 52 Semanas</div>
                  <strong className="font-mono" style={{ color: '#fff', fontSize: '0.88rem' }}>
                    ${max52.toFixed(2)}
                  </strong>
                  {stock.w52_high !== undefined && stock.w52_high !== null && (
                    <span className={stock.w52_high >= 0 ? 'delta-positive' : 'delta-negative'} style={{ fontSize: '0.72rem', marginLeft: '5px' }}>
                      ({stock.w52_high >= 0 ? '+' : ''}{stock.w52_high.toFixed(1)}%)
                    </span>
                  )}
                </div>
              </div>

              <div style={{
                width: '100%',
                height: '8px',
                background: 'var(--bg-surface)',
                borderRadius: '4px',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: 0,
                  width: `${progressPct}%`,
                  background: 'linear-gradient(90deg, #10b981, #06b6d4)',
                  borderRadius: '4px'
                }} />
              </div>
            </div>
          );
        })()}
      </div>

      {/* 1. TERMINAL DUAL: Gráfico Cuantitativo Local & TradingView Pro (Al Inicio, Encima de Factor Grades) */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '28px' }}>
          
          {/* Barra Superior: Selector de Modo Terminal y Alertas */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(15, 23, 42, 0.6)',
            padding: '8px 12px',
            borderRadius: '10px',
            border: '1px solid var(--border-subtle)',
            marginBottom: '16px',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Modo Terminal:</span>
              <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-surface)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <button 
                  className={`btn ${terminalMode === 'local' ? 'btn-active' : 'btn-secondary'}`}
                  style={{ padding: '5px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  onClick={() => setTerminalMode('local')}
                >
                  <Activity size={14} />
                  📈 Cuantitativo Local
                </button>
                <button 
                  className={`btn ${terminalMode === 'tradingview' ? 'btn-active' : 'btn-secondary'}`}
                  style={{ padding: '5px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  onClick={() => setTerminalMode('tradingview')}
                >
                  <TrendingUp size={14} />
                  📊 TradingView Pro
                </button>
              </div>
            </div>

            {/* Botón Alertas de Cruce */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                className="btn btn-secondary"
                style={{ 
                  padding: '5px 12px', 
                  fontSize: '0.8rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  borderColor: activeAlertsForStock.length > 0 ? '#f59e0b' : 'var(--border-subtle)',
                  color: activeAlertsForStock.length > 0 ? '#f59e0b' : 'inherit'
                }}
                onClick={() => setShowAlertModal(true)}
              >
                <Bell size={14} color={activeAlertsForStock.length > 0 ? '#f59e0b' : 'currentColor'} />
                {activeAlertsForStock.length > 0 ? `Alertas de Cruce (${activeAlertsForStock.length})` : 'Crear Alerta de Cruce'}
              </button>
            </div>
          </div>

          {/* VISTA A: TradingView Pro Oficial con Altura Generosa de 640px */}
          {terminalMode === 'tradingview' && (
            <TradingViewChart 
              ticker={stock.ticker} 
              companyName={stock.company} 
              height={640} 
            />
          )}

          {/* VISTA B: Gráfico Cuantitativo Local */}
          {terminalMode === 'local' && (
            <>
              {/* Controles del Gráfico Local */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '14px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                      <Activity size={20} color="var(--accent-cyan)" />
                      {activeChart === 'sales'
                        ? 'Ingresos Trimestrales & Crecimiento (YoY / QoQ)'
                        : activeChart === 'eps'
                        ? 'Beneficio por Acción (BPA / EPS) & Crecimiento'
                        : 'Evolución Histórica & Series Temporales'}
                    </h2>
                    {activeChart !== 'sales' && activeChart !== 'eps' && timeframeReturn !== null && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        background: timeframeReturn >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: timeframeReturn >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'
                      }}>
                        {timeframeReturn >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                        {timeframeReturn >= 0 ? '+' : ''}{timeframeReturn}% ({timeframe})
                      </span>
                    )}
                    {(activeChart === 'sales' || activeChart === 'eps') && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        background: 'rgba(6, 182, 212, 0.15)',
                        color: 'var(--accent-cyan)',
                        border: '1px solid rgba(6, 182, 212, 0.3)'
                      }}>
                        📊 Columnas + Eje Secundario %
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                    {activeChart === 'sales'
                      ? 'Columnas de ingresos en USD con % de crecimiento anual (YoY vs mismo periodo año anterior) y secuencial (QoQ vs periodo anterior) en eje secundario'
                      : activeChart === 'eps'
                      ? 'Columnas de BPA en USD con % de crecimiento anual (YoY vs mismo periodo año anterior) y secuencial (QoQ vs periodo anterior) en eje secundario'
                      : loadingHistory
                      ? 'Cargando serie temporal...'
                      : `${chartData.length} sesiones bursátiles analizadas • Histórico disponible hasta 3 años`}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  
                  {/* Selector: Línea vs Velas Japonesas (solo aplica a precio/mercado) */}
                  {activeChart !== 'sales' && activeChart !== 'eps' && (
                    <div style={{ display: 'flex', gap: '3px', background: 'var(--bg-surface)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                      <button
                        className={`btn ${chartType === 'area' ? 'btn-active' : 'btn-secondary'}`}
                        style={{ padding: '4px 9px', fontSize: '0.75rem', fontWeight: 700 }}
                        onClick={() => setChartType('area')}
                        title="Gráfico de Área Continua"
                      >
                        〰 Línea
                      </button>
                      <button
                        className={`btn ${chartType === 'candles' ? 'btn-active' : 'btn-secondary'}`}
                        style={{ padding: '4px 9px', fontSize: '0.75rem', fontWeight: 700 }}
                        onClick={() => { setChartType('candles'); setActiveChart('price'); }}
                        title="Gráfico de Velas Japonesas (OHLC)"
                      >
                        🕯 Velas
                      </button>
                    </div>
                  )}

                  {/* Selector de Rango Temporal */}
                  <div style={{ display: 'flex', gap: '3px', background: 'var(--bg-surface)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                    {(['1M', '6M', '1Y', '3Y'] as const).map(tf => (
                      <button
                        key={tf}
                        className={`btn ${timeframe === tf ? 'btn-active' : 'btn-secondary'}`}
                        style={{ padding: '4px 9px', fontSize: '0.75rem', fontWeight: 700 }}
                        onClick={() => setTimeframe(tf)}
                      >
                        {tf}
                      </button>
                    ))}
                  </div>

                  {/* Selector de Indicador Gráfico (7 Métricas Cuantitativas y Fundamentales) */}
                  <div style={{ display: 'flex', gap: '3px', background: 'var(--bg-surface)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
                    <button 
                      className={`btn ${activeChart === 'price' ? 'btn-active' : 'btn-secondary'}`}
                      style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                      onClick={() => setActiveChart('price')}
                    >
                      Precio ($)
                    </button>
                    <button 
                      className={`btn ${activeChart === 'rsi' ? 'btn-active' : 'btn-secondary'}`}
                      style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                      onClick={() => { setActiveChart('rsi'); setChartType('area'); }}
                    >
                      RSI (14)
                    </button>
                    <button 
                      className={`btn ${activeChart === 'volume' ? 'btn-active' : 'btn-secondary'}`}
                      style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                      onClick={() => { setActiveChart('volume'); setChartType('area'); }}
                      title="Volumen negociado en Millones de Dólares ($M USD)"
                    >
                      Volumen ($M)
                    </button>
                    <button 
                      className={`btn ${activeChart === 'profit_m' ? 'btn-active' : 'btn-secondary'}`}
                      style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                      onClick={() => { setActiveChart('profit_m'); setChartType('area'); }}
                      title="Margen de Utilidad Neta Trimestral"
                    >
                      Margen Neto (%)
                    </button>
                    <button 
                      className={`btn ${activeChart === 'fcf' ? 'btn-active' : 'btn-secondary'}`}
                      style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                      onClick={() => { setActiveChart('fcf'); setChartType('area'); }}
                      title="Flujo de Caja Libre (FCF)"
                    >
                      FCF ($)
                    </button>
                    <button 
                      className={`btn ${activeChart === 'sales' ? 'btn-active' : 'btn-secondary'}`}
                      style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                      onClick={() => { setActiveChart('sales'); setChartType('area'); }}
                      title="Ingresos Trimestrales en Columnas + Crecimiento YoY y QoQ en Eje Secundario"
                    >
                      Ingresos ($)
                    </button>
                    <button 
                      className={`btn ${activeChart === 'eps' ? 'btn-active' : 'btn-secondary'}`}
                      style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                      onClick={() => { setActiveChart('eps'); setChartType('area'); }}
                      title="Beneficio por Acción en Columnas + Crecimiento YoY y QoQ en Eje Secundario"
                    >
                      BPA (EPS)
                    </button>
                  </div>
                </div>
              </div>

              {/* Renderizado de Gráfico según Métrica Seleccionada */}
              {chartType === 'candles' && activeChart === 'price' ? (
                <CandlestickChart 
                  data={chartData} 
                  alerts={activeAlertsForStock}
                  height={340}
                  onSelectPrice={(p) => {
                    setNewAlertPrice(p);
                    setShowAlertModal(true);
                  }}
                />
              ) : (activeChart === 'sales' || activeChart === 'eps') ? (
                /* Gráfico de Barras (Columnas) con Eje Secundario para Ingresos y BPA (EPS) */
                <div style={{ width: '100%', height: '360px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={quarterlyData} margin={{ top: 16, right: 10, left: -6, bottom: 20 }}>
                      <defs>
                        <linearGradient id="barGradientSales" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#059669" stopOpacity={0.7} />
                        </linearGradient>
                        <linearGradient id="barGradientEps" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.7} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis 
                        dataKey="quarterLabel" 
                        stroke="var(--text-muted)" 
                        fontSize={11} 
                        tickLine={false} 
                      />
                      {/* Eje Y Principal Izquierdo: Columnas de Ingresos ($) o BPA ($) */}
                      <YAxis 
                        yAxisId="left" 
                        orientation="left" 
                        stroke="var(--text-muted)" 
                        fontSize={10} 
                        width={58} 
                        tickLine={false} 
                        tickFormatter={(val) => {
                          if (activeChart === 'sales') {
                            return formatTickB(val);
                          }
                          return `$ ${val.toFixed(2).replace('.', ',')}`;
                        }}
                      />
                      {/* Eje Y Secundario Derecho: Tasas de Crecimiento YoY y QoQ (%) */}
                      <YAxis 
                        yAxisId="right" 
                        orientation="right" 
                        stroke="var(--text-muted)" 
                        fontSize={10} 
                        width={46} 
                        tickLine={false} 
                        tickFormatter={(val) => `${val > 0 ? '+' : ''}${Math.round(val)}%`}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          background: 'rgba(15, 23, 42, 0.96)', 
                          backdropFilter: 'blur(12px)',
                          border: '1px solid #1e293b', 
                          borderRadius: '10px', 
                          color: '#fff', 
                          fontSize: '0.8rem',
                          padding: '10px 14px',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
                        }}
                        labelFormatter={(_label, payload) => {
                          const p = payload?.[0]?.payload;
                          return p ? `📅 ${p.period} (Reporte: ${p.date})` : _label;
                        }}
                        formatter={(value: any, name: any) => {
                          const num = Number(value);
                          if (isNaN(num)) return [value, name];
                          if (name === 'Ingresos Trimestrales') {
                            return [formatCurrencyB(num), name];
                          }
                          if (name === 'BPA (EPS) Trimestral') {
                            return [`$ ${num.toFixed(2).replace('.', ',')} USD`, name];
                          }
                          return [`${num >= 0 ? '+' : ''}${num.toFixed(2).replace('.', ',')}%`, name];
                        }}
                      />
                      <Legend 
                        verticalAlign="top" 
                        align="right" 
                        wrapperStyle={{ paddingBottom: '10px', fontSize: '0.74rem' }} 
                      />
                      <ReferenceLine 
                        yAxisId="right" 
                        y={0} 
                        stroke="rgba(255,255,255,0.2)" 
                        strokeDasharray="3 3" 
                      />

                      {/* 1. Barras (Columnas) en el Eje Principal Izquierdo */}
                      {activeChart === 'sales' ? (
                        <Bar 
                          yAxisId="left" 
                          dataKey="sales" 
                          name="Ingresos Trimestrales" 
                          fill="url(#barGradientSales)" 
                          radius={[4, 4, 0, 0]} 
                          maxBarSize={42} 
                        />
                      ) : (
                        <Bar 
                          yAxisId="left" 
                          dataKey="eps" 
                          name="BPA (EPS) Trimestral" 
                          fill="url(#barGradientEps)" 
                          radius={[4, 4, 0, 0]} 
                          maxBarSize={42} 
                        />
                      )}

                      {/* 2. Línea 1 en Eje Secundario: % Crecimiento vs Año Anterior en el Mismo Periodo (YoY) */}
                      <Line 
                        yAxisId="right" 
                        type="monotone" 
                        dataKey={activeChart === 'sales' ? 'sales_yoy' : 'eps_yoy'} 
                        name="% Crecimiento YoY (mismo periodo año anterior)" 
                        stroke="#06b6d4" 
                        strokeWidth={2.5} 
                        dot={{ r: 4, fill: '#06b6d4', stroke: '#07090e', strokeWidth: 1.5 }} 
                        activeDot={{ r: 6 }} 
                      />

                      {/* 3. Línea 2 en Eje Secundario: % Crecimiento vs Periodo Inmediatamente Anterior (QoQ) */}
                      <Line 
                        yAxisId="right" 
                        type="monotone" 
                        dataKey={activeChart === 'sales' ? 'sales_qoq' : 'eps_qoq'} 
                        name="% Crecimiento QoQ (periodo inmediatamente anterior)" 
                        stroke="#f59e0b" 
                        strokeWidth={2.5} 
                        strokeDasharray="4 4" 
                        dot={{ r: 4, fill: '#f59e0b', stroke: '#07090e', strokeWidth: 1.5 }} 
                        activeDot={{ r: 6 }} 
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                /* Gráfico de Área Continua para Precio, RSI, Volumen, Margen y FCF */
                <div style={{ width: '100%', height: '340px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="chartGradientGreen" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                        </linearGradient>
                        <linearGradient id="chartGradientCyan" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0}/>
                        </linearGradient>
                        <linearGradient id="chartGradientAmber" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0}/>
                        </linearGradient>
                        <linearGradient id="chartGradientPurple" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0}/>
                        </linearGradient>
                        <linearGradient id="chartGradientBlue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                        </linearGradient>
                        <linearGradient id="chartGradientIndigo" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="displayDate" stroke="var(--text-muted)" fontSize={11} />
                      <YAxis 
                        stroke="var(--text-muted)" 
                        fontSize={11} 
                        width={activeChart === 'volume' || activeChart === 'fcf' ? 70 : 55}
                        domain={activeChart === 'rsi' ? [0, 100] : ['auto', 'auto']} 
                        tickFormatter={(val) => {
                          if (activeChart === 'volume') {
                            if (Math.abs(val) >= 1e3) return `$${(val / 1e3).toFixed(1)}B`;
                            return `$${val.toFixed(0)}M`;
                          }
                          if (activeChart === 'fcf') {
                            return formatTickB(val);
                          }
                          if (activeChart === 'price') {
                            return `$${val}`;
                          }
                          if (activeChart === 'profit_m') {
                            return `${val > 0 ? '+' : ''}${val}%`;
                          }
                          return `${val}`;
                        }}
                      />
                      <Tooltip 
                        contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', color: '#fff', fontSize: '0.8rem' }}
                        labelFormatter={(_label, payload) => {
                          const p = payload?.[0]?.payload;
                          if (!p) return _label;
                          if (p.reportLabel) {
                            return `${p.date} • 📅 ${p.reportLabel}`;
                          }
                          return p.date || _label;
                        }}
                        formatter={(value: any, name: any) => {
                          const num = Number(value);
                          if (isNaN(num)) return [value, name];
                          if (activeChart === 'volume') {
                            if (num >= 1e3) {
                              return [`$${(num / 1e3).toFixed(2)}B USD ($${num.toFixed(0)}M)`, 'Volumen Negociado ($M USD)'];
                            }
                            return [`$${num.toFixed(2)}M USD`, 'Volumen Negociado ($M USD)'];
                          }
                          if (activeChart === 'price') {
                            return [`$${num.toFixed(2)} USD`, 'Precio'];
                          }
                          if (activeChart === 'rsi') {
                            return [`${num.toFixed(2)} pts`, 'RSI (14)'];
                          }
                          if (activeChart === 'profit_m') {
                            return [`${num.toFixed(2)}%`, 'Margen Neto'];
                          }
                          if (activeChart === 'fcf') {
                            return [formatCurrencyB(num), 'Flujo de Caja Libre (FCF)'];
                          }
                          return [num.toLocaleString('es-CO'), name];
                        }}
                      />

                      {/* Líneas de Referencia para RSI */}
                      {activeChart === 'rsi' && (
                        <>
                          <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'Sobrecompra (70)', fill: '#ef4444', fontSize: 10, position: 'right' }} />
                          <ReferenceLine y={30} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'Sobreventa (30)', fill: '#10b981', fontSize: 10, position: 'right' }} />
                        </>
                      )}

                      {/* Líneas de Alertas Activas en Gráfico de Área */}
                      {activeChart === 'price' && activeAlertsForStock.map(a => (
                        <ReferenceLine 
                          key={a.id} 
                          y={a.targetPrice} 
                          stroke="#f59e0b" 
                          strokeDasharray="4 4" 
                          label={{ value: `🔔 $${a.targetPrice.toFixed(2)}`, fill: '#f59e0b', fontSize: 10, position: 'right' }} 
                        />
                      ))}

                      {activeChart === 'price' && (
                        <Area type="monotone" dataKey="price" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#chartGradientGreen)" name="Precio ($)" />
                      )}
                      {activeChart === 'rsi' && (
                        <Area type="monotone" dataKey="rsi" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#chartGradientCyan)" name="RSI (14)" />
                      )}
                      {activeChart === 'volume' && (
                        <Area type="monotone" dataKey="dollarVolume" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#chartGradientAmber)" name="Volumen ($M USD)" />
                      )}
                      {activeChart === 'profit_m' && (
                        <Area type="monotone" dataKey="profit_m" stroke="#a855f7" strokeWidth={2} fillOpacity={1} fill="url(#chartGradientPurple)" name="Margen Neto (%)" />
                      )}
                      {activeChart === 'fcf' && (
                        <Area type="monotone" dataKey="fcf" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#chartGradientGreen)" name="FCF ($ USD)" />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}

        </div>

      {/* 2. Factor Grades Scorecard Cuantitativo (Ubicado debajo del Terminal Gráfico) */}
      <div className="glass-panel" style={{ padding: '26px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Award size={22} color="var(--accent-green)" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: 0 }}>
              Factor Grades Cuantitativos
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Quant Score:</span>
            <span className={`grade-badge grade-badge-sm grade-${analysis.quantRating.startsWith('Fuerte C') || analysis.quantRating === 'Compra' ? 'A' : analysis.quantRating === 'Mantener' ? 'C' : 'F'}`}>
              {analysis.quantScore}
            </span>
            <strong style={{ fontSize: '0.95rem', color: analysis.quantScore >= 3.6 ? 'var(--accent-green)' : 'inherit' }}>
              {analysis.quantRating}
            </strong>
          </div>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', 
          gap: '14px' 
        }}>
          {Object.values(analysis.grades).map(grade => (
            <div 
              key={grade.name}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className={`grade-badge grade-${grade.grade.charAt(0)}`}>
                      {grade.grade}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>
                        {grade.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {grade.description}
                      </div>
                    </div>
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    {grade.score.toFixed(1)} / 5.0
                  </div>
                </div>
              </div>

              {/* Métricas subyacentes */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                {grade.metrics.map(m => (
                  <span 
                    key={m.label}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    {m.label}: <strong style={{ color: '#fff' }}>{m.value}</strong> ({m.evaluation})
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL: Crear y Administrar Alertas de Cruce de Precio */}
      {showAlertModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{
            maxWidth: '520px',
            width: '100%',
            padding: '28px',
            borderRadius: '16px',
            background: '#0b1120',
            border: '1px solid var(--border-medium)',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Bell size={22} color="#f59e0b" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                  Alerta de Cruce de Precio
                </h3>
              </div>
              <button 
                onClick={() => setShowAlertModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
              Define un nivel de precio objetivo para <strong>{stock.ticker}</strong>. El aplicativo emitirá una alerta sonora y visual en el momento exacto en que la cotización cruce la línea trazada.
            </div>

            {/* Precio actual */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '8px',
              marginBottom: '18px',
              fontSize: '0.85rem'
            }}>
              <span style={{ color: 'var(--text-muted)' }}>Precio Actual de Mercado:</span>
              <strong className="font-mono" style={{ fontSize: '1.1rem', color: '#fff' }}>
                ${stock.price?.toFixed(2)} USD
              </strong>
            </div>

            {/* Formulario de creación */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Precio Objetivo de Disparo ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={newAlertPrice}
                onChange={(e) => setNewAlertPrice(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '1rem',
                  fontFamily: 'monospace',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />

              {/* Botones rápidos de ajuste porcentual */}
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                {[
                  { label: '-5%', factor: 0.95 },
                  { label: '-2%', factor: 0.98 },
                  { label: 'Actual', factor: 1.0 },
                  { label: '+2%', factor: 1.02 },
                  { label: '+5%', factor: 1.05 },
                  { label: '+10%', factor: 1.10 }
                ].map(p => (
                  <button
                    key={p.label}
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                    onClick={() => {
                      if (stock.price) {
                        setNewAlertPrice(Number((stock.price * p.factor).toFixed(2)));
                      }
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Condición de Cruce */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Condición de Activación
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button
                  type="button"
                  className={`btn ${newAlertCondition === 'ABOVE' ? 'btn-active' : 'btn-secondary'}`}
                  style={{ padding: '8px', fontSize: '0.78rem', justifyContent: 'center' }}
                  onClick={() => setNewAlertCondition('ABOVE')}
                >
                  📈 Cruza hacia arriba (Resistencia)
                </button>
                <button
                  type="button"
                  className={`btn ${newAlertCondition === 'BELOW' ? 'btn-active' : 'btn-secondary'}`}
                  style={{ padding: '8px', fontSize: '0.78rem', justifyContent: 'center' }}
                  onClick={() => setNewAlertCondition('BELOW')}
                >
                  📉 Cruza hacia abajo (Soporte)
                </button>
              </div>
            </div>

            {/* Nota opcional */}
            <div style={{ marginBottom: '22px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Nota / Estrategia (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ej: Rompimiento de canal, tomar beneficios, comprar dip..."
                value={newAlertNote}
                onChange={(e) => setNewAlertNote(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '0.85rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Botones de acción */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginBottom: '20px' }}>
              <button className="btn btn-secondary" onClick={() => setShowAlertModal(false)}>
                Cancelar
              </button>
              <button 
                className="btn btn-primary" 
                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none' }}
                onClick={handleSaveAlert}
              >
                <Bell size={15} /> Guardar Alerta
              </button>
            </div>

            {/* Lista de alertas existentes para este activo */}
            {activeAlertsForStock.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff', marginBottom: '10px' }}>
                  Alertas activas para {stock.ticker} ({activeAlertsForStock.length}):
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '160px', overflowY: 'auto' }}>
                  {activeAlertsForStock.map(a => (
                    <div 
                      key={a.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: '6px',
                        fontSize: '0.8rem'
                      }}
                    >
                      <div>
                        <strong className="font-mono" style={{ color: '#f59e0b' }}>
                          ${a.targetPrice.toFixed(2)} USD
                        </strong>
                        <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>
                          {a.condition === 'ABOVE' ? '↑ Cruza hacia arriba' : '↓ Cruza hacia abajo'}
                        </span>
                        {a.note && <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{a.note}</div>}
                      </div>
                      <button
                        onClick={() => handleDeleteAlert(a.id)}
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                        title="Eliminar alerta"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Grid de Ratios y Fundamentales Detallados */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '28px' }}>
        {/* Tarjeta: Múltiplos de Valoración */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
            Múltiplos de Valoración
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>PEG Ratio:</span>
              <strong className="font-mono" style={{ color: stock.peg && stock.peg < 1 ? 'var(--accent-green)' : '#fff' }}>{stock.peg?.toFixed(2) || '-'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>P/E Trailing:</span>
              <strong className="font-mono">{stock.pe?.toFixed(2) || '-'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Forward P/E:</span>
              <strong className="font-mono">{stock.forward_pe?.toFixed(2) || '-'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Price / Sales (P/S):</span>
              <strong className="font-mono">{stock.ps?.toFixed(2) || '-'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>EV / EBITDA:</span>
              <strong className="font-mono">{stock.ev_ebitda?.toFixed(2) || '-'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>EV / Sales:</span>
              <strong className="font-mono">{stock.ev_sales?.toFixed(2) || '-'}</strong>
            </div>
          </div>
        </div>

        {/* Tarjeta: Eficiencia y Rentabilidad */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
            Eficiencia y Retornos
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>ROIC (Capital Invertido):</span>
              <strong className="font-mono" style={{ color: stock.roic && stock.roic > 15 ? 'var(--accent-cyan)' : '#fff' }}>
                {stock.roic !== undefined && stock.roic !== null ? `${stock.roic.toFixed(2)}%` : '-'}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>ROE (Patrimonio):</span>
              <strong className="font-mono">{stock.roe !== undefined && stock.roe !== null ? `${stock.roe.toFixed(2)}%` : '-'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>ROA (Activos):</span>
              <strong className="font-mono">{stock.roa !== undefined && stock.roa !== null ? `${stock.roa.toFixed(2)}%` : '-'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Margen Operativo:</span>
              <strong className="font-mono">{stock.oper_m !== undefined && stock.oper_m !== null ? `${stock.oper_m.toFixed(2)}%` : '-'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Margen Neto:</span>
              <strong className="font-mono">{stock.profit_m !== undefined && stock.profit_m !== null ? `${stock.profit_m.toFixed(2)}%` : '-'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Margen Bruto:</span>
              <strong className="font-mono">{stock.gross_m !== undefined && stock.gross_m !== null ? `${stock.gross_m.toFixed(2)}%` : '-'}</strong>
            </div>
          </div>
        </div>

        {/* Tarjeta: Crecimiento y Solvencia */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
            Solvencia y Crecimiento
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Razón Corriente (Current):</span>
              <strong className="font-mono" style={{ color: stock.curr_r && stock.curr_r >= 1.0 ? 'var(--accent-green)' : '#fff' }}>
                {stock.curr_r?.toFixed(2) || '-'}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Prueba Ácida (Quick):</span>
              <strong className="font-mono">{stock.quick_r?.toFixed(2) || '-'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Deuda / Patrimonio (D/E):</span>
              <strong className="font-mono">{stock.debt_eq?.toFixed(2) || '-'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Crecimiento EPS (QoQ):</span>
              <strong className="font-mono" style={{ color: stock.eps_qq && stock.eps_qq > 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {stock.eps_qq !== undefined && stock.eps_qq !== null ? `${stock.eps_qq.toFixed(2)}%` : '-'}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Crecimiento Ventas (QoQ):</span>
              <strong className="font-mono">{stock.sales_qq !== undefined && stock.sales_qq !== null ? `${stock.sales_qq.toFixed(2)}%` : '-'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Efectivo por Acción:</span>
              <strong className="font-mono">${stock.cash_sh?.toFixed(2) || '-'}</strong>
            </div>
          </div>
        </div>

        {/* Tarjeta: Consenso de Analistas & Noticias */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
            Consenso de Analistas
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Precio Objetivo (Target):</span>
              <strong className="font-mono" style={{ fontSize: '1.1rem', color: 'var(--accent-green)' }}>
                ${stock.target_price?.toFixed(2) || '-'}
              </strong>
            </div>
            {stock.target_price && stock.price && (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Potencial alcista estimado: <strong className={stock.target_price > stock.price ? 'delta-positive' : 'delta-negative'}>
                  {(((stock.target_price - stock.price) / stock.price) * 100).toFixed(1)}%
                </strong>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Recomendación (1=Compra, 5=Venta):</span>
              <strong className="font-mono">{stock.recom?.toFixed(2) || '-'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Fecha de Resultados:</span>
              <strong className="font-mono">{stock.earnings_date || '-'}</strong>
            </div>

            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Noticias & Cobertura:</span>
                <span style={{
                  background: 'rgba(16, 185, 129, 0.12)',
                  color: 'var(--accent-green)',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '4px'
                }}>
                  Portales Gratuitos
                </span>
              </div>
              <a 
                href="#radar-multimedia" 
                style={{ color: 'var(--accent-cyan)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
              >
                Ver Radar de Medios Abiertos y Videos ↓
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Apartado del Agente IA de Análisis Institucional (Estrategia de Inversión) */}
      <StockAIAnalysisPanel stock={stock} />

      {/* 5. Radar Multimedia: Noticias Gratuitas, Comunidad en X y Videos de YouTube */}
      <div id="radar-multimedia">
        <SectorNewsRadar 
          ticker={stock.ticker} 
          company={stock.company} 
          sector={stock.sector} 
          industry={stock.industry} 
        />
      </div>
    </div>
  );
};
