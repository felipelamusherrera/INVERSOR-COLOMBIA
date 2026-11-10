import type { StockRecord } from './stock';

export type AgentIntentType =
  | 'stock_diagnosis'
  | 'peer_comparison'
  | 'technical_chart'
  | 'swot_moat'
  | 'portfolio_audit'
  | 'screener_query'
  | 'general_market';

export interface AgentPortfolioPositionInput {
  ticker: string;
  company: string;
  sector: string;
  type: 'LONG' | 'SHORT';
  shares: number;
  avgEntryPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
}

export interface AgentPortfolioSnapshot {
  positions: AgentPortfolioPositionInput[];
  cashAvailable: number;
  totalValue: number;
}

export interface AgentConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  intent?: AgentIntentType;
  modelUsed?: string;
  dataSources?: string[];
  suggestedFollowUps?: AgentQuickAction[];
  screenerFilterPayload?: Record<string, string>;
  screenerUIFilters?: ScreenerUIFilterPayload;
}

export interface AgentQuickAction {
  label: string;
  prompt: string;
  intent: AgentIntentType;
}

export interface AgentChatRequest {
  message: string;
  activeTicker?: string;
  activeTab?: string;
  intent?: AgentIntentType;
  includePortfolio?: boolean;
  portfolioSnapshot?: AgentPortfolioSnapshot;
  conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
}

export interface AgentSectorBenchmark {
  sector: string;
  etfTicker: string;
  etfName: string;
  avgPe: number;
  avgForwardPe: number;
  avgRoic: number;
  avgProfitMargin: number;
  avgSalesGrowth: number;
  stockCount: number;
}

export interface AgentTechnicalSetup {
  ticker: string;
  currentPrice: number;
  sma50Real: number;
  sma200Real: number;
  athPrice: number;
  athDistancePct: number;
  rsi: number;
  rvol: number;
  closingRangePct: number;
  trendStatus: 'ALCISTA INSTITUCIONAL' | 'RECUPERACIÓN EN SOPORTE' | 'CONSOLIDACIÓN LATERAL' | 'CORRECCIÓN TÉCNICA';
  entryZone: number;
  stopLoss: number;
  stopLossPct: number;
  target1TrailingBreakeven: number;
  target1Pct: number;
  target2Intrinsic: number;
  target2Pct: number;
  riskRewardT1: number;
  riskRewardT2: number;
  // Fase 3: Análisis de serie de velas de 6 meses (OHLCV)
  candlesAnalyzedCount: number;
  sixMonthHigh: number;
  sixMonthLow: number;
  support20D: number;
  resistance20D: number;
  realAtr14: number;
  volumeAccumulationRatio: number;
  detectedChartPattern: string;
}

export interface ScreenerUIFilterPayload {
  sectorFilter?: string;
  marketCapFilter?: string;
  peFilter?: string;
  forwardPeFilter?: string;
  pegFilter?: string;
  roicFilter?: string;
  profitMarginFilter?: string;
  debtEquityFilter?: string;
  currentRatioFilter?: string;
  salesGrowthTtmFilter?: string;
  epsGrowthQtrFilter?: string;
  rsiFilter?: string;
  sma50Filter?: string;
  sma200Filter?: string;
  presetFilter?: string;
  tickerQuery?: string;
  summaryText?: string;
}

export interface AgentRAGContext {
  detectedTickers: string[];
  primaryStock: StockRecord | null;
  rivalStocks: StockRecord[];
  sectorBenchmark: AgentSectorBenchmark | null;
  technicalSetup: AgentTechnicalSetup | null;
  screenerMatches: StockRecord[];
  screenerAppliedFilters?: Record<string, string>;
  screenerUIFilters?: ScreenerUIFilterPayload;
  portfolioSnapshot?: AgentPortfolioSnapshot;
  snapshotDate: string;
}

export interface AgentChatResponse {
  reply: string;
  intentDetected: AgentIntentType;
  modelUsed: string;
  dataSources: string[];
  ragContextSummary: {
    tickersAnalyzed: string[];
    metricsCount: number;
    sectorBenchmark?: string;
    snapshotDate: string;
  };
  suggestedFollowUps: AgentQuickAction[];
  screenerFilterPayload?: Record<string, string>;
  screenerUIFilters?: ScreenerUIFilterPayload;
  timestamp: string;
}
