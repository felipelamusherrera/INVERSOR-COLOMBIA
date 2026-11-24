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
  X,
  Briefcase,
  Mail,
  BarChart2,
  GitCompare
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  ComposedChart,
  BarChart,
  AreaChart, 
  Area, 
  Bar,
  Line,
  Cell,
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend,
  CartesianGrid, 
  ReferenceLine 
} from 'recharts';
import { toast } from 'sonner';
import type { StockRecord } from '../types/stock';
import { calculateFactorGrades } from '../utils/quantRatings';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
  sendPriceAlertEmail,
  buildPriceAlertEmailHtml,
  type PriceAlertEmailResult
} from '../services/priceAlertEmailService';
import { TradingViewChart } from './TradingViewChart';
import { CandlestickChart } from './CandlestickChart';
import { SectorNewsRadar } from './SectorNewsRadar';
import { StockAIAnalysisPanel } from './StockAIAnalysisPanel';
import { ErrorBoundary } from './ErrorBoundary';
import { computeTechnicalSetup } from '../services/agentRagService';
import { calculateNextEarningsDate } from '../utils/formatters';
import { AddPositionModal } from './AddPositionModal';
import { AddToWatchlistModal } from './AddToWatchlistModal';
import { 
  fetchQuarterlyFinancials, 
  buildQuarterlySeries, 
  fetchOfficialFinancials,
  type QuarterlyDataPoint,
  type OfficialFinancialsData
} from '../services/quarterlyFinancialsService';

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

export type QuarterlyFinancialPoint = QuarterlyDataPoint;

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

// Reconstruye series fundamentales trimestrales y volumen en millones de USD
function computeHistoricalFundamentals(
  points: PricePoint[], 
  stock: StockRecord,
  officialFinancials?: OfficialFinancialsData | null
): PricePoint[] {
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
  
  // Flujo de Caja Libre (FCF): Priorizar dato anual auditado de SEC EDGAR (10-K/10-Q) si está disponible
  const hasAuditedFcf = officialFinancials?.secAnnualFCF !== undefined && officialFinancials?.secAnnualFCF !== null;
  const baseFCF = hasAuditedFcf ? officialFinancials!.secAnnualFCF! : (baseIncome * 0.85);
  const baseSalesYoY = stock.sales_qq ?? 10.5;
  const baseEpsYoY = stock.eps_qq ?? 12.0;

  // Mapa de FCF trimestral oficial de SEC
  const qFcfMap = new Map<string, number>();
  if (officialFinancials?.secQuarterlyFCF) {
    officialFinancials.secQuarterlyFCF.forEach(r => {
      const match = r.frame.match(/^CY(\d{4})Q(\d)$/);
      if (match) {
        qFcfMap.set(`Q${match[2]} ${match[1]}`, r.val);
      }
    });
  }

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
    
    // Si la SEC tiene el FCF auditado de este trimestre específico, usarlo directamente
    const fcfVal = qFcfMap.has(period)
      ? qFcfMap.get(period)!
      : Number((baseFCF * (1 + variance * 0.12 - (q * 0.035))).toFixed(1));
      
    const sYoY = Number((baseSalesYoY + variance * 3.5 - (q * 0.4)).toFixed(2));
    const eYoY = Number((baseEpsYoY + variance * 5.0 - (q * 0.6)).toFixed(2));

    quarterData.push({
      period,
      profit_m: pMargin,
      fcf: fcfVal,
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
  return buildQuarterlySeries(stock);
}

export type VariabilityTimeframe = '4H' | '1D' | '3D' | '1S' | '1M';

export interface IntradayBar4h {
  label: string;
  fullDate: string;
  close: number;
}

export interface VariabilitySeriesPoint {
  label: string;
  fullDate: string;
  periodDesc: string;
  prevClose: number;
  close: number;
  changePct: number;
  changeUsd: number;
}

export interface VariabilitySeriesResult {
  timeframe: VariabilityTimeframe;
  timelineLabel: string;
  sourceLabel: string;
  points: VariabilitySeriesPoint[];
  lastPoint: VariabilitySeriesPoint | null;
  avgAbsPct: number;
  stdDevPct: number;
  maxGain: VariabilitySeriesPoint | null;
  maxDrop: VariabilitySeriesPoint | null;
  positiveCount: number;
  negativeCount: number;
}

const MONTHS_ES_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function getIsoWeekKey(dateStr: string): string {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return dateStr.slice(0, 7);
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function formatMonthLabelEs(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return yyyyMm;
  return `${MONTHS_ES_SHORT[m - 1]} '${String(y).slice(2)}`;
}

function buildVariabilityStats(
  timeframe: VariabilityTimeframe,
  timelineLabel: string,
  sourceLabel: string,
  points: VariabilitySeriesPoint[]
): VariabilitySeriesResult {
  if (points.length === 0) {
    return {
      timeframe,
      timelineLabel,
      sourceLabel,
      points: [],
      lastPoint: null,
      avgAbsPct: 0,
      stdDevPct: 0,
      maxGain: null,
      maxDrop: null,
      positiveCount: 0,
      negativeCount: 0,
    };
  }

  let absSum = 0;
  let sum = 0;
  let positiveCount = 0;
  let negativeCount = 0;
  let maxGain = points[0];
  let maxDrop = points[0];

  for (const pt of points) {
    absSum += Math.abs(pt.changePct);
    sum += pt.changePct;
    if (pt.changePct >= 0) positiveCount++;
    else negativeCount++;
    if (pt.changePct > maxGain.changePct) maxGain = pt;
    if (pt.changePct < maxDrop.changePct) maxDrop = pt;
  }

  const mean = sum / points.length;
  const variance = points.reduce((acc, p) => acc + Math.pow(p.changePct - mean, 2), 0) / points.length;

  return {
    timeframe,
    timelineLabel,
    sourceLabel,
    points,
    lastPoint: points[points.length - 1],
    avgAbsPct: Number((absSum / points.length).toFixed(2)),
    stdDevPct: Number(Math.sqrt(variance).toFixed(2)),
    maxGain,
    maxDrop,
    positiveCount,
    negativeCount,
  };
}

function computeVariabilityTimeSeries(
  tf: VariabilityTimeframe,
  stock: StockRecord,
  rawPoints: PricePoint[],
  intradayBars4h: IntradayBar4h[]
): VariabilitySeriesResult {
  const valid = rawPoints.filter((p) => {
    const px = p.price ?? p.close ?? 0;
    return px > 0 && Boolean(p.date);
  });

  if (tf === '4H') {
    if (intradayBars4h.length >= 4) {
      const bars = intradayBars4h.slice(-37);
      const pts: VariabilitySeriesPoint[] = [];
      for (let i = 1; i < bars.length; i++) {
        const prev = bars[i - 1];
        const curr = bars[i];
        const pct = prev.close > 0 ? ((curr.close - prev.close) / prev.close) * 100 : 0;
        const usd = curr.close - prev.close;
        pts.push({
          label: curr.label,
          fullDate: curr.fullDate,
          periodDesc: `Bloque 4H: ${prev.fullDate} → ${curr.fullDate}`,
          prevClose: Number(prev.close.toFixed(2)),
          close: Number(curr.close.toFixed(2)),
          changePct: Number(pct.toFixed(2)),
          changeUsd: Number(usd.toFixed(2)),
        });
      }
      return buildVariabilityStats('4H', `Últimos ${pts.length} bloques de 4 horas`, 'Barras 4H reales (Yahoo 1H)', pts);
    }

    // Respaldo determinístico desde bloques OHLC AM/PM de las últimas 18 sesiones
    const recent = valid.slice(-19);
    if (recent.length >= 2) {
      const synthetic: IntradayBar4h[] = [
        {
          label: `${recent[0].date.slice(5)} PM`,
          fullDate: `${recent[0].date} PM`,
          close: Number((recent[0].price ?? recent[0].close ?? 0).toFixed(2)),
        },
      ];
      for (let i = 1; i < recent.length; i++) {
        const pt = recent[i];
        const cl = pt.price ?? pt.close ?? 0;
        const op = pt.open ?? cl;
        const hi = pt.high ?? Math.max(op, cl);
        const lo = pt.low ?? Math.min(op, cl);
        const midRaw = (op + (cl >= op ? lo : hi) + cl) / 3;
        const mid = Number(Math.min(hi, Math.max(lo, midRaw)).toFixed(2));
        synthetic.push({
          label: `${pt.date.slice(5)} AM`,
          fullDate: `${pt.date} AM`,
          close: mid,
        });
        synthetic.push({
          label: `${pt.date.slice(5)} PM`,
          fullDate: `${pt.date} PM`,
          close: Number(cl.toFixed(2)),
        });
      }
      const pts: VariabilitySeriesPoint[] = [];
      for (let i = 1; i < synthetic.length; i++) {
        const prev = synthetic[i - 1];
        const curr = synthetic[i];
        const pct = prev.close > 0 ? ((curr.close - prev.close) / prev.close) * 100 : 0;
        pts.push({
          label: curr.label,
          fullDate: curr.fullDate,
          periodDesc: `Bloque 4H: ${prev.fullDate} → ${curr.fullDate}`,
          prevClose: prev.close,
          close: curr.close,
          changePct: Number(pct.toFixed(2)),
          changeUsd: Number((curr.close - prev.close).toFixed(2)),
        });
      }
      return buildVariabilityStats('4H', `Últimos ${pts.length} bloques de 4 horas (~${recent.length - 1} sesiones)`, 'Bloques 4H derivados de OHLC diario', pts);
    }

    const fallbackPx = stock.price ?? 0;
    const fallbackPct = Number((stock.change_from_open_pct ?? (stock.change_pct ?? 0) * 0.65).toFixed(2));
    const fallbackUsd = fallbackPx > 0 && 1 + fallbackPct / 100 > 0 ? Number((fallbackPx - fallbackPx / (1 + fallbackPct / 100)).toFixed(2)) : 0;
    return buildVariabilityStats('4H', 'Sesión actual (sin histórico intradía)', 'Referencia apertura intradía', [
      {
        label: 'Hoy 4H',
        fullDate: new Date().toISOString().slice(0, 10),
        periodDesc: 'Variación intradía actual',
        prevClose: Number((fallbackPx - fallbackUsd).toFixed(2)),
        close: Number(fallbackPx.toFixed(2)),
        changePct: fallbackPct,
        changeUsd: fallbackUsd,
      },
    ]);
  }

  if (tf === '1D') {
    const slice = valid.slice(-61);
    const pts: VariabilitySeriesPoint[] = [];
    for (let i = 1; i < slice.length; i++) {
      const prevPx = slice[i - 1].price ?? slice[i - 1].close ?? 0;
      const currPx = slice[i].price ?? slice[i].close ?? 0;
      const pct = prevPx > 0 ? ((currPx - prevPx) / prevPx) * 100 : 0;
      pts.push({
        label: slice[i].date.slice(5),
        fullDate: slice[i].date,
        periodDesc: `Sesión ${slice[i].date} (vs ${slice[i - 1].date})`,
        prevClose: Number(prevPx.toFixed(2)),
        close: Number(currPx.toFixed(2)),
        changePct: Number(pct.toFixed(2)),
        changeUsd: Number((currPx - prevPx).toFixed(2)),
      });
    }
    return buildVariabilityStats('1D', `Últimas ${pts.length} sesiones diarias (~3 meses)`, 'Serie histórica diaria (1D)', pts);
  }

  if (tf === '3D') {
    const slice = valid.slice(-136);
    const pts: VariabilitySeriesPoint[] = [];
    if (slice.length >= 4) {
      const endpoints: number[] = [];
      for (let idx = slice.length - 1; idx >= 0; idx -= 3) {
        endpoints.unshift(idx);
      }
      for (let k = 1; k < endpoints.length; k++) {
        const prevIdx = endpoints[k - 1];
        const endIdx = endpoints[k];
        const startPt = slice[prevIdx + 1] ?? slice[endIdx];
        const endPt = slice[endIdx];
        const prevPx = slice[prevIdx].price ?? slice[prevIdx].close ?? 0;
        const currPx = endPt.price ?? endPt.close ?? 0;
        const pct = prevPx > 0 ? ((currPx - prevPx) / prevPx) * 100 : 0;
        pts.push({
          label: endPt.date.slice(5),
          fullDate: endPt.date,
          periodDesc: `Bloque 3D: ${startPt.date} → ${endPt.date} (vs ${slice[prevIdx].date})`,
          prevClose: Number(prevPx.toFixed(2)),
          close: Number(currPx.toFixed(2)),
          changePct: Number(pct.toFixed(2)),
          changeUsd: Number((currPx - prevPx).toFixed(2)),
        });
      }
    }
    return buildVariabilityStats('3D', `Últimos ${pts.length} bloques de 3 sesiones (~6-7 meses)`, 'Bloques no solapados de 3 días', pts);
  }

  if (tf === '1S') {
    const weekGroups: { weekKey: string; endPt: PricePoint }[] = [];
    for (const pt of valid) {
      const wk = getIsoWeekKey(pt.date);
      if (weekGroups.length > 0 && weekGroups[weekGroups.length - 1].weekKey === wk) {
        weekGroups[weekGroups.length - 1].endPt = pt;
      } else {
        weekGroups.push({ weekKey: wk, endPt: pt });
      }
    }
    const slice = weekGroups.slice(-53);
    const pts: VariabilitySeriesPoint[] = [];
    for (let i = 1; i < slice.length; i++) {
      const prevPt = slice[i - 1].endPt;
      const currPt = slice[i].endPt;
      const prevPx = prevPt.price ?? prevPt.close ?? 0;
      const currPx = currPt.price ?? currPt.close ?? 0;
      const pct = prevPx > 0 ? ((currPx - prevPx) / prevPx) * 100 : 0;
      pts.push({
        label: currPt.date.slice(5),
        fullDate: currPt.date,
        periodDesc: `Semana ${slice[i].weekKey} (cierre ${currPt.date} vs ${prevPt.date})`,
        prevClose: Number(prevPx.toFixed(2)),
        close: Number(currPx.toFixed(2)),
        changePct: Number(pct.toFixed(2)),
        changeUsd: Number((currPx - prevPx).toFixed(2)),
      });
    }
    return buildVariabilityStats('1S', `Últimas ${pts.length} semanas (~1 año)`, 'Cierre semanal (última sesión de semana)', pts);
  }

  // '1M'
  const monthGroups: { monthKey: string; endPt: PricePoint }[] = [];
  for (const pt of valid) {
    const mk = pt.date.slice(0, 7);
    if (monthGroups.length > 0 && monthGroups[monthGroups.length - 1].monthKey === mk) {
      monthGroups[monthGroups.length - 1].endPt = pt;
    } else {
      monthGroups.push({ monthKey: mk, endPt: pt });
    }
  }
  const monthSlice = monthGroups.slice(-37);
  const monthPts: VariabilitySeriesPoint[] = [];
  for (let i = 1; i < monthSlice.length; i++) {
    const prevPt = monthSlice[i - 1].endPt;
    const currPt = monthSlice[i].endPt;
    const prevPx = prevPt.price ?? prevPt.close ?? 0;
    const currPx = currPt.price ?? currPt.close ?? 0;
    const pct = prevPx > 0 ? ((currPx - prevPx) / prevPx) * 100 : 0;
    monthPts.push({
      label: formatMonthLabelEs(monthSlice[i].monthKey),
      fullDate: currPt.date,
      periodDesc: `Mes ${monthSlice[i].monthKey} (cierre ${currPt.date} vs ${prevPt.date})`,
      prevClose: Number(prevPx.toFixed(2)),
      close: Number(currPx.toFixed(2)),
      changePct: Number(pct.toFixed(2)),
      changeUsd: Number((currPx - prevPx).toFixed(2)),
    });
  }
  return buildVariabilityStats('1M', `Últimos ${monthPts.length} meses (hasta 3 años)`, 'Cierre mensual (última sesión del mes)', monthPts);
}

export interface DivergenceAnalysisResult {
  hasEnoughData: boolean;
  windowSessions: number;
  periodStartDate: string;
  periodEndDate: string;
  cycle1Range: string;
  cycle2Range: string;
  degreePct: number;
  severity: 'Alta' | 'Moderada' | 'Baja / Nula';
  classification: string;
  directionColor: string;
  diagnosis: string;
  highs: {
    prevPrice: number;
    prevDate: string;
    recentPrice: number;
    recentDate: string;
    priceDeltaPct: number;
    prevRsi: number;
    prevRsiDate: string;
    recentRsi: number;
    recentRsiDate: string;
    rsiDeltaPts: number;
    isDivergent: boolean;
  };
  lows: {
    prevPrice: number;
    prevDate: string;
    recentPrice: number;
    recentDate: string;
    priceDeltaPct: number;
    prevRsi: number;
    prevRsiDate: string;
    recentRsi: number;
    recentRsiDate: string;
    rsiDeltaPts: number;
    isDivergent: boolean;
  };
}

function computePriceRsiDivergence(rawPoints: PricePoint[]): DivergenceAnalysisResult {
  const valid = rawPoints
    .slice(-90)
    .filter(
      (p) =>
        p.rsi !== undefined &&
        p.rsi !== null &&
        !isNaN(p.rsi) &&
        (p.price ?? p.close) !== undefined &&
        (p.price ?? p.close)! > 0
    );

  if (valid.length < 12) {
    return {
      hasEnoughData: false,
      windowSessions: valid.length,
      periodStartDate: valid[0]?.date || '-',
      periodEndDate: valid[valid.length - 1]?.date || '-',
      cycle1Range: '-',
      cycle2Range: '-',
      degreePct: 0,
      severity: 'Baja / Nula',
      classification: 'Datos insuficientes para cruce de extremos',
      directionColor: '#94a3b8',
      diagnosis: 'Se requieren al menos 12 sesiones diarias con histórico de Precio y RSI (14) para contrastar máximos y mínimos entre dos ciclos.',
      highs: { prevPrice: 0, prevDate: '-', recentPrice: 0, recentDate: '-', priceDeltaPct: 0, prevRsi: 0, prevRsiDate: '-', recentRsi: 0, recentRsiDate: '-', rsiDeltaPts: 0, isDivergent: false },
      lows: { prevPrice: 0, prevDate: '-', recentPrice: 0, recentDate: '-', priceDeltaPct: 0, prevRsi: 0, prevRsiDate: '-', recentRsi: 0, recentRsiDate: '-', rsiDeltaPts: 0, isDivergent: false },
    };
  }

  const mid = Math.floor(valid.length / 2);
  const firstHalf = valid.slice(0, mid);
  const secondHalf = valid.slice(mid);

  const findExtremes = (slice: PricePoint[]) => {
    let maxPricePt = slice[0];
    let minPricePt = slice[0];
    let maxRsiPt = slice[0];
    let minRsiPt = slice[0];

    for (const pt of slice) {
      const pHi = pt.high ?? pt.price ?? pt.close ?? 0;
      const pLo = pt.low ?? pt.price ?? pt.close ?? 0;
      const bestHi = maxPricePt.high ?? maxPricePt.price ?? maxPricePt.close ?? 0;
      const bestLo = minPricePt.low ?? minPricePt.price ?? minPricePt.close ?? 0;

      if (pHi > bestHi) maxPricePt = pt;
      if (pLo < bestLo) minPricePt = pt;
      if ((pt.rsi ?? 0) > (maxRsiPt.rsi ?? 0)) maxRsiPt = pt;
      if ((pt.rsi ?? 100) < (minRsiPt.rsi ?? 100)) minRsiPt = pt;
    }

    return {
      maxPrice: Number((maxPricePt.high ?? maxPricePt.price ?? maxPricePt.close ?? 0).toFixed(2)),
      maxPriceDate: maxPricePt.date,
      minPrice: Number((minPricePt.low ?? minPricePt.price ?? minPricePt.close ?? 0).toFixed(2)),
      minPriceDate: minPricePt.date,
      maxRsi: Number((maxRsiPt.rsi ?? 50).toFixed(1)),
      maxRsiDate: maxRsiPt.date,
      minRsi: Number((minRsiPt.rsi ?? 50).toFixed(1)),
      minRsiDate: minRsiPt.date,
    };
  };

  const ext1 = findExtremes(firstHalf);
  const ext2 = findExtremes(secondHalf);

  const priceHighDeltaPct = ext1.maxPrice > 0 ? Number((((ext2.maxPrice - ext1.maxPrice) / ext1.maxPrice) * 100).toFixed(2)) : 0;
  const rsiHighDeltaPts = Number((ext2.maxRsi - ext1.maxRsi).toFixed(1));
  const priceLowDeltaPct = ext1.minPrice > 0 ? Number((((ext2.minPrice - ext1.minPrice) / ext1.minPrice) * 100).toFixed(2)) : 0;
  const rsiLowDeltaPts = Number((ext2.minRsi - ext1.minRsi).toFixed(1));

  // Divergencia clásica bajista en máximos: Precio hace máximo más alto, RSI hace máximo más bajo
  const classicBearishHigh = priceHighDeltaPct > 0.3 && rsiHighDeltaPts < -1.0;
  const bearishScore = classicBearishHigh
    ? Math.min(100, Math.round(Math.min(15, Math.abs(priceHighDeltaPct)) * 3.0 + Math.min(25, Math.abs(rsiHighDeltaPts)) * 2.2))
    : 0;

  // Divergencia clásica alcista en mínimos: Precio hace mínimo más bajo, RSI hace mínimo más alto
  const classicBullishLow = priceLowDeltaPct < -0.3 && rsiLowDeltaPts > 1.0;
  const bullishScore = classicBullishLow
    ? Math.min(100, Math.round(Math.min(15, Math.abs(priceLowDeltaPct)) * 3.0 + Math.min(25, Math.abs(rsiLowDeltaPts)) * 2.2))
    : 0;

  // Divergencias ocultas (de continuación)
  const hiddenBullishLow = !classicBullishLow && priceLowDeltaPct > 0.5 && rsiLowDeltaPts < -1.5;
  const hiddenBullScore = hiddenBullishLow
    ? Math.min(85, Math.round(Math.min(12, Math.abs(priceLowDeltaPct)) * 2.4 + Math.min(20, Math.abs(rsiLowDeltaPts)) * 1.8))
    : 0;

  const hiddenBearishHigh = !classicBearishHigh && priceHighDeltaPct < -0.5 && rsiHighDeltaPts > 1.5;
  const hiddenBearScore = hiddenBearishHigh
    ? Math.min(85, Math.round(Math.min(12, Math.abs(priceHighDeltaPct)) * 2.4 + Math.min(20, Math.abs(rsiHighDeltaPts)) * 1.8))
    : 0;

  const degreePct = Math.max(bearishScore, bullishScore, hiddenBullScore, hiddenBearScore);
  const severity: DivergenceAnalysisResult['severity'] =
    degreePct >= 55 ? 'Alta' : degreePct >= 25 ? 'Moderada' : 'Baja / Nula';

  let classification = 'Convergencia (Tendencia Confirmada)';
  let directionColor = '#06b6d4';
  let diagnosis =
    'Los máximos y mínimos del precio están acompañados en la misma dirección por el RSI (14), confirmando coherencia de impulso sin señales fuertes de agotamiento por divergencia.';

  if (classicBullishLow && bullishScore >= bearishScore) {
    classification = 'Divergencia Alcista Clásica (Mínimos)';
    directionColor = '#10b981';
    diagnosis = `El precio marcó un mínimo más bajo (${priceLowDeltaPct}%), pero el RSI formó un mínimo más alto (+${rsiLowDeltaPts} pts). Indica pérdida de presión vendedora y potencial giro alcista.`;
  } else if (classicBearishHigh && bearishScore > bullishScore) {
    classification = 'Divergencia Bajista Clásica (Máximos)';
    directionColor = '#ef4444';
    diagnosis = `El precio alcanzó un máximo superior (+${priceHighDeltaPct}%), pero el RSI registró un máximo descendente (${rsiHighDeltaPts} pts). Señal de debilitamiento del impulso comprador y riesgo de toma de beneficios.`;
  } else if (hiddenBullishLow && hiddenBullScore >= hiddenBearScore) {
    classification = 'Divergencia Alcista Oculta (Continuación)';
    directionColor = '#34d399';
    diagnosis = `El precio mantiene mínimos crecientes (+${priceLowDeltaPct}%) mientras el RSI descomprime (${rsiLowDeltaPts} pts), patrón compatible con consolidación dentro de tendencia alcista.`;
  } else if (hiddenBearishHigh) {
    classification = 'Divergencia Bajista Oculta (Continuación)';
    directionColor = '#f59e0b';
    diagnosis = `El precio marca máximos descendentes (${priceHighDeltaPct}%) mientras el RSI rebota (+${rsiHighDeltaPts} pts), sugiriendo resistencia técnica vigente.`;
  }

  return {
    hasEnoughData: true,
    windowSessions: valid.length,
    periodStartDate: valid[0].date,
    periodEndDate: valid[valid.length - 1].date,
    cycle1Range: `${firstHalf[0].date} → ${firstHalf[firstHalf.length - 1].date}`,
    cycle2Range: `${secondHalf[0].date} → ${secondHalf[secondHalf.length - 1].date}`,
    degreePct,
    severity,
    classification,
    directionColor,
    diagnosis,
    highs: {
      prevPrice: ext1.maxPrice,
      prevDate: ext1.maxPriceDate,
      recentPrice: ext2.maxPrice,
      recentDate: ext2.maxPriceDate,
      priceDeltaPct: priceHighDeltaPct,
      prevRsi: ext1.maxRsi,
      prevRsiDate: ext1.maxRsiDate,
      recentRsi: ext2.maxRsi,
      recentRsiDate: ext2.maxRsiDate,
      rsiDeltaPts: rsiHighDeltaPts,
      isDivergent: classicBearishHigh || hiddenBearishHigh,
    },
    lows: {
      prevPrice: ext1.minPrice,
      prevDate: ext1.minPriceDate,
      recentPrice: ext2.minPrice,
      recentDate: ext2.minPriceDate,
      priceDeltaPct: priceLowDeltaPct,
      prevRsi: ext1.minRsi,
      prevRsiDate: ext1.minRsiDate,
      recentRsi: ext2.minRsi,
      recentRsiDate: ext2.minRsiDate,
      rsiDeltaPts: rsiLowDeltaPts,
      isDivergent: classicBullishLow || hiddenBullishLow,
    },
  };
}

interface StockDetailProps {
  stock: StockRecord;
  onBack: () => void;
  onToggleWatchlist: (ticker: string) => void;
  isWatchlisted: boolean;
  allStocks?: StockRecord[];
  onTriggerAgentPrompt?: (
    prompt: string,
    intent?: 'technical_chart' | 'stock_diagnosis' | 'peer_comparison'
  ) => void;
}

export const StockDetail: React.FC<StockDetailProps> = ({
  stock,
  onBack,
  onToggleWatchlist,
  isWatchlisted,
  allStocks,
  onTriggerAgentPrompt
}) => {
  const { user } = useAuth();
  const analysis = calculateFactorGrades(stock);

  // Próxima Fecha de Dividendo (Ex-Dividendo) calculada o proyectada
  const nextDividendDateStr = useMemo(() => {
    if (!stock.dividend || stock.dividend <= 0) return null;
    
    // Proyección del próximo ciclo trimestral de dividendo
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-11
    const currentYear = now.getFullYear();

    // Meses de pago del ciclo trimestral (Mar, Jun, Sep, Dic)
    const cycle = [2, 5, 8, 11];
    let targetMonth = cycle.find(m => m >= currentMonth);
    let targetYear = currentYear;
    if (targetMonth === undefined) {
      targetMonth = cycle[0];
      targetYear = currentYear + 1;
    }
    
    const targetDate = new Date(targetYear, targetMonth, 15);
    return targetDate.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }) + ' (Est.)';
  }, [stock.dividend]);

  // Estados de Terminal Dual
  const [terminalMode, setTerminalMode] = useState<'local' | 'tradingview'>('local');
  const [chartType, setChartType] = useState<'area' | 'candles'>('area');
  const [activeChart, setActiveChart] = useState<ActiveChartType>('price');
  const [timeframe, setTimeframe] = useState<'1M' | '6M' | '1Y' | '3Y'>('1Y');
  const [rawPoints, setRawPoints] = useState<PricePoint[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showChartAIScan, setShowChartAIScan] = useState(false);
  const [showAddPositionModal, setShowAddPositionModal] = useState(false);
  const [showAddToWatchlistModal, setShowAddToWatchlistModal] = useState(false);

  // Fase 3: Cálculo técnico en vivo sobre la serie de velas de los últimos 6 meses (126 sesiones OHLCV)
  const sixMonthTechnicalSetup = useMemo(() => {
    const mappedCandles = rawPoints.slice(-130).map((p) => ({
      price_date: p.date,
      open_price: p.open ?? p.price ?? stock.price ?? 100,
      high_price: p.high ?? p.price ?? stock.price ?? 100,
      low_price: p.low ?? p.price ?? stock.price ?? 100,
      close_price: p.close ?? p.price ?? stock.price ?? 100,
      volume: p.volume,
    }));
    return computeTechnicalSetup(stock, mappedCandles);
  }, [stock, rawPoints]);

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
  const [triggeredToast, setTriggeredToast] = useState<{
    ticker: string;
    message: string;
    note?: string;
    emailStatus?: string;
    emailResult?: PriceAlertEmailResult;
  } | null>(null);
  const [lastAlertEmailPreview, setLastAlertEmailPreview] = useState<PriceAlertEmailResult | null>(null);
  const [showEmailPreviewModal, setShowEmailPreviewModal] = useState(false);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [variabilityTimeframe, setVariabilityTimeframe] = useState<VariabilityTimeframe>('1D');
  const [intradayBars4h, setIntradayBars4h] = useState<IntradayBar4h[]>([]);

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

  // Detector en vivo de cruce de alertas + despacho automático de correo institucional
  useEffect(() => {
    if (!stock.price) return;
    const currentPrice = stock.price;
    const toTrigger = alerts.filter((a) => {
      if (a.ticker !== stock.ticker || a.triggered) return false;
      const crossedAbove = a.condition === 'ABOVE' && currentPrice >= a.targetPrice;
      const crossedBelow = a.condition === 'BELOW' && currentPrice <= a.targetPrice;
      return crossedAbove || crossedBelow;
    });

    if (toTrigger.length === 0) return;

    const triggerIds = new Set(toTrigger.map((a) => a.id));
    const nowIso = new Date().toISOString();
    const nextAlerts = alerts.map((a) =>
      triggerIds.has(a.id) ? { ...a, triggered: true, triggeredAt: nowIso } : a
    );
    setAlerts(nextAlerts);
    localStorage.setItem('inversor_colombia_alerts', JSON.stringify(nextAlerts));
    playAlertBeep();

    const first = toTrigger[0];
    const recipientEmail = user?.email || '';
    setTriggeredToast({
      ticker: first.ticker,
      message: `¡Alerta Ejecutada! ${first.ticker} cotiza a $${currentPrice.toFixed(2)} USD (cruzó tu umbral de $${first.targetPrice.toFixed(2)} USD)`,
      note: first.note,
      emailStatus: recipientEmail ? `Enviando correo institucional a ${recipientEmail}...` : undefined,
    });

    if (recipientEmail) {
      toTrigger.forEach((alertItem) => {
        sendPriceAlertEmail({
          toEmail: recipientEmail,
          ticker: alertItem.ticker,
          company: stock.company || alertItem.ticker,
          currentPrice,
          targetPrice: alertItem.targetPrice,
          condition: alertItem.condition,
          note: alertItem.note,
        }).then((emailRes) => {
          setLastAlertEmailPreview(emailRes);
          setTriggeredToast((prev) =>
            prev && prev.ticker === alertItem.ticker
              ? {
                  ...prev,
                  emailStatus: emailRes.delivered
                    ? `Correo enviado a ${emailRes.recipient}`
                    : `Vista previa lista para ${emailRes.recipient}`,
                  emailResult: emailRes,
                }
              : prev
          );
          if (emailRes.delivered) {
            toast.success(`Correo de alerta enviado a ${emailRes.recipient}`);
          }
        });
      });
    }
  }, [stock.price, stock.ticker, stock.company, alerts, user?.email]);

  const handlePreviewOrTestAlertEmail = async () => {
    const recipientEmail = user?.email || 'inversionista@inversorcolombia.com';
    const currentPrice = stock.price || newAlertPrice || 100;
    const targetPrice = newAlertPrice || currentPrice;
    const htmlBody = buildPriceAlertEmailHtml({
      toEmail: recipientEmail,
      ticker: stock.ticker,
      company: stock.company || stock.ticker,
      currentPrice,
      targetPrice,
      condition: newAlertCondition,
      note: newAlertNote.trim() || undefined,
      appUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
    });

    const previewResult: PriceAlertEmailResult = {
      delivered: false,
      provider: 'preview',
      recipient: recipientEmail,
      subject: `🚨 Alerta de Precio ${stock.ticker}: $${currentPrice.toFixed(2)} USD — Inversor Colombia`,
      htmlBody,
    };

    if (user?.email) {
      setSendingTestEmail(true);
      try {
        const res = await sendPriceAlertEmail({
          toEmail: user.email,
          ticker: stock.ticker,
          company: stock.company || stock.ticker,
          currentPrice,
          targetPrice,
          condition: newAlertCondition,
          note: newAlertNote.trim() || 'Prueba de presentación institucional de alerta',
        });
        setLastAlertEmailPreview(res);
        setShowEmailPreviewModal(true);
        if (res.delivered) {
          toast.success(`Correo de prueba enviado a ${res.recipient}`);
        } else {
          toast.info(`Vista previa institucional generada para ${res.recipient}`);
        }
        return;
      } finally {
        setSendingTestEmail(false);
      }
    }

    setLastAlertEmailPreview(previewResult);
    setShowEmailPreviewModal(true);
  };

  // Consultar barras horarias (1H en últimos 60 días) y agruparlas en bloques de 4 horas (AM/PM horario NYSE)
  useEffect(() => {
    let isMounted = true;
    setIntradayBars4h([]);
    fetch(`/api/chart/${stock.ticker}?range=60d&interval=1h`)
      .then((res) => (res && res.ok && (res.headers.get('content-type') || '').includes('json') ? res.json() : null))
      .then((json) => {
        if (!isMounted || !json) return;
        const result = json?.chart?.result?.[0];
        const timestamps: number[] = result?.timestamp || [];
        const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close || [];
        const fmt = new Intl.DateTimeFormat('sv-SE', {
          timeZone: 'America/New_York',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });

        const blockOrder: string[] = [];
        const blockMap = new Map<string, IntradayBar4h>();

        for (let i = 0; i < timestamps.length; i++) {
          const cl = closes[i];
          if (typeof cl !== 'number' || !Number.isFinite(cl) || cl <= 0) continue;
          const parts = fmt.format(new Date(timestamps[i] * 1000)).split(' ');
          const datePart = parts[0] || '';
          const hourNum = Number((parts[1] || '12').split(':')[0]);
          if (!datePart || isNaN(hourNum)) continue;
          const slot = hourNum < 13 ? 'AM' : 'PM';
          const key = `${datePart}|${slot}`;
          const bar: IntradayBar4h = {
            label: `${datePart.slice(5)} ${slot}`,
            fullDate: `${datePart} ${slot === 'AM' ? '12:30' : '16:00'} NY`,
            close: Number(cl.toFixed(2)),
          };
          if (!blockMap.has(key)) {
            blockOrder.push(key);
          }
          blockMap.set(key, bar);
        }

        if (blockOrder.length >= 2) {
          setIntradayBars4h(blockOrder.map((k) => blockMap.get(k)!));
        }
      })
      .catch(() => {
        // Fallback automático a bloques derivados de OHLC diario
      });
    return () => {
      isMounted = false;
    };
  }, [stock.ticker]);

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

  // Cargar histórico de 3 años para este ticker (Datos 100% Reales de Supabase / Yahoo Finance)
  useEffect(() => {
    let isMounted = true;
    async function loadHistoricalData() {
      setLoadingHistory(true);
      try {
        // 1. Consultar stock_prices_history en Supabase (precargado con los 3 años de Yahoo Finance)
        const { data: dbData, error: dbError } = await supabase
          .from('stock_prices_history')
          .select('*')
          .eq('ticker', stock.ticker)
          .order('price_date', { ascending: true });

        if (!dbError && dbData && dbData.length > 0) {
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

        // 2. Si hay proxy local disponible (/api/chart en desarrollo), obtener datos reales de Yahoo Finance
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

            if (validIndices.length > 0) {
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

              // Guardar en Supabase en segundo plano
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
                // Silencioso
              }
              return;
            }
          }
        } catch {
          // Continuar con snapshots reales en Supabase
        }

        // 3. Consultar snapshots diarios reales en inversor_colombia_stocks
        const { data: snapData } = await supabase
          .from('inversor_colombia_stocks')
          .select('snapshot_date, price, open, high, low, volume, rsi')
          .eq('ticker', stock.ticker)
          .order('snapshot_date', { ascending: true });

        if (snapData && snapData.length > 0 && isMounted) {
          const pts: PricePoint[] = snapData
            .filter((s: any) => s.snapshot_date && s.price)
            .map((s: any) => ({
              date: s.snapshot_date,
              displayDate: s.snapshot_date.slice(5),
              price: Number(s.price),
              open: s.open ? Number(s.open) : Number(s.price),
              high: s.high ? Number(s.high) : Number(s.price),
              low: s.low ? Number(s.low) : Number(s.price),
              close: Number(s.price),
              rsi: s.rsi !== null && s.rsi !== undefined ? Number(s.rsi) : undefined,
              volume: s.volume ? Number(s.volume) : undefined
            }));
          const enriched = computeHistoricalFundamentals(pts, stock);
          setRawPoints(enriched);
        }
      } catch (err) {
        console.error('Error fetching prices history:', err);
      } finally {
        if (isMounted) setLoadingHistory(false);
      }
    }

    loadHistoricalData();
    return () => { isMounted = false; };
  }, [stock.ticker]);

  // Filtrar los puntos según la ventana temporal seleccionada
  const chartData = useMemo<PricePoint[]>(() => {
    if (!rawPoints || rawPoints.length === 0) return [];

    let days = 252; // 1Y por defecto
    if (timeframe === '1M') days = 22;
    else if (timeframe === '6M') days = 126;
    else if (timeframe === '1Y') days = 252;
    else if (timeframe === '3Y') days = 756;

    const slice = rawPoints.slice(-days);
    return slice.map(s => ({
      ...s,
      displayDate: (timeframe === '1Y' || timeframe === '3Y') ? s.date.slice(2, 7) : s.date.slice(5)
    }));
  }, [rawPoints, timeframe]);

  // Retorno porcentual de la ventana temporal seleccionada
  const timeframeReturn = useMemo(() => {
    if (chartData.length < 2) return null;
    const firstP = chartData[0].price;
    const lastP = chartData[chartData.length - 1].price;
    if (!firstP || !lastP) return null;
    return Number((((lastP - firstP) / firstP) * 100).toFixed(1));
  }, [chartData]);

  // Datos trimestrales oficiales auditados (SEC EDGAR XBRL + Nasdaq) con verificación estricta de fecha (hoy)
  const [allQuarterlyData, setAllQuarterlyData] = useState<QuarterlyDataPoint[]>(() => buildQuarterlySeries(stock));
  const [officialFinancials, setOfficialFinancials] = useState<OfficialFinancialsData | null>(null);

  useEffect(() => {
    let isMounted = true;
    setAllQuarterlyData(buildQuarterlySeries(stock));

    fetchOfficialFinancials(stock.ticker).then(data => {
      if (isMounted && data) {
        setOfficialFinancials(data);
        setAllQuarterlyData(buildQuarterlySeries(stock, data));
      }
    }).catch(err => {
      console.warn(`Error cargando estados contables oficiales para ${stock.ticker}:`, err);
    });

    return () => { isMounted = false; };
  }, [stock.ticker, stock.earnings_date]);

  // Re-enriquecer puntos históricos cuando se confirmen los datos contables auditados de SEC (FCF real)
  useEffect(() => {
    if (rawPoints && rawPoints.length > 0 && officialFinancials) {
      setRawPoints(prev => computeHistoricalFundamentals(prev, stock, officialFinancials));
    }
  }, [officialFinancials]);

  const quarterlyData = useMemo(() => {
    let count = 8;
    if (timeframe === '1M' || timeframe === '6M') count = 4;
    else if (timeframe === '1Y') count = 8;
    else if (timeframe === '3Y') count = 14;
    return allQuarterlyData.slice(-count);
  }, [allQuarterlyData, timeframe]);

  const variabilityData = useMemo(
    () => computeVariabilityTimeSeries(variabilityTimeframe, stock, rawPoints, intradayBars4h),
    [variabilityTimeframe, stock, rawPoints, intradayBars4h]
  );

  const divergenceAnalysis = useMemo(
    () => computePriceRsiDivergence(rawPoints),
    [rawPoints]
  );

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: 'var(--page-py, 20px) var(--page-px, 16px)' }} className="animate-fade-in">
      
      {/* Toast Notificación de Alerta de Cruce + Envío de Correo */}
      {triggeredToast && (
        <div style={{
          position: 'fixed',
          top: '16px',
          right: '12px',
          zIndex: 2000,
          background: 'rgba(15, 23, 42, 0.96)',
          backdropFilter: 'blur(16px)',
          border: '2px solid #f59e0b',
          borderRadius: '12px',
          padding: '14px 16px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.7)',
          maxWidth: 'min(420px, calc(100vw - 24px))',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          animation: 'fade-in 0.3s ease-out'
        }}>
          <BellRing size={22} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#fff', marginBottom: '4px' }}>
              🚨 Alerta Bursátil: {triggeredToast.ticker}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {triggeredToast.message}
            </div>
            {triggeredToast.note && (
              <div style={{ fontSize: '0.76rem', color: '#f59e0b', marginTop: '6px' }}>
                Nota: {triggeredToast.note}
              </div>
            )}
            {triggeredToast.emailStatus && (
              <div style={{ fontSize: '0.73rem', color: '#34d399', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <Mail size={13} />
                <span>{triggeredToast.emailStatus}</span>
                {triggeredToast.emailResult && (
                  <button
                    type="button"
                    onClick={() => {
                      setLastAlertEmailPreview(triggeredToast.emailResult!);
                      setShowEmailPreviewModal(true);
                    }}
                    style={{
                      background: 'rgba(16, 185, 129, 0.16)',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      borderRadius: '5px',
                      color: '#34d399',
                      padding: '2px 7px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Ver Correo
                  </button>
                )}
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
        <button className="btn btn-secondary" style={{ padding: '7px 12px', fontSize: '0.8rem' }} onClick={onBack}>
          <ArrowLeft size={15} /> Volver al Screener
        </button>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-secondary"
            onClick={() => setShowAddToWatchlistModal(true)}
            style={{ gap: '6px', padding: '7px 12px', fontSize: '0.78rem', fontWeight: 700 }}
            title="Organizar en Listas de Seguimiento Personalizadas"
          >
            <Bookmark size={14} fill={isWatchlisted ? 'var(--accent-cyan)' : 'none'} color={isWatchlisted ? 'var(--accent-cyan)' : 'currentColor'} />
            Listas de Seguimiento
          </button>

          <button 
            id="btn-add-to-portfolio"
            className="btn btn-primary"
            onClick={() => setShowAddPositionModal(true)}
            style={{ 
              gap: '6px', 
              padding: '7px 13px',
              fontSize: '0.78rem', 
              fontWeight: 800,
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.25)'
            }}
            title="Abrir formulario oficial de registro para Mi Cartera"
          >
            <Briefcase size={14} />
            Agregar a Mi Cartera
          </button>
        </div>
      </div>

      {/* Ficha Principal de la Acción (Estilo Seeking Alpha) */}
      <div className="glass-panel" style={{ padding: 'var(--card-pad, 24px)', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ flex: '1 1 260px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
              <h1 className="font-mono" style={{ fontSize: 'clamp(1.65rem, 4vw, 2.2rem)', fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                {stock.ticker}
              </h1>
              <span style={{
                background: 'var(--bg-surface-hover)',
                color: 'var(--text-secondary)',
                fontSize: '0.74rem',
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)'
              }}>
                {stock.country || 'USA'} · {stock.asset_type || 'Common Stock'}
              </span>
              {stock.index_name && (
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  Índice: {stock.index_name}
                </span>
              )}
            </div>
            <div style={{ fontSize: 'clamp(0.98rem, 2vw, 1.15rem)', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '6px' }}>
              {stock.company}
            </div>
            <div style={{ display: 'flex', gap: '8px', rowGap: '4px', flexWrap: 'wrap', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <span>Sector: <strong style={{ color: 'var(--text-primary)' }}>{stock.sector || '-'}</strong></span>
              <span>·</span>
              <span>Industria: <strong style={{ color: 'var(--text-primary)' }}>{stock.industry || '-'}</strong></span>
            </div>

            {/* Próxima Fecha de Dividendo si la hay */}
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{
                background: stock.dividend && stock.dividend > 0 ? 'rgba(16, 185, 129, 0.10)' : 'rgba(255, 255, 255, 0.04)',
                border: stock.dividend && stock.dividend > 0 ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '5px 10px',
                display: 'inline-flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '6px',
                fontSize: '0.77rem'
              }}>
                <span style={{ color: 'var(--text-muted)' }}>Dividendo:</span>
                <strong className="font-mono" style={{ color: stock.dividend && stock.dividend > 0 ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
                  {stock.dividend && stock.dividend > 0 ? `${stock.dividend.toFixed(2)}% Rentabilidad` : 'No distribuye (0.00%)'}
                </strong>
                {stock.dividend && stock.dividend > 0 && nextDividendDateStr && (
                  <>
                    <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
                    <span style={{ color: 'var(--text-muted)' }}>Próxima Fecha (Ex-Div):</span>
                    <strong style={{ color: 'var(--accent-cyan)' }}>
                      {nextDividendDateStr}
                    </strong>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Precio y Rendimiento */}
          <div style={{ textAlign: 'left', flexShrink: 0 }}>
            <div className="font-mono" style={{ fontSize: 'clamp(1.75rem, 4.5vw, 2.4rem)', fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>
              ${stock.price?.toFixed(2)}
            </div>
            {stock.change_pct !== undefined && stock.change_pct !== null && (
              <div style={{ fontSize: '0.96rem', fontWeight: 700, marginTop: '4px' }} className={stock.change_pct >= 0 ? 'delta-positive' : 'delta-negative'}>
                {stock.change_pct >= 0 ? '+' : ''}{stock.change_pct.toFixed(2)}% Hoy
              </div>
            )}
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
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

            {/* Botón Analizar Gráfico con IA & Alertas de Cruce */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button
                className="btn"
                style={{
                  padding: '5px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: showChartAIScan
                    ? 'linear-gradient(135deg, #059669 0%, #0284c7 100%)'
                    : 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(6, 182, 212, 0.2) 100%)',
                  border: '1px solid rgba(16, 185, 129, 0.45)',
                  color: showChartAIScan ? '#ffffff' : '#34d399',
                }}
                onClick={() => setShowChartAIScan((prev) => !prev)}
                title={`Escaneo técnico de serie de velas de 6 meses de ${stock.ticker}`}
              >
                ⚡ {showChartAIScan ? 'Ocultar Escaneo Técnico IA' : 'Analizar Gráfico con IA'}
              </button>

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

          {/* FASE 3: TARJETA INTERACTIVA DE ESCANEO TÉCNICO DE VELAS (6 MESES OHLCV) */}
          {showChartAIScan && (
            <div
              style={{
                marginBottom: '18px',
                padding: '16px 20px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(6, 78, 59, 0.25) 0%, rgba(15, 23, 42, 0.95) 100%)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                boxShadow: '0 8px 25px rgba(0, 0, 0, 0.35)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px',
                  marginBottom: '12px',
                  paddingBottom: '10px',
                  borderBottom: '1px solid rgba(148, 163, 184, 0.16)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff' }}>
                      ⚡ Diagnóstico Técnico Automatizado de Velas ({sixMonthTechnicalSetup.candlesAnalyzedCount} Sesiones / 6 Meses)
                    </span>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: 'rgba(16, 185, 129, 0.2)',
                        color: '#34d399',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                      }}
                    >
                      {sixMonthTechnicalSetup.trendStatus}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#38bdf8', fontWeight: 700, marginTop: '4px' }}>
                    Patrón Detectado: {sixMonthTechnicalSetup.detectedChartPattern}
                  </div>
                </div>

                {onTriggerAgentPrompt && (
                  <button
                    onClick={() =>
                      onTriggerAgentPrompt(
                        `Analiza la estructura técnica del gráfico de ${stock.ticker}: medias móviles reales SMA 50 y SMA 200, pivotes de 20 sesiones, distancia a ATH, RSI, RVol y define Zona de Entrada, Stop Loss y Targets con Trailing Breakeven.`,
                        'technical_chart'
                      )
                    }
                    className="btn"
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      background: 'linear-gradient(135deg, #059669 0%, #0284c7 100%)',
                      color: '#fff',
                      border: 'none',
                    }}
                  >
                    Abrir Análisis Completo en Agente IA →
                  </button>
                )}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '10px',
                  marginBottom: '12px',
                }}
              >
                <div style={{ background: 'rgba(7, 11, 20, 0.75)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>SOPORTE PIVOTE 20D</div>
                  <div className="font-mono" style={{ fontSize: '1rem', fontWeight: 800, color: '#38bdf8', marginTop: '2px' }}>
                    ${sixMonthTechnicalSetup.support20D.toFixed(2)}
                  </div>
                  <div style={{ fontSize: '0.66rem', color: '#64748b' }}>Mínimo 6M: ${sixMonthTechnicalSetup.sixMonthLow.toFixed(2)}</div>
                </div>

                <div style={{ background: 'rgba(7, 11, 20, 0.75)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>RESISTENCIA PIVOTE 20D</div>
                  <div className="font-mono" style={{ fontSize: '1rem', fontWeight: 800, color: '#f59e0b', marginTop: '2px' }}>
                    ${sixMonthTechnicalSetup.resistance20D.toFixed(2)}
                  </div>
                  <div style={{ fontSize: '0.66rem', color: '#64748b' }}>Máximo 6M: ${sixMonthTechnicalSetup.sixMonthHigh.toFixed(2)}</div>
                </div>

                <div style={{ background: 'rgba(7, 11, 20, 0.75)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>SMA 50 / SMA 200 REAL</div>
                  <div className="font-mono" style={{ fontSize: '0.92rem', fontWeight: 800, color: '#e2e8f0', marginTop: '2px' }}>
                    ${sixMonthTechnicalSetup.sma50Real.toFixed(2)} / ${sixMonthTechnicalSetup.sma200Real.toFixed(2)}
                  </div>
                  <div style={{ fontSize: '0.66rem', color: '#64748b' }}>ATR(14): ${sixMonthTechnicalSetup.realAtr14.toFixed(2)} USD</div>
                </div>

                <div style={{ background: 'rgba(7, 11, 20, 0.75)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                  <div style={{ fontSize: '0.68rem', color: '#34d399', fontWeight: 700 }}>ENTRADA / STOP LOSS</div>
                  <div className="font-mono" style={{ fontSize: '0.92rem', fontWeight: 800, color: '#fff', marginTop: '2px' }}>
                    ${sixMonthTechnicalSetup.entryZone.toFixed(2)} / <span style={{ color: '#f87171' }}>${sixMonthTechnicalSetup.stopLoss.toFixed(2)}</span>
                  </div>
                  <div style={{ fontSize: '0.66rem', color: '#94a3b8' }}>Riesgo: {sixMonthTechnicalSetup.stopLossPct}%</div>
                </div>

                <div style={{ background: 'rgba(7, 11, 20, 0.75)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.35)' }}>
                  <div style={{ fontSize: '0.68rem', color: '#34d399', fontWeight: 700 }}>TARGET 1 (BREAKEVEN) / T2</div>
                  <div className="font-mono" style={{ fontSize: '0.92rem', fontWeight: 800, color: '#34d399', marginTop: '2px' }}>
                    ${sixMonthTechnicalSetup.target1TrailingBreakeven.toFixed(2)} / ${sixMonthTechnicalSetup.target2Intrinsic.toFixed(2)}
                  </div>
                  <div style={{ fontSize: '0.66rem', color: '#94a3b8' }}>
                    Ratio R:R a T2: {sixMonthTechnicalSetup.riskRewardT2}:1
                  </div>
                </div>
              </div>
            </div>
          )}

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
                        : activeChart === 'volume'
                        ? 'Volumen Bursátil Negociado ($M USD)'
                        : activeChart === 'profit_m'
                        ? 'Margen Neto Trimestral (%) & Consenso'
                        : activeChart === 'fcf'
                        ? 'Flujo de Caja Libre Trimestral (FCF USD)'
                        : activeChart === 'rsi'
                        ? 'Oscilador Técnico RSI (14 Sesiones)'
                        : 'Evolución Histórica & Series Temporales'}
                    </h2>
                    {(activeChart === 'price' || activeChart === 'rsi' || activeChart === 'volume') && timeframeReturn !== null && (
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
                    {(activeChart === 'volume' || activeChart === 'profit_m' || activeChart === 'fcf') && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: 'var(--accent-green)',
                        border: '1px solid rgba(16, 185, 129, 0.3)'
                      }}>
                        {activeChart === 'volume' ? '📊 Columnas Diarias ($M USD)' : '📊 Columnas Trimestrales (SEC + Previsión)'}
                      </span>
                    )}
                    {activeChart === 'eps' && Math.abs(stock.eps_qq ?? 0) > 200 && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        background: 'rgba(245, 158, 11, 0.15)',
                        color: '#f59e0b',
                        border: '1px solid rgba(245, 158, 11, 0.3)'
                      }}>
                        ⚠️ % &gt; límite gráfico, ver análisis
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                    {activeChart === 'sales'
                      ? 'Columnas de ingresos en USD con % de crecimiento anual (YoY vs mismo periodo año anterior) y secuencial (QoQ vs periodo anterior) en eje secundario'
                      : activeChart === 'eps'
                      ? 'Columnas de BPA en USD con % de crecimiento anual (YoY vs mismo periodo año anterior) y secuencial (QoQ vs periodo anterior) en eje secundario'
                      : activeChart === 'volume'
                      ? 'Columnas verticales diarias de volumen negociado en Millones de Dólares ($M USD)'
                      : activeChart === 'profit_m'
                      ? 'Columnas verticales trimestrales de Margen de Utilidad Neta (%) — Histórico Informado vs Previsión'
                      : activeChart === 'fcf'
                      ? 'Columnas verticales trimestrales de Flujo de Caja Libre (FCF en USD) — Histórico Informado vs Previsión'
                      : loadingHistory
                      ? 'Cargando serie temporal...'
                      : `${chartData.length} sesiones bursátiles analizadas • Histórico disponible hasta 3 años`}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  
                  {/* Selector: Línea vs Velas Japonesas (solo aplica a Precio) */}
                  {activeChart === 'price' && (
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
                <div style={{ width: '100%', height: '375px' }}>
                  {/* Distintivo de auditoría y distinción entre Informado vs Previsión */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', padding: '0 6px', fontSize: '0.74rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#10b981', fontWeight: 600 }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                        {activeChart === 'sales' ? 'Ingresos Informados (Auditoría SEC)' : 'BPA Informado (Oficial Auditado)'}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#f59e0b', fontWeight: 600 }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b', border: '1px dashed #fff' }} />
                        {activeChart === 'sales' ? 'Ingresos Previsión (Consenso)' : 'BPA Previsión (Consenso Wall St)'}
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.70rem' }}>
                      Auditoría diaria (Hoy: {new Date().toISOString().slice(0, 10)})
                    </div>
                  </div>

                  <ResponsiveContainer width="100%" height="90%">
                    <ComposedChart data={quarterlyData} margin={{ top: 16, right: 10, left: -6, bottom: 20 }}>
                      <defs>
                        <linearGradient id="barGradientSales" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#059669" stopOpacity={0.7} />
                        </linearGradient>
                        <linearGradient id="barGradientSalesPrev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.85} />
                          <stop offset="100%" stopColor="#d97706" stopOpacity={0.45} />
                        </linearGradient>
                        <linearGradient id="barGradientEps" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.7} />
                        </linearGradient>
                        <linearGradient id="barGradientEpsPrev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.85} />
                          <stop offset="100%" stopColor="#0284c7" stopOpacity={0.45} />
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
                        width={62} 
                        tickLine={false} 
                        domain={activeChart === 'sales' ? [0, 'auto'] : [(dataMin: number) => Math.min(0, dataMin), (dataMax: number) => Math.max(0, dataMax)]}
                        tickFormatter={(val) => {
                          if (activeChart === 'sales') {
                            return formatTickB(val);
                          }
                          return `$ ${Number(val).toFixed(2).replace('.', ',')}`;
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
                          if (!p) return _label;
                          const isFuture = p.status === 'PREVISION';
                          const tag = isFuture ? '⏳ PREVISIÓN (Sin reportar)' : '✅ INFORMADO (Auditado SEC)';
                          return `${tag} • ${p.period} (Fecha: ${p.date})`;
                        }}
                        formatter={(value: any, name: any, item: any) => {
                          const num = Number(value);
                          if (isNaN(num)) return [value, name];
                          if (String(name).includes('Ingresos')) {
                            return [formatCurrencyB(num), name];
                          }
                          if (String(name).includes('BPA')) {
                            return [`$ ${num.toFixed(2).replace('.', ',')} USD`, name];
                          }
                          // Para YoY, mostrar el % real sin recalcular y si supera el límite visual del gráfico, agregar el distintivo solicitado
                          const p = item?.payload;
                          if (String(name).includes('YoY')) {
                            const realYoy = activeChart === 'sales' ? (p?.sales_yoy ?? num) : (p?.eps_yoy ?? num);
                            const isOver = Math.abs(realYoy) > 250;
                            const formattedVal = `${realYoy >= 0 ? '+' : ''}${realYoy.toFixed(2).replace('.', ',')}%`;
                            return [
                              isOver ? `${formattedVal} (% > límite gráfico, ver análisis)` : formattedVal,
                              name
                            ];
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
                        yAxisId="left" 
                        y={0} 
                        stroke="rgba(255,255,255,0.14)" 
                      />
                      <ReferenceLine 
                        yAxisId="right" 
                        y={0} 
                        stroke="rgba(255,255,255,0.2)" 
                        strokeDasharray="3 3" 
                      />

                      {/* 1. Barras (Columnas) en el Eje Principal Izquierdo (hija directa de ComposedChart para renderizado garantizado) */}
                      <Bar 
                        yAxisId="left" 
                        dataKey={activeChart === 'sales' ? 'sales' : 'eps'} 
                        name={activeChart === 'sales' ? 'Ingresos ($ USD)' : 'BPA / EPS ($ USD)'} 
                        radius={[4, 4, 0, 0]} 
                        maxBarSize={42} 
                      >
                        {quarterlyData.map((entry, idx) => {
                          const isForecast = entry.status === 'PREVISION';
                          const rawVal = activeChart === 'sales' ? entry.sales : entry.eps;
                          const isNeg = rawVal < 0;
                          const fill = isForecast
                            ? activeChart === 'sales'
                              ? 'url(#barGradientSalesPrev)'
                              : 'url(#barGradientEpsPrev)'
                            : isNeg
                            ? '#ef4444'
                            : activeChart === 'sales'
                            ? 'url(#barGradientSales)'
                            : 'url(#barGradientEps)';
                          const stroke = isForecast
                            ? activeChart === 'sales'
                              ? '#f59e0b'
                              : '#38bdf8'
                            : 'none';
                          return (
                            <Cell
                              key={`composed-bar-${idx}`}
                              fill={fill}
                              stroke={stroke}
                              strokeWidth={isForecast ? 1.5 : 0}
                              strokeDasharray={isForecast ? '3 3' : undefined}
                            />
                          );
                        })}
                      </Bar>

                      {/* 2. Línea 1 en Eje Secundario: % Crecimiento vs Año Anterior en el Mismo Periodo (YoY) */}
                      {/* Se traza acotado con sales_yoy_plot / eps_yoy_plot para mantener la escala del eje, mientras el tooltip y tarjetas muestran el % real */}
                      <Line 
                        yAxisId="right" 
                        type="monotone" 
                        dataKey={activeChart === 'sales' ? 'sales_yoy_plot' : 'eps_yoy_plot'} 
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
              ) : activeChart === 'volume' ? (
                /* Gráfico de Columnas (Barras Verticales) para Volumen $M USD */
                <div style={{ width: '100%', height: '340px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
                      <defs>
                        <linearGradient id="barVolumeCol" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.95} />
                          <stop offset="100%" stopColor="#b45309" stopOpacity={0.55} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="displayDate" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                      <YAxis
                        stroke="var(--text-muted)"
                        fontSize={11}
                        width={70}
                        tickLine={false}
                        domain={[0, 'auto']}
                        tickFormatter={(val) => {
                          const num = Number(val);
                          if (Math.abs(num) >= 1e3) return `$${(num / 1e3).toFixed(1)}B`;
                          return `$${num.toFixed(0)}M`;
                        }}
                      />
                      <Tooltip
                        contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', color: '#fff', fontSize: '0.8rem' }}
                        labelFormatter={(_label, payload) => {
                          const p = payload?.[0]?.payload;
                          if (!p) return _label;
                          if (p.reportLabel) return `${p.date} • 📅 ${p.reportLabel}`;
                          return p.date || _label;
                        }}
                        formatter={(value: any) => {
                          const num = Number(value);
                          if (isNaN(num)) return [value, 'Volumen ($M USD)'];
                          if (num >= 1e3) {
                            return [`$${(num / 1e3).toFixed(2)}B USD ($${num.toFixed(0)}M)`, 'Volumen Negociado ($M USD)'];
                          }
                          return [`$${num.toFixed(2)}M USD`, 'Volumen Negociado ($M USD)'];
                        }}
                      />
                      <Bar
                        dataKey="dollarVolume"
                        name="Volumen Negociado ($M USD)"
                        fill="url(#barVolumeCol)"
                        radius={[3, 3, 0, 0]}
                        maxBarSize={22}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (activeChart === 'profit_m' || activeChart === 'fcf') ? (
                /* Gráfico de Columnas (Barras Verticales) Trimestrales para Margen Neto % y FCF $ */
                <div style={{ width: '100%', height: '365px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', padding: '0 6px', fontSize: '0.74rem', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: activeChart === 'profit_m' ? '#c084fc' : '#10b981', fontWeight: 600 }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: activeChart === 'profit_m' ? '#a855f7' : '#10b981' }} />
                        {activeChart === 'profit_m' ? 'Margen Neto Informado (%)' : 'FCF Informado (SEC USD)'}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#f59e0b', fontWeight: 600 }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b', border: '1px dashed #fff' }} />
                        Previsión (Consenso)
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#ef4444', fontWeight: 600 }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} />
                        Negativo
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.70rem' }}>
                      {activeChart === 'fcf' && officialFinancials?.secAnnualFCF != null ? 'Respaldo SEC XBRL + Consenso' : 'Serie Trimestral'}
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height="88%">
                    <BarChart data={quarterlyData} margin={{ top: 12, right: 12, left: 4, bottom: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis dataKey="quarterLabel" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                      <YAxis
                        stroke="var(--text-muted)"
                        fontSize={11}
                        width={activeChart === 'fcf' ? 72 : 56}
                        tickLine={false}
                        domain={[(dataMin: number) => Math.min(0, dataMin), (dataMax: number) => Math.max(0, dataMax)]}
                        tickFormatter={(val) => {
                          const num = Number(val);
                          if (activeChart === 'profit_m') return `${num > 0 ? '+' : ''}${num.toFixed(1)}%`;
                          return formatTickB(num);
                        }}
                      />
                      <ReferenceLine y={0} stroke="rgba(255,255,255,0.22)" strokeDasharray="3 3" />
                      <Tooltip
                        contentStyle={{ background: 'rgba(15, 23, 42, 0.96)', border: '1px solid #1e293b', borderRadius: '10px', color: '#fff', fontSize: '0.8rem' }}
                        labelFormatter={(_label, payload) => {
                          const p = payload?.[0]?.payload;
                          if (!p) return _label;
                          const tag = p.status === 'PREVISION' ? '⏳ PREVISIÓN (Sin reportar)' : '✅ INFORMADO (Auditado)';
                          return `${tag} • ${p.period} (${p.date})`;
                        }}
                        formatter={(value: any, _name: any, item: any) => {
                          const num = Number(value);
                          if (isNaN(num)) return [value, _name];
                          if (activeChart === 'profit_m') {
                            return [`${num >= 0 ? '+' : ''}${num.toFixed(2)}%`, 'Margen Neto (%)'];
                          }
                          const isAudited = Boolean(item?.payload?.isFcfAudited);
                          return [formatCurrencyB(num), `Flujo de Caja Libre (FCF)${isAudited ? ' • SEC Auditado' : ''}`];
                        }}
                      />
                      <Bar
                        dataKey={activeChart}
                        name={activeChart === 'profit_m' ? 'Margen Neto (%)' : 'Flujo de Caja Libre (FCF $)'}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={42}
                      >
                        {quarterlyData.map((entry, idx) => {
                          const val = activeChart === 'profit_m' ? entry.profit_m : entry.fcf;
                          const isForecast = entry.status === 'PREVISION';
                          const fill = isForecast
                            ? '#f59e0b'
                            : val < 0
                            ? '#ef4444'
                            : activeChart === 'profit_m'
                            ? '#a855f7'
                            : '#10b981';
                          return (
                            <Cell
                              key={`qcol-${activeChart}-${idx}`}
                              fill={fill}
                              fillOpacity={isForecast ? 0.78 : 0.92}
                              stroke={isForecast ? '#fbbf24' : 'none'}
                              strokeWidth={isForecast ? 1.2 : 0}
                            />
                          );
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                /* Gráfico de Área Continua para Precio y RSI */
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
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="displayDate" stroke="var(--text-muted)" fontSize={11} />
                      <YAxis 
                        stroke="var(--text-muted)" 
                        fontSize={11} 
                        width={55}
                        domain={activeChart === 'rsi' ? [0, 100] : ['auto', 'auto']} 
                        tickFormatter={(val) => {
                          if (activeChart === 'price') {
                            return `$${val}`;
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
                          if (activeChart === 'price') {
                            return [`$${num.toFixed(2)} USD`, 'Precio'];
                          }
                          if (activeChart === 'rsi') {
                            return [`${num.toFixed(2)} pts`, 'RSI (14)'];
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
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}

        </div>

      {/* Apartado de Análisis Técnico: Variabilidad de Precio (Serie Dinámica por Temporalidad) & Divergencia Precio vs RSI */}
      <div className="glass-panel" style={{ padding: '26px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BarChart2 size={22} color="var(--accent-cyan)" />
            <div>
              <h2 style={{ fontSize: '1.22rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                Análisis Técnico: Variabilidad de Precio &amp; Divergencia RSI (14)
              </h2>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Serie histórica de variaciones % del precio según temporalidad seleccionada (4H, 1D, 3D, 1S, 1M) y lectura de máximos/mínimos Precio vs. RSI (14)
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {stock.rsi !== undefined && stock.rsi !== null && (
              <span style={{
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 700,
                background: stock.rsi >= 70 ? 'rgba(239, 68, 68, 0.14)' : stock.rsi <= 30 ? 'rgba(16, 185, 129, 0.14)' : 'rgba(6, 182, 212, 0.12)',
                color: stock.rsi >= 70 ? '#ef4444' : stock.rsi <= 30 ? '#10b981' : '#38bdf8',
                border: '1px solid rgba(255,255,255,0.08)'
              }}>
                RSI (14) Actual: {stock.rsi.toFixed(1)} pts
              </span>
            )}
            <span style={{
              padding: '4px 10px',
              borderRadius: '8px',
              fontSize: '0.78rem',
              fontWeight: 700,
              background: 'rgba(15, 23, 42, 0.75)',
              color: divergenceAnalysis.directionColor,
              border: `1px solid ${divergenceAnalysis.directionColor}`
            }}>
              {divergenceAnalysis.classification} • Grado {divergenceAnalysis.degreePct}%
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 'var(--grid-gap, 20px)' }}>
          {/* Sub-panel 1: Serie Histórica de Variabilidad del Precio con Filtro de Temporalidad */}
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: 'var(--card-pad, 18px)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', gap: '10px', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: '0.94rem', color: '#fff' }}>
                Variabilidad del Precio ({variabilityTimeframe}) a lo largo del tiempo
              </strong>
              <div style={{ display: 'flex', gap: '4px', background: 'rgba(2, 6, 23, 0.55)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                {(['4H', '1D', '3D', '1S', '1M'] as VariabilityTimeframe[]).map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    className={`btn ${variabilityTimeframe === tf ? 'btn-active' : 'btn-secondary'}`}
                    style={{ padding: '3px 9px', fontSize: '0.72rem', fontWeight: 700 }}
                    onClick={() => setVariabilityTimeframe(tf)}
                    title={`Ver serie de variabilidad porcentual en temporalidad ${tf}`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '10px', gap: '8px', flexWrap: 'wrap' }}>
              <span>{variabilityData.timelineLabel}</span>
              <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{variabilityData.sourceLabel}</span>
            </div>

            <div style={{ width: '100%', height: '240px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={variabilityData.points} margin={{ top: 14, right: 10, left: -8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="var(--text-muted)"
                    fontSize={10}
                    tickLine={false}
                    minTickGap={18}
                  />
                  <YAxis
                    stroke="var(--text-muted)"
                    fontSize={11}
                    width={52}
                    tickLine={false}
                    domain={[(dataMin: number) => Math.min(-1, dataMin * 1.15), (dataMax: number) => Math.max(1, dataMax * 1.15)]}
                    tickFormatter={(v) => `${Number(v) > 0 ? '+' : ''}${Number(v).toFixed(1)}%`}
                  />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.28)" />
                  <Tooltip
                    contentStyle={{ background: 'rgba(15, 23, 42, 0.96)', border: '1px solid #1e293b', borderRadius: '10px', color: '#fff', fontSize: '0.78rem' }}
                    labelFormatter={(_label, payload) => {
                      const p = payload?.[0]?.payload as VariabilitySeriesPoint | undefined;
                      if (!p) return String(_label);
                      return `${p.periodDesc} • $${p.prevClose.toFixed(2)} → $${p.close.toFixed(2)}`;
                    }}
                    formatter={(value: any, _name: any, item: any) => {
                      const pct = Number(value);
                      const p = item?.payload as VariabilitySeriesPoint | undefined;
                      const usdStr = p ? ` (${p.changeUsd >= 0 ? '+$' : '-$'}${Math.abs(p.changeUsd).toFixed(2)} USD)` : '';
                      return [`${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%${usdStr}`, `Variación ${variabilityTimeframe}`];
                    }}
                  />
                  <Bar dataKey="changePct" name={`% Variación (${variabilityTimeframe})`} radius={[3, 3, 0, 0]} maxBarSize={22}>
                    {variabilityData.points.map((pt, idx) => (
                      <Cell
                        key={`var-col-${variabilityTimeframe}-${idx}`}
                        fill={pt.changePct >= 0 ? '#10b981' : '#ef4444'}
                        fillOpacity={0.9}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px', marginTop: '12px' }}>
              <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '8px 10px' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                  Último ({variabilityTimeframe}) • {variabilityData.lastPoint?.label || '-'}
                </div>
                <div
                  className="font-mono"
                  style={{
                    fontSize: '0.9rem',
                    fontWeight: 800,
                    marginTop: '3px',
                    color: (variabilityData.lastPoint?.changePct ?? 0) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'
                  }}
                >
                  {variabilityData.lastPoint ? `${variabilityData.lastPoint.changePct >= 0 ? '+' : ''}${variabilityData.lastPoint.changePct.toFixed(2)}%` : '-'}
                </div>
                <div className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                  {variabilityData.lastPoint ? `${variabilityData.lastPoint.changeUsd >= 0 ? '+$' : '-$'}${Math.abs(variabilityData.lastPoint.changeUsd).toFixed(2)} USD` : '-'}
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '8px 10px' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700 }}>Volatilidad Media</div>
                <div className="font-mono" style={{ fontSize: '0.9rem', fontWeight: 800, marginTop: '3px', color: 'var(--accent-cyan)' }}>
                  ±{variabilityData.avgAbsPct.toFixed(2)}%
                </div>
                <div className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                  σ = {variabilityData.stdDevPct.toFixed(2)}%
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '8px 10px' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700 }}>Extremos ({variabilityTimeframe})</div>
                <div className="font-mono" style={{ fontSize: '0.78rem', fontWeight: 800, marginTop: '3px', color: 'var(--accent-green)' }}>
                  {variabilityData.maxGain ? `+${variabilityData.maxGain.changePct.toFixed(1)}% (${variabilityData.maxGain.label})` : '-'}
                </div>
                <div className="font-mono" style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--accent-red)' }}>
                  {variabilityData.maxDrop ? `${variabilityData.maxDrop.changePct.toFixed(1)}% (${variabilityData.maxDrop.label})` : '-'}
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '8px 10px' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700 }}>Períodos Alcistas</div>
                <div className="font-mono" style={{ fontSize: '0.9rem', fontWeight: 800, marginTop: '3px', color: '#fff' }}>
                  {variabilityData.positiveCount} / {variabilityData.points.length}
                </div>
                <div className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                  {variabilityData.points.length > 0
                    ? `${Math.round((variabilityData.positiveCount / variabilityData.points.length) * 100)}% positivos`
                    : 'Sin datos'}
                </div>
              </div>
            </div>
          </div>

          {/* Sub-panel 2: Grado de Divergencia Precio (Máximos/Mínimos) vs RSI con Fechas Exactas */}
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '14px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <GitCompare size={18} color={divergenceAnalysis.directionColor} />
                  <strong style={{ fontSize: '0.94rem', color: '#fff' }}>
                    Divergencia Precio vs. RSI ({divergenceAnalysis.windowSessions} sesiones diarias)
                  </strong>
                </div>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: 'rgba(255,255,255,0.05)',
                  color: divergenceAnalysis.directionColor
                }}>
                  Severidad: {divergenceAnalysis.severity}
                </span>
              </div>

              <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.45 }}>
                Temporalidad: <strong style={{ color: 'var(--text-secondary)' }}>Diaria (1D)</strong> · RSI(14) Wilder · Ventana: <strong style={{ color: 'var(--text-secondary)' }}>{divergenceAnalysis.periodStartDate} → {divergenceAnalysis.periodEndDate}</strong> (Ciclo 1 vs Ciclo 2: ~{Math.floor(divergenceAnalysis.windowSessions / 2)} sesiones c/u)
              </div>

              {/* Indicador Cuantitativo de Grado de Divergencia (0% - 100%) */}
              <div style={{
                background: 'rgba(2, 6, 23, 0.45)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '10px',
                padding: '12px 14px',
                marginBottom: '14px'
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    Grado de Divergencia Detectado:
                  </span>
                  <span className="font-mono" style={{ fontSize: '1.35rem', fontWeight: 900, color: divergenceAnalysis.directionColor }}>
                    {divergenceAnalysis.degreePct}%
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(100, Math.max(4, divergenceAnalysis.degreePct))}%`,
                    height: '100%',
                    background: divergenceAnalysis.directionColor,
                    borderRadius: '999px',
                    transition: 'width 0.4s ease'
                  }} />
                </div>
                <div style={{ fontSize: '0.76rem', color: divergenceAnalysis.directionColor, fontWeight: 700, marginTop: '6px' }}>
                  {divergenceAnalysis.classification}
                </div>
              </div>

              {/* Comparativa de Máximos y Mínimos: Precio vs RSI con fechas exactas */}
              {divergenceAnalysis.hasEnoughData ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '10px' }}>
                  {/* Máximos */}
                  <div style={{
                    background: divergenceAnalysis.highs.isDivergent ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255,255,255,0.025)',
                    border: divergenceAnalysis.highs.isDivergent ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    fontSize: '0.75rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <strong style={{ color: '#fff' }}>Máximos (Highs)</strong>
                      <span style={{ color: divergenceAnalysis.highs.isDivergent ? '#ef4444' : 'var(--accent-green)', fontWeight: 700, fontSize: '0.7rem' }}>
                        {divergenceAnalysis.highs.isDivergent ? 'Divergente' : 'Confirmado'}
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                      <div>
                        Precio: <strong className="font-mono" style={{ color: '#fff' }}>${divergenceAnalysis.highs.prevPrice.toFixed(2)}</strong>{' '}
                        <span style={{ fontSize: '0.67rem', color: 'var(--text-muted)' }}>({divergenceAnalysis.highs.prevDate})</span> →{' '}
                        <strong className="font-mono" style={{ color: '#fff' }}>${divergenceAnalysis.highs.recentPrice.toFixed(2)}</strong>{' '}
                        <span style={{ fontSize: '0.67rem', color: 'var(--text-muted)' }}>({divergenceAnalysis.highs.recentDate})</span>{' '}
                        <span className="font-mono" style={{ color: divergenceAnalysis.highs.priceDeltaPct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 700 }}>
                          ({divergenceAnalysis.highs.priceDeltaPct >= 0 ? '+' : ''}{divergenceAnalysis.highs.priceDeltaPct.toFixed(1)}%)
                        </span>
                      </div>
                      <div style={{ marginTop: '4px' }}>
                        RSI (14): <strong className="font-mono" style={{ color: '#38bdf8' }}>{divergenceAnalysis.highs.prevRsi.toFixed(1)}</strong>{' '}
                        <span style={{ fontSize: '0.67rem', color: 'var(--text-muted)' }}>({divergenceAnalysis.highs.prevRsiDate})</span> →{' '}
                        <strong className="font-mono" style={{ color: '#38bdf8' }}>{divergenceAnalysis.highs.recentRsi.toFixed(1)}</strong>{' '}
                        <span style={{ fontSize: '0.67rem', color: 'var(--text-muted)' }}>({divergenceAnalysis.highs.recentRsiDate})</span>{' '}
                        <span className="font-mono" style={{ color: '#38bdf8', fontWeight: 700 }}>
                          ({divergenceAnalysis.highs.rsiDeltaPts >= 0 ? '+' : ''}{divergenceAnalysis.highs.rsiDeltaPts.toFixed(1)} pts)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Mínimos */}
                  <div style={{
                    background: divergenceAnalysis.lows.isDivergent ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255,255,255,0.025)',
                    border: divergenceAnalysis.lows.isDivergent ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    fontSize: '0.75rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <strong style={{ color: '#fff' }}>Mínimos (Lows)</strong>
                      <span style={{ color: divergenceAnalysis.lows.isDivergent ? '#10b981' : 'var(--text-secondary)', fontWeight: 700, fontSize: '0.7rem' }}>
                        {divergenceAnalysis.lows.isDivergent ? 'Divergente' : 'Confirmado'}
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                      <div>
                        Precio: <strong className="font-mono" style={{ color: '#fff' }}>${divergenceAnalysis.lows.prevPrice.toFixed(2)}</strong>{' '}
                        <span style={{ fontSize: '0.67rem', color: 'var(--text-muted)' }}>({divergenceAnalysis.lows.prevDate})</span> →{' '}
                        <strong className="font-mono" style={{ color: '#fff' }}>${divergenceAnalysis.lows.recentPrice.toFixed(2)}</strong>{' '}
                        <span style={{ fontSize: '0.67rem', color: 'var(--text-muted)' }}>({divergenceAnalysis.lows.recentDate})</span>{' '}
                        <span className="font-mono" style={{ color: divergenceAnalysis.lows.priceDeltaPct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 700 }}>
                          ({divergenceAnalysis.lows.priceDeltaPct >= 0 ? '+' : ''}{divergenceAnalysis.lows.priceDeltaPct.toFixed(1)}%)
                        </span>
                      </div>
                      <div style={{ marginTop: '4px' }}>
                        RSI (14): <strong className="font-mono" style={{ color: '#38bdf8' }}>{divergenceAnalysis.lows.prevRsi.toFixed(1)}</strong>{' '}
                        <span style={{ fontSize: '0.67rem', color: 'var(--text-muted)' }}>({divergenceAnalysis.lows.prevRsiDate})</span> →{' '}
                        <strong className="font-mono" style={{ color: '#38bdf8' }}>{divergenceAnalysis.lows.recentRsi.toFixed(1)}</strong>{' '}
                        <span style={{ fontSize: '0.67rem', color: 'var(--text-muted)' }}>({divergenceAnalysis.lows.recentRsiDate})</span>{' '}
                        <span className="font-mono" style={{ color: '#38bdf8', fontWeight: 700 }}>
                          ({divergenceAnalysis.lows.rsiDeltaPts >= 0 ? '+' : ''}{divergenceAnalysis.lows.rsiDeltaPts.toFixed(1)} pts)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Cargando suficientes sesiones históricas (mínimo 12 sesiones diarias) para comparar máximos y mínimos frente al RSI (14).
                </div>
              )}
            </div>

            {/* Diagnóstico técnico */}
            <div style={{
              background: 'rgba(6, 182, 212, 0.06)',
              borderLeft: `3px solid ${divergenceAnalysis.directionColor}`,
              borderRadius: '6px',
              padding: '10px 12px',
              fontSize: '0.79rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5
            }}>
              {divergenceAnalysis.diagnosis}
            </div>
          </div>
        </div>
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 290px), 1fr))', 
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
        <div className="modal-overlay-responsive" style={{ zIndex: 1000 }}>
          <div className="glass-panel modal-sheet-responsive" style={{
            maxWidth: '520px',
            width: '100%',
            padding: 'clamp(18px, 3vw, 28px)',
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

            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.5 }}>
              Define un nivel de precio objetivo para <strong>{stock.ticker}</strong>. Cuando la cotización cruce la línea trazada, recibirás una alerta sonora y visual en plataforma y se enviará una notificación institucional a tu correo registrado con la presentación de <strong>Inversor Colombia</strong>.
            </div>

            {/* Correo de destino registrado */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              padding: '8px 12px',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.28)',
              borderRadius: '8px',
              marginBottom: '14px',
              fontSize: '0.78rem'
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#34d399', fontWeight: 600 }}>
                <Mail size={14} /> Correo destino:
              </span>
              <strong style={{ color: '#fff', wordBreak: 'break-all' }}>
                {user?.email || 'Sesión sin correo verificado'}
              </strong>
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: '10px' }}>
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
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={sendingTestEmail}
                onClick={handlePreviewOrTestAlertEmail}
                style={{ fontSize: '0.78rem', gap: '6px', borderColor: 'rgba(6, 182, 212, 0.35)', color: '#38bdf8' }}
                title="Visualiza el formato HTML institucional con logo de Inversor Colombia y prueba el envío al correo registrado"
              >
                <Mail size={14} /> {sendingTestEmail ? 'Enviando...' : '📩 Ver/Probar Correo'}
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 265px), 1fr))', gap: 'var(--grid-gap, 20px)', marginBottom: '28px' }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Crecimiento EPS (QoQ):</span>
              <strong className="font-mono" style={{ color: stock.eps_qq && stock.eps_qq > 0 ? 'var(--accent-green)' : (stock.eps_qq ? 'var(--accent-red)' : 'var(--text-muted)') }}>
                {stock.eps_qq !== undefined && stock.eps_qq !== null ? `${stock.eps_qq.toFixed(2)}%` : 'Sin dato SEC'}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Crecimiento Ventas (QoQ):</span>
              <strong className="font-mono">{stock.sales_qq !== undefined && stock.sales_qq !== null ? `${stock.sales_qq.toFixed(2)}%` : 'Sin dato SEC'}</strong>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Próximo Reporte:</span>
              <strong className="font-mono" style={{ color: 'var(--accent-cyan)' }}>
                {calculateNextEarningsDate(stock.earnings_date)}
              </strong>
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
      <ErrorBoundary fallbackTitle={`Error al cargar el análisis institucional de ${stock.ticker}`}>
        <StockAIAnalysisPanel stock={stock} allStocks={allStocks} officialFinancials={officialFinancials} />
      </ErrorBoundary>

      {/* 5. Radar Multimedia: Noticias Gratuitas, Comunidad en X y Videos de YouTube */}
      <div id="radar-multimedia">
        <SectorNewsRadar 
          ticker={stock.ticker} 
          company={stock.company} 
          sector={stock.sector} 
          industry={stock.industry} 
        />
      </div>

      {/* Modal para Agregar Posición Real a Mi Cartera */}
      <AddPositionModal
        isOpen={showAddPositionModal}
        onClose={() => setShowAddPositionModal(false)}
        stock={stock}
      />

      {/* Modal para Agregar a Listas de Seguimiento */}
      <AddToWatchlistModal
        isOpen={showAddToWatchlistModal}
        onClose={() => setShowAddToWatchlistModal(false)}
        stock={stock}
        onSuccess={() => onToggleWatchlist(stock.ticker)}
      />

      {/* Modal: Vista Previa / Confirmación del Correo de Alerta Institucional */}
      {showEmailPreviewModal && lastAlertEmailPreview && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{
            maxWidth: '680px',
            width: '100%',
            padding: '22px',
            borderRadius: '16px',
            background: '#0b1120',
            border: '1px solid var(--border-medium)',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <Mail size={20} color="#38bdf8" />
                <h3 style={{ fontSize: '1.08rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                  Notificación por Correo — Inversor Colombia
                </h3>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: lastAlertEmailPreview.delivered ? 'rgba(16, 185, 129, 0.16)' : 'rgba(245, 158, 11, 0.16)',
                  color: lastAlertEmailPreview.delivered ? '#34d399' : '#fbbf24',
                  border: lastAlertEmailPreview.delivered ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)'
                }}>
                  {lastAlertEmailPreview.delivered ? `Enviado (${lastAlertEmailPreview.provider})` : 'Vista Previa de Plantilla'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowEmailPreviewModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                title="Cerrar vista previa"
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '4px', background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: '8px' }}>
              <div><strong style={{ color: '#fff' }}>Para:</strong> {lastAlertEmailPreview.recipient}</div>
              <div><strong style={{ color: '#fff' }}>Asunto:</strong> {lastAlertEmailPreview.subject}</div>
              {!lastAlertEmailPreview.delivered && lastAlertEmailPreview.message && (
                <div style={{ color: '#fbbf24', fontSize: '0.74rem' }}>
                  Nota de despacho: {lastAlertEmailPreview.message}
                </div>
              )}
            </div>

            <iframe
              title="Vista previa del correo de alerta de Inversor Colombia"
              srcDoc={lastAlertEmailPreview.htmlBody}
              sandbox=""
              style={{
                width: '100%',
                height: '480px',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                background: '#070b14'
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowEmailPreviewModal(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
