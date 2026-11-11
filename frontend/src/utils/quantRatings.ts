import type { StockRecord, StockFactorAnalysis, GradeLetter, FactorGradeItem } from '../types/stock';

function scoreToGrade(score: number): GradeLetter {
  if (score >= 4.8) return 'A+';
  if (score >= 4.4) return 'A';
  if (score >= 4.0) return 'A-';
  if (score >= 3.6) return 'B+';
  if (score >= 3.2) return 'B';
  if (score >= 2.8) return 'B-';
  if (score >= 2.4) return 'C+';
  if (score >= 2.0) return 'C';
  if (score >= 1.6) return 'C-';
  if (score >= 1.3) return 'D+';
  if (score >= 1.0) return 'D';
  return 'F';
}

export function calculateFactorGrades(stock: StockRecord): StockFactorAnalysis {
  // 1. VALORACIÓN (Valuation)
  let valPoints = 0;
  let valWeights = 0;
  const valMetrics = [];

  if (stock.peg !== undefined && stock.peg !== null && stock.peg > 0) {
    let s = 1.0;
    if (stock.peg <= 0.4) s = 5.0;
    else if (stock.peg <= 0.8) s = 4.3;
    else if (stock.peg <= 1.2) s = 3.5;
    else if (stock.peg <= 1.8) s = 2.5;
    else if (stock.peg <= 2.5) s = 1.8;
    valPoints += s * 2;
    valWeights += 2;
    valMetrics.push({ label: 'PEG Ratio', value: stock.peg.toFixed(2), evaluation: s >= 4 ? 'Excelente' : s >= 3 ? 'Razonable' : 'Exigente' });
  }

  if (stock.pe !== undefined && stock.pe !== null && stock.pe > 0) {
    let s = 1.0;
    if (stock.pe <= 10) s = 5.0;
    else if (stock.pe <= 16) s = 4.2;
    else if (stock.pe <= 22) s = 3.2;
    else if (stock.pe <= 30) s = 2.2;
    else if (stock.pe <= 45) s = 1.5;
    valPoints += s * 1.5;
    valWeights += 1.5;
    valMetrics.push({ label: 'P/E Trailing', value: stock.pe.toFixed(2), evaluation: s >= 4 ? 'Bajo' : s >= 3 ? 'Promedio' : 'Elevado' });
  }

  if (stock.forward_pe !== undefined && stock.forward_pe !== null && stock.forward_pe > 0) {
    let s = stock.forward_pe <= 12 ? 4.8 : stock.forward_pe <= 18 ? 3.8 : stock.forward_pe <= 25 ? 2.8 : 1.5;
    valPoints += s;
    valWeights += 1;
    valMetrics.push({ label: 'Forward P/E', value: stock.forward_pe.toFixed(2), evaluation: s >= 4 ? 'Atractivo' : 'Neutral' });
  }

  if (stock.ev_ebitda !== undefined && stock.ev_ebitda !== null && stock.ev_ebitda > 0) {
    let s = stock.ev_ebitda <= 8 ? 4.8 : stock.ev_ebitda <= 13 ? 3.5 : stock.ev_ebitda <= 18 ? 2.5 : 1.5;
    valPoints += s;
    valWeights += 1;
    valMetrics.push({ label: 'EV/EBITDA', value: stock.ev_ebitda.toFixed(2), evaluation: s >= 4 ? 'Descuento' : 'Equitativo' });
  }

  // 1.5 P/E Promedio de los últimos 3 años (3Y Historical P/E Average)
  let pe3yAvg: number | null = null;
  if (stock.pe_3y_avg !== undefined && stock.pe_3y_avg !== null && stock.pe_3y_avg > 0) {
    pe3yAvg = stock.pe_3y_avg;
  } else if (stock.pe !== undefined && stock.pe !== null && stock.pe > 0) {
    // Si tenemos rendimiento a 3 años (perf_3y) y tasa de crecimiento de beneficios (eps_past_5y / eps_past_3y)
    const perf3y = stock.perf_3y ?? 0;
    const epsGrowth = stock.eps_past_3y ?? stock.eps_past_5y ?? 8.5;

    if (perf3y > -85 && perf3y < 600 && epsGrowth > -60 && epsGrowth < 250) {
      const priceFactor = 1 + (perf3y / 100);
      const epsFactor = Math.pow(1 + (epsGrowth / 100), 3);
      if (priceFactor > 0.1 && epsFactor > 0.1) {
        const pe3yAgo = (stock.pe * epsFactor) / priceFactor;
        const peMid = (stock.pe * Math.sqrt(epsFactor)) / Math.sqrt(priceFactor);
        const computed = (stock.pe + peMid + pe3yAgo) / 3;
        if (computed >= 4 && computed <= 150) {
          pe3yAvg = Number(computed.toFixed(2));
        }
      }
    }

    // Fallback cuantitativo armónico si no se dispone de histórico de 3 años
    if (!pe3yAvg) {
      if (stock.forward_pe && stock.forward_pe > 0) {
        pe3yAvg = Number(((stock.pe * 0.52) + (stock.forward_pe * 0.48 * 1.05)).toFixed(2));
      } else {
        pe3yAvg = Number((stock.pe * 0.95).toFixed(2));
      }
    }
  } else if (stock.forward_pe !== undefined && stock.forward_pe !== null && stock.forward_pe > 0) {
    pe3yAvg = Number((stock.forward_pe * 1.12).toFixed(2));
  }

  if (pe3yAvg !== null && pe3yAvg > 0) {
    let s = 3.0;
    let evalStr = 'En Rango 3A';
    if (stock.pe && stock.pe > 0) {
      const ratio = stock.pe / pe3yAvg;
      if (ratio <= 0.85) {
        s = 5.0;
        evalStr = 'Descuento vs 3A';
      } else if (ratio <= 1.05) {
        s = 4.0;
        evalStr = 'En Promedio 3A';
      } else if (ratio <= 1.25) {
        s = 2.8;
        evalStr = 'Prima Ligera';
      } else {
        s = 1.5;
        evalStr = 'Prima Elevada vs 3A';
      }
    } else {
      s = pe3yAvg <= 15 ? 4.5 : pe3yAvg <= 22 ? 3.5 : pe3yAvg <= 32 ? 2.5 : 1.5;
      evalStr = s >= 4 ? 'Histórico Atractivo' : 'Histórico Exigente';
    }

    valPoints += s * 1.5;
    valWeights += 1.5;
    valMetrics.push({ 
      label: 'P/E Promedio 3A', 
      value: `${pe3yAvg.toFixed(1)}x`, 
      evaluation: evalStr 
    });
  }

  const valScore = valWeights > 0 ? valPoints / valWeights : 3.0;
  const valuation: FactorGradeItem = {
    name: 'Valoración',
    grade: scoreToGrade(valScore),
    score: valScore,
    description: 'Múltiplos de precio frente a ganancias, ventas y valor empresa.',
    metrics: valMetrics
  };

  // 2. CRECIMIENTO (Growth)
  let groPoints = 0;
  let groWeights = 0;
  const groMetrics = [];

  if (stock.eps_qq !== undefined && stock.eps_qq !== null) {
    let s = stock.eps_qq >= 50 ? 5.0 : stock.eps_qq >= 25 ? 4.2 : stock.eps_qq >= 15 ? 3.4 : stock.eps_qq >= 0 ? 2.5 : 1.0;
    groPoints += s * 2;
    groWeights += 2;
    groMetrics.push({ label: 'BPA Trimestral (QoQ)', value: `${stock.eps_qq > 0 ? '+' : ''}${stock.eps_qq.toFixed(1)}%`, evaluation: s >= 4 ? 'Fuerte Expansión' : 'Estable' });
  }

  if (stock.sales_yoy_ttm !== undefined && stock.sales_yoy_ttm !== null) {
    let s = stock.sales_yoy_ttm >= 25 ? 5.0 : stock.sales_yoy_ttm >= 15 ? 4.0 : stock.sales_yoy_ttm >= 8 ? 3.2 : stock.sales_yoy_ttm >= 0 ? 2.2 : 1.0;
    groPoints += s * 1.5;
    groWeights += 1.5;
    groMetrics.push({ label: 'Ventas YoY (TTM)', value: `${stock.sales_yoy_ttm > 0 ? '+' : ''}${stock.sales_yoy_ttm.toFixed(1)}%`, evaluation: s >= 4 ? 'Acelerado' : 'Moderado' });
  }

  if (stock.eps_this_y !== undefined && stock.eps_this_y !== null) {
    let s = stock.eps_this_y >= 30 ? 4.8 : stock.eps_this_y >= 15 ? 3.8 : stock.eps_this_y >= 0 ? 2.8 : 1.5;
    groPoints += s;
    groWeights += 1;
    groMetrics.push({ label: 'BPA Este Año', value: `${stock.eps_this_y > 0 ? '+' : ''}${stock.eps_this_y.toFixed(1)}%`, evaluation: s >= 3.5 ? 'Positivo' : 'Lento' });
  }

  const groScore = groWeights > 0 ? groPoints / groWeights : 3.0;
  const growth: FactorGradeItem = {
    name: 'Crecimiento',
    grade: scoreToGrade(groScore),
    score: groScore,
    description: 'Expansión de ingresos operativos y beneficios por acción a corto y mediano plazo.',
    metrics: groMetrics
  };

  // 3. RENTABILIDAD (Profitability)
  let profPoints = 0;
  let profWeights = 0;
  const profMetrics = [];

  if (stock.roic !== undefined && stock.roic !== null) {
    let s = stock.roic >= 25 ? 5.0 : stock.roic >= 15 ? 4.2 : stock.roic >= 10 ? 3.3 : stock.roic >= 5 ? 2.2 : 1.0;
    profPoints += s * 2;
    profWeights += 2;
    profMetrics.push({ label: 'ROIC (Retorno Capital)', value: `${stock.roic.toFixed(1)}%`, evaluation: s >= 4 ? 'Excepcional' : s >= 3 ? 'Bueno' : 'Bajo' });
  }

  if (stock.profit_m !== undefined && stock.profit_m !== null) {
    let s = stock.profit_m >= 20 ? 5.0 : stock.profit_m >= 12 ? 4.0 : stock.profit_m >= 6 ? 3.0 : stock.profit_m >= 0 ? 2.0 : 1.0;
    profPoints += s * 1.5;
    profWeights += 1.5;
    profMetrics.push({ label: 'Margen Neto', value: `${stock.profit_m.toFixed(1)}%`, evaluation: s >= 4 ? 'Alto' : 'Estándar' });
  }

  if (stock.roe !== undefined && stock.roe !== null) {
    let s = stock.roe >= 25 ? 4.8 : stock.roe >= 15 ? 3.8 : stock.roe >= 8 ? 2.8 : 1.5;
    profPoints += s;
    profWeights += 1;
    profMetrics.push({ label: 'ROE (Retorno Patrimonio)', value: `${stock.roe.toFixed(1)}%`, evaluation: s >= 3.5 ? 'Sólido' : 'Regular' });
  }

  const profScore = profWeights > 0 ? profPoints / profWeights : 3.0;
  const profitability: FactorGradeItem = {
    name: 'Rentabilidad',
    grade: scoreToGrade(profScore),
    score: profScore,
    description: 'Eficiencia en la generación de flujos y retorno sobre el capital invertido.',
    metrics: profMetrics
  };

  // 4. SOLVENCIA FINANCIERA (Solvency)
  let solPoints = 0;
  let solWeights = 0;
  const solMetrics = [];

  if (stock.curr_r !== undefined && stock.curr_r !== null) {
    let s = stock.curr_r >= 2.0 ? 5.0 : stock.curr_r >= 1.4 ? 4.0 : stock.curr_r >= 1.0 ? 3.0 : stock.curr_r >= 0.7 ? 2.0 : 1.0;
    solPoints += s * 1.5;
    solWeights += 1.5;
    solMetrics.push({ label: 'Razón Corriente', value: stock.curr_r.toFixed(2), evaluation: s >= 3.5 ? 'Líquido' : 'Ajustado' });
  }

  if (stock.debt_eq !== undefined && stock.debt_eq !== null) {
    let s = stock.debt_eq <= 0.3 ? 5.0 : stock.debt_eq <= 0.7 ? 4.2 : stock.debt_eq <= 1.2 ? 3.2 : stock.debt_eq <= 2.0 ? 2.0 : 1.0;
    solPoints += s * 1.5;
    solWeights += 1.5;
    solMetrics.push({ label: 'Deuda / Patrimonio', value: stock.debt_eq.toFixed(2), evaluation: s >= 4 ? 'Baja Deuda' : s >= 3 ? 'Manejable' : 'Apalancada' });
  }

  const solScore = solWeights > 0 ? solPoints / solWeights : 3.0;
  const solvency: FactorGradeItem = {
    name: 'Salud Financiera',
    grade: scoreToGrade(solScore),
    score: solScore,
    description: 'Capacidad de pago, liquidez corriente y apalancamiento de balance.',
    metrics: solMetrics
  };

  // 5. MOMENTO TÉCNICO (Momentum)
  let momPoints = 0;
  let momWeights = 0;
  const momMetrics = [];

  if (stock.rsi !== undefined && stock.rsi !== null) {
    let s = 3.0;
    if (stock.rsi >= 45 && stock.rsi <= 65) s = 4.8;
    else if (stock.rsi >= 35 && stock.rsi < 45) s = 4.0;
    else if (stock.rsi > 65 && stock.rsi <= 75) s = 3.2;
    else s = 2.0;
    momPoints += s * 1.5;
    momWeights += 1.5;
    momMetrics.push({ label: 'RSI (14)', value: stock.rsi.toFixed(1), evaluation: stock.rsi > 70 ? 'Sobrecompra' : stock.rsi < 35 ? 'Sobreventa' : 'Zona Óptima' });
  }

  if (stock.sma200 !== undefined && stock.sma200 !== null) {
    let s = stock.sma200 >= 10 ? 4.8 : stock.sma200 >= 0 ? 3.8 : stock.sma200 >= -10 ? 2.5 : 1.2;
    momPoints += s * 1.5;
    momWeights += 1.5;
    momMetrics.push({ label: 'Distancia SMA 200', value: `${stock.sma200 > 0 ? '+' : ''}${stock.sma200.toFixed(1)}%`, evaluation: stock.sma200 >= 0 ? 'Tendencia Alcista' : 'Bajo Media' });
  }

  const momScore = momWeights > 0 ? momPoints / momWeights : 3.0;
  const momentum: FactorGradeItem = {
    name: 'Momento Técnico',
    grade: scoreToGrade(momScore),
    score: momScore,
    description: 'Fuerza relativa del precio, soporte de medias móviles e indicadores de oscilación.',
    metrics: momMetrics
  };

  // CALIFICACIÓN QUANT GLOBAL (Weighted Overall)
  const overallScore = Number((valScore * 0.30 + groScore * 0.25 + profScore * 0.25 + solScore * 0.10 + momScore * 0.10).toFixed(2));
  let quantRating: 'Fuerte Compra' | 'Compra' | 'Mantener' | 'Venta' | 'Fuerte Venta' = 'Mantener';

  if (overallScore >= 4.4) quantRating = 'Fuerte Compra';
  else if (overallScore >= 3.6) quantRating = 'Compra';
  else if (overallScore >= 2.6) quantRating = 'Mantener';
  else if (overallScore >= 1.8) quantRating = 'Venta';
  else quantRating = 'Fuerte Venta';

  return {
    quantScore: overallScore,
    quantRating,
    grades: {
      valuation,
      growth,
      profitability,
      solvency,
      momentum
    }
  };
}
