/**
 * Utilidades Centralizadas de Formato Financiero e Institucional
 * Proyecto: Inversor Colombia
 */

/**
 * Formatea cifras monetarias en USD siguiendo las reglas institucionales:
 * - Números >= 1.000 B USD (1 Trillón USD): "$X.XX T USD"
 * - Números >= 1 B USD (Miles de millones USD): "$X.XX B USD"
 * - Números < 1 B USD (hasta millones): "$X.XX M USD"
 * - Números menores: formato numérico con comas y 2 decimales
 */
export function formatCurrencyUSD(
  val: number | undefined | null, 
  options?: { shortUnit?: boolean; decimals?: number; spaceBeforeUnit?: boolean }
): string {
  if (val === undefined || val === null || isNaN(val)) return '—';
  
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  const decimals = options?.decimals ?? 2;
  const unitSuffix = options?.shortUnit ? '' : ' USD';
  const space = options?.spaceBeforeUnit !== false ? ' ' : '';

  // 1 Trillón o más (> 1.000 B USD)
  if (abs >= 1e12) {
    return `${sign}$${(abs / 1e12).toFixed(decimals)}${space}T${unitSuffix}`;
  }
  
  // 1 Billón o más (1 B USD a 999.9 B USD)
  if (abs >= 1e9) {
    return `${sign}$${(abs / 1e9).toFixed(decimals)}${space}B${unitSuffix}`;
  }

  // 1 Millón o más (1 M USD a 999.9 M USD)
  if (abs >= 1e6) {
    return `${sign}$${(abs / 1e6).toFixed(decimals)}${space}M${unitSuffix}`;
  }

  // Si el número es pequeño pero en el rango de miles
  if (abs >= 1e3) {
    return `${sign}$${abs.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  }

  return `${sign}$${abs.toFixed(decimals)}`;
}

/**
 * Formatea porcentajes con signo explícito (+/-) y coloreado opcional
 */
export function formatPercentage(val: number | undefined | null, decimals = 2): string {
  if (val === undefined || val === null || isNaN(val)) return '—';
  const sign = val >= 0 ? '+' : '';
  return `${sign}${val.toFixed(decimals)}%`;
}

/**
 * Formatea volúmenes de acciones con notación compacta (K, M, B)
 */
export function formatVolumeShares(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) return '—';
  const abs = Math.abs(val);
  if (abs >= 1e9) return `${(val / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(val / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(val / 1e3).toFixed(1)}K`;
  return val.toLocaleString('en-US');
}

/**
 * Calcula el precio real de una media móvil (SMA) a partir de la distancia porcentual de Finviz
 * Fórmula: Precio = SMA * (1 + pctDist/100)  =>  SMA = Precio / (1 + pctDist/100)
 */
export function calculateRealSMA(price: number, pctDistance: number | undefined | null): { price: number; distancePct: number } | null {
  if (pctDistance === undefined || pctDistance === null || isNaN(pctDistance) || !price || price <= 0) {
    return null;
  }
  const factor = 1 + (pctDistance / 100);
  if (factor <= 0) return null;
  const realPrice = Number((price / factor).toFixed(2));
  return {
    price: realPrice,
    distancePct: Number(pctDistance.toFixed(2))
  };
}
