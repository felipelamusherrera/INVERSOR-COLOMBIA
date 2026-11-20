export type RiskSizingMode = 'stop_risk' | 'capital_alloc';

export interface RiskSimConfig {
  capital: number;
  riskPct: number;
  sizingMode: RiskSizingMode;
}

export interface PositionSimResult {
  capital: number;
  riskPct: number;
  sizingMode: RiskSizingMode;
  entryPrice: number;
  stopLossPrice: number;
  target1Price: number;
  target2Price: number;
  positionUsd: number;
  positionCapPct: number;
  shares: number;
  cappedByCapital: boolean;
  riskAtStopUsd: number;
  riskAtStopCapPct: number;
  gainT1Usd: number;
  gainT1CapPct: number;
  gainT2Usd: number;
  gainT2CapPct: number;
  gainTrailing5050Usd: number;
  gainTrailing5050CapPct: number;
  rrT1: number;
  rrT2: number;
}

export const RISK_SIM_STORAGE_KEY = 'inversor_colombia_risk_sim_v1';
export const RISK_SIM_UPDATED_EVENT = 'inversor-risk-sim-updated';

export const DEFAULT_RISK_SIM: RiskSimConfig = {
  capital: 1500,
  riskPct: 2,
  sizingMode: 'stop_risk',
};

function round2(n: number): number {
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function round3(n: number): number {
  return Number.isFinite(n) ? Number(n.toFixed(3)) : 0;
}

export function sanitizeRiskSimConfig(raw: any): RiskSimConfig {
  const capNum = Number(raw?.capital);
  const riskNum = Number(raw?.riskPct);
  const mode: RiskSizingMode = raw?.sizingMode === 'capital_alloc' ? 'capital_alloc' : 'stop_risk';

  const capital = Number.isFinite(capNum) && capNum >= 10 ? round2(capNum) : DEFAULT_RISK_SIM.capital;
  const riskPct =
    Number.isFinite(riskNum) && riskNum >= 0.1
      ? round2(Math.min(100, riskNum))
      : DEFAULT_RISK_SIM.riskPct;

  return { capital, riskPct, sizingMode: mode };
}

export function loadRiskSimConfig(): RiskSimConfig {
  if (typeof window === 'undefined') return { ...DEFAULT_RISK_SIM };
  try {
    const raw = window.localStorage.getItem(RISK_SIM_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_RISK_SIM };
    return sanitizeRiskSimConfig(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_RISK_SIM };
  }
}

export function saveRiskSimConfig(config: RiskSimConfig): void {
  if (typeof window === 'undefined') return;
  const sanitized = sanitizeRiskSimConfig(config);
  try {
    window.localStorage.setItem(RISK_SIM_STORAGE_KEY, JSON.stringify(sanitized));
  } catch {
    // Ignore storage quota errors
  }
  window.dispatchEvent(new CustomEvent<RiskSimConfig>(RISK_SIM_UPDATED_EVENT, { detail: sanitized }));
}

export function calculatePositionSimulation(
  params: RiskSimConfig & {
    entryPrice: number;
    stopLossPrice: number;
    target1Price: number;
    target2Price: number;
  }
): PositionSimResult {
  const safeCapital = Math.max(0, Number(params.capital) || 0);
  const safeRiskPct = Math.min(100, Math.max(0, Number(params.riskPct) || 0));
  const entryPrice = Number(params.entryPrice) || 0;
  const stopLossPrice = Number(params.stopLossPrice) || 0;
  const target1Price = Number(params.target1Price) || 0;
  const target2Price = Number(params.target2Price) || 0;
  const sizingMode: RiskSizingMode = params.sizingMode === 'capital_alloc' ? 'capital_alloc' : 'stop_risk';

  if (safeCapital === 0 || entryPrice <= 0 || safeRiskPct === 0) {
    return {
      capital: round2(safeCapital),
      riskPct: round2(safeRiskPct),
      sizingMode,
      entryPrice: round2(entryPrice),
      stopLossPrice: round2(stopLossPrice),
      target1Price: round2(target1Price),
      target2Price: round2(target2Price),
      positionUsd: 0,
      positionCapPct: 0,
      shares: 0,
      cappedByCapital: false,
      riskAtStopUsd: 0,
      riskAtStopCapPct: 0,
      gainT1Usd: 0,
      gainT1CapPct: 0,
      gainT2Usd: 0,
      gainT2CapPct: 0,
      gainTrailing5050Usd: 0,
      gainTrailing5050CapPct: 0,
      rrT1: 0,
      rrT2: 0,
    };
  }

  const riskPerShare = entryPrice > stopLossPrice ? entryPrice - stopLossPrice : entryPrice * 0.048;
  const rewardT1PerShare = Math.max(0, target1Price - entryPrice);
  const rewardT2PerShare = Math.max(0, target2Price - entryPrice);

  let rawShares = 0;
  let cappedByCapital = false;

  if (sizingMode === 'stop_risk') {
    const targetRiskUsd = safeCapital * (safeRiskPct / 100);
    const desiredShares = riskPerShare > 0 ? targetRiskUsd / riskPerShare : 0;
    const maxShares = safeCapital / entryPrice;
    if (desiredShares > maxShares + 1e-9) {
      cappedByCapital = true;
      rawShares = maxShares;
    } else {
      rawShares = desiredShares;
    }
  } else {
    rawShares = (safeCapital * (safeRiskPct / 100)) / entryPrice;
  }

  const positionUsd = rawShares * entryPrice;
  const riskAtStopUsd = rawShares * riskPerShare;
  const gainT1Usd = rawShares * rewardT1PerShare;
  const gainT2Usd = rawShares * rewardT2PerShare;
  const gainTrailing5050Usd = gainT1Usd * 0.5 + gainT2Usd * 0.5;

  return {
    capital: round2(safeCapital),
    riskPct: round2(safeRiskPct),
    sizingMode,
    entryPrice: round2(entryPrice),
    stopLossPrice: round2(stopLossPrice),
    target1Price: round2(target1Price),
    target2Price: round2(target2Price),
    positionUsd: round2(positionUsd),
    positionCapPct: round2((positionUsd / safeCapital) * 100),
    shares: round3(rawShares),
    cappedByCapital,
    riskAtStopUsd: round2(riskAtStopUsd),
    riskAtStopCapPct: round2((riskAtStopUsd / safeCapital) * 100),
    gainT1Usd: round2(gainT1Usd),
    gainT1CapPct: round2((gainT1Usd / safeCapital) * 100),
    gainT2Usd: round2(gainT2Usd),
    gainT2CapPct: round2((gainT2Usd / safeCapital) * 100),
    gainTrailing5050Usd: round2(gainTrailing5050Usd),
    gainTrailing5050CapPct: round2((gainTrailing5050Usd / safeCapital) * 100),
    rrT1: round2(riskPerShare > 0 ? rewardT1PerShare / riskPerShare : 0),
    rrT2: round2(riskPerShare > 0 ? rewardT2PerShare / riskPerShare : 0),
  };
}
