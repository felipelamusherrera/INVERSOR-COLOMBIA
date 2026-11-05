export interface StockRecord {
  ticker: string;
  snapshot_date: string;
  company: string;
  sector?: string;
  industry?: string;
  country?: string;
  ipo_date?: string;
  index_name?: string;
  asset_type?: string;

  // Valuation
  market_cap?: number;
  enterprise_value?: number;
  price?: number;
  pe?: number;
  forward_pe?: number;
  peg?: number;
  ps?: number;
  ev_ebitda?: number;
  ev_sales?: number;

  // EPS, Sales & Growth
  eps?: number;
  eps_this_y?: number;
  eps_next_y?: number;
  eps_past_5y?: number;
  eps_next_5y?: number;
  sales_past_5y?: number;
  eps_qq?: number;
  sales_qq?: number;
  eps_next_q?: number;
  income?: number;
  sales?: number;
  eps_surprise?: number;
  revenue_surprise?: number;
  eps_yoy_ttm?: number;
  sales_yoy_ttm?: number;
  eps_past_3y?: number;

  // Margins & Profitability
  gross_m?: number;
  oper_m?: number;
  profit_m?: number;
  roa?: number;
  roe?: number;
  roic?: number;
  curr_r?: number;
  quick_r?: number;
  lt_debt_eq?: number;
  debt_eq?: number;
  cash_sh?: number;

  // Dividends
  dividend?: number;
  dividend_gr_1y?: number;
  dividend_gr_3y?: number;

  // Shares & Short interest
  outstanding?: number;
  float_shares?: number;
  insider_own?: number;
  inst_own?: number;
  inst_trans?: number;
  short_float?: number;
  short_ratio?: number;
  short_interest?: number;

  // Pricing & Performance
  change_pct?: number;
  volume?: number;
  avg_volume?: number;
  rel_volume?: number;
  prev_close?: number;
  open?: number;
  high?: number;
  low?: number;
  change_from_open_pct?: number;
  gap_pct?: number;
  w52_range?: string;
  w52_high?: number;
  w52_low?: number;
  all_time_high?: number;
  all_time_low?: number;
  beta?: number;
  atr?: number;
  volatility_w?: number;
  volatility_m?: number;
  sma20?: number;
  sma50?: number;
  sma200?: number;
  d50_high?: number;
  d50_low?: number;
  rsi?: number;

  // Temporal performance
  perf_week?: number;
  perf_month?: number;
  perf_quart?: number;
  perf_half?: number;
  perf_year?: number;
  perf_ytd?: number;
  perf_3y?: number;
  perf_5y?: number;
  perf_10y?: number;

  // Analyst consensus & news
  recom?: number;
  target_price?: number;
  earnings_date?: string;
  news_url?: string;
  news_title?: string;
  daily_digest?: string;

  // ETFs
  single_category?: string;
  tags?: string;
  expense?: number;
  holdings?: number;
  aum?: number;
  return_1y?: number;
  return_3y?: number;
  return_5y?: number;

  updated_at?: string;
}

export type GradeLetter = 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D+' | 'D' | 'D-' | 'F';

export interface FactorGradeItem {
  name: string;
  grade: GradeLetter;
  score: number; // 1.0 to 5.0
  description: string;
  metrics: { label: string; value: string | number; evaluation: string }[];
}

export interface StockFactorAnalysis {
  quantScore: number; // 1.00 to 5.00
  quantRating: 'Fuerte Compra' | 'Compra' | 'Mantener' | 'Venta' | 'Fuerte Venta';
  grades: {
    valuation: FactorGradeItem;
    growth: FactorGradeItem;
    profitability: FactorGradeItem;
    solvency: FactorGradeItem;
    momentum: FactorGradeItem;
  };
}

export interface HistoricalPriceRecord {
  ticker: string;
  price_date: string;
  open_price?: number;
  high_price?: number;
  low_price?: number;
  close_price: number;
  volume?: number;
  rsi?: number;
  change_pct?: number;
}

