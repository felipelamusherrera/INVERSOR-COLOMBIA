/**
 * Servicio de Integración con Google Gemini Flash
 * Proyecto: Inversor Colombia
 * 
 * Permite ejecutar análisis cualitativos y cuantitativos institucionales en tiempo real
 * utilizando los modelos Gemini de Google (Gemini 2.0 Flash / Gemini 1.5 Flash).
 */

import type { StockRecord } from '../types/stock';

const GEMINI_STORAGE_KEY = 'inversor_colombia_gemini_api_key';
const DEFAULT_MODEL = 'gemini-2.0-flash';

export function getStoredGeminiApiKey(): string {
  try {
    return localStorage.getItem(GEMINI_STORAGE_KEY) || import.meta.env.VITE_GEMINI_API_KEY || '';
  } catch {
    return import.meta.env.VITE_GEMINI_API_KEY || '';
  }
}

export function saveStoredGeminiApiKey(key: string): void {
  try {
    localStorage.setItem(GEMINI_STORAGE_KEY, key.trim());
  } catch (e) {
    console.error('Error guardando Gemini API Key:', e);
  }
}

export interface GeminiAnalysisResult {
  businessDescription: string;
  competitivePosition: {
    engine1: { title: string; subtitle: string; desc: string };
    engine2: { title: string; subtitle: string; desc: string };
    engine3: { title: string; subtitle: string; desc: string };
    engine4: { title: string; subtitle: string; desc: string };
  };
  rivalAnalysis: {
    rivalName: string;
    rivalSlogan: string;
    bullets: string[];
  };
  futurePotential: {
    confirmedBullet1: string;
    confirmedBullet2: string;
    confirmedBullet3: string;
    risksToWatch: string;
  };
  newsAndShortTermCatalysts: {
    newsDiagnosis: string;
    catalysts: string[];
  };
  capitalStructure: {
    buybackVsDilutionDiagnosis: string;
    verdict: string;
  };
  valueChain: {
    suppliers: { name: string; dependency: 'Estratégica' | 'Media' | 'Baja'; detail: string }[];
    clients: { name: string; pricingPower: 'Alto' | 'Medio' | 'Contratos Recurrentes'; detail: string }[];
  };
}

export async function runGeminiStockAnalysis(
  stock: StockRecord, 
  peers: StockRecord[],
  apiKey?: string
): Promise<GeminiAnalysisResult | null> {
  const key = apiKey || getStoredGeminiApiKey();
  if (!key) return null;

  const prompt = `Actúa como un Analista de Inversión Institucional Senior (Enfoque Riesgo Medio-Alto, Swing a 3 meses, Estándar PLTR/TMUS).
Analiza la siguiente acción:
- Ticker: ${stock.ticker}
- Empresa: ${stock.company}
- Sector: ${stock.sector}
- Industria: ${stock.industry}
- Precio Actual: $${stock.price}
- Market Cap: $${stock.market_cap}
- P/E: ${stock.pe}x (Forward P/E: ${stock.forward_pe}x)
- Margen Neto: ${stock.profit_m}%
- ROIC: ${stock.roic}%
- Ventas YoY TTM: ${stock.sales_yoy_ttm}%
- Deuda/Equity: ${stock.debt_eq}
- Titular Noticia: "${stock.news_title || 'N/A'}"
- Peers del sector: ${peers.map(p => `${p.ticker} (P/E: ${p.pe}x)`).join(', ')}

Devuelve EXCLUSIVAMENTE un objeto JSON válido (sin markdown backticks ni código envolvente) con la siguiente estructura exacta:
{
  "businessDescription": "Párrafo conciso y contundente explicando a qué se dedica, su foso económico y cómo monetiza.",
  "competitivePosition": {
    "engine1": { "title": "Motor Core 1", "subtitle": "Métrica o logro #1", "desc": "Descripción del liderazgo" },
    "engine2": { "title": "Motor Core 2", "subtitle": "Métrica o logro #2", "desc": "Descripción del liderazgo" },
    "engine3": { "title": "Motor Core 3", "subtitle": "Métrica o logro #3", "desc": "Descripción del liderazgo" },
    "engine4": { "title": "Motor Core 4", "subtitle": "Métrica o logro #4", "desc": "Descripción del liderazgo" }
  },
  "rivalAnalysis": {
    "rivalName": "Nombre del Rival Principal o Rivales Directos",
    "rivalSlogan": "Frase que resume la ventaja competitiva estructural sobre este rival",
    "bullets": [
      "Punto 1 comparativo de escala y ventaja frente al rival",
      "Punto 2 de costos, márgenes y foso defensivo",
      "Punto 3 de flujo institucional y tracción actual"
    ]
  },
  "futurePotential": {
    "confirmedBullet1": "[CONFIRMADO] Hecho verificable de flujo de caja libre o crecimiento",
    "confirmedBullet2": "[CONFIRMADO] Descuento frente a Valor Intrínseco o múltiplos",
    "confirmedBullet3": "[CONFIRMADO] Retorno al accionista (recompras o dividendos)",
    "risksToWatch": "Riesgos clave a vigilar en los próximos 60-90 días"
  },
  "newsAndShortTermCatalysts": {
    "newsDiagnosis": "Análisis fundamentado en noticias y reportes sobre la situación operativa actual",
    "catalysts": [
      "Catalizador 1 a 60 días",
      "Catalizador 2 de producto o demanda",
      "Catalizador 3 macroeconómico o sectorial"
    ]
  },
  "capitalStructure": {
    "buybackVsDilutionDiagnosis": "Diagnóstico detallado de si recompra acciones (acrecentando EPS) o diluye accionistas por SBC o emisiones.",
    "verdict": "Favorable: Política Activa de Recompra de Acciones" o "Precaución: Dilución por Compensación en Acciones (SBC)"
  },
  "valueChain": {
    "suppliers": [
      { "name": "Proveedor 1", "dependency": "Estratégica", "detail": "Detalle de insumo o servicio" },
      { "name": "Proveedor 2", "dependency": "Media", "detail": "Detalle de insumo o servicio" }
    ],
    "clients": [
      { "name": "Segmento Clientes 1", "pricingPower": "Alto", "detail": "Detalle del cliente o canal" },
      { "name": "Segmento Clientes 2", "pricingPower": "Contratos Recurrentes", "detail": "Detalle del cliente o canal" }
    ]
  }
}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL}:generateContent?key=${key}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Error en Gemini API:', response.status, errText);
      return null;
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return null;

    // Limpiar posibles backticks
    const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned) as GeminiAnalysisResult;
  } catch (error) {
    console.error('Excepción llamando a Gemini:', error);
    return null;
  }
}

