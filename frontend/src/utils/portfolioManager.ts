/**
 * Gestor Centralizado de Posiciones de Mi Cartera (Portfolio Positions)
 * Permite registrar operaciones LONG/SHORT desde el Screener, el Módulo de Análisis o Cartera.
 */

export interface PortfolioPosition {
  id: string;
  ticker: string;
  direction: 'LONG' | 'SHORT';
  shares: number;
  entryPrice: number;
  entryDate: string; // 'YYYY-MM-DD'
  notes?: string;
  stopLoss?: number;
  target1?: number;
  target2?: number;
  convictionTier?: string;
}

const STORAGE_KEY = 'inversor_colombia_portfolio_positions';

const DEFAULT_POSITIONS: PortfolioPosition[] = [
  { id: 'pos-1', ticker: 'NVDA', direction: 'LONG', shares: 10, entryPrice: 186.64, entryDate: '2026-08-15' },
  { id: 'pos-2', ticker: 'NVDA', direction: 'LONG', shares: 15, entryPrice: 112.50, entryDate: '2026-09-10' },
  { id: 'pos-3', ticker: 'AAPL', direction: 'LONG', shares: 10, entryPrice: 218.00, entryDate: '2026-09-01' },
  { id: 'pos-4', ticker: 'MU', direction: 'LONG', shares: 25, entryPrice: 94.20, entryDate: '2026-09-20' },
];

export function getPortfolioPositions(): PortfolioPosition[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_POSITIONS));
    return DEFAULT_POSITIONS;
  } catch (err) {
    console.error('Error reading portfolio positions:', err);
    return DEFAULT_POSITIONS;
  }
}

export function savePortfolioPositions(positions: PortfolioPosition[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
    window.dispatchEvent(new Event('portfolio_positions_updated'));
  } catch (err) {
    console.error('Error saving portfolio positions:', err);
  }
}

export function addPortfolioPosition(pos: Omit<PortfolioPosition, 'id'>): PortfolioPosition {
  const positions = getPortfolioPositions();
  const newPosition: PortfolioPosition = {
    ...pos,
    id: `pos-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ticker: pos.ticker.toUpperCase().trim(),
  };

  positions.unshift(newPosition);
  savePortfolioPositions(positions);
  return newPosition;
}

export function deletePortfolioPosition(id: string): void {
  const positions = getPortfolioPositions().filter((p) => p.id !== id);
  savePortfolioPositions(positions);
}

