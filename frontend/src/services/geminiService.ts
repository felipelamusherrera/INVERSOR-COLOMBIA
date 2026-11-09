/**
 * Servicio de Integración con Google Gemini Flash
 * Proyecto: Inversor Colombia
 * 
 * Permite ejecutar análisis cualitativos y cuantitativos institucionales en tiempo real
 * utilizando los modelos Gemini de Google (Gemini 1.5 Flash / Gemini 2.0 Flash)
 * con cascada automática de respaldo y diagnóstico detallado de errores.
 */

import type { StockRecord } from '../types/stock';

const GEMINI_STORAGE_KEY = 'inversor_colombia_gemini_api_key';

// Lista de modelos ordenados por compatibilidad universal y rendimiento
const CANDIDATE_MODELS = [
  'gemini-1.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-pro'
];

/**
 * Limpia y normaliza una API Key eliminando comillas, espacios y saltos de línea accidentales
 */
export function sanitizeApiKey(rawKey: string): string {
  if (!rawKey) return '';
  return rawKey.replace(/["'\s`]/g, '').trim();
}

export function getStoredGeminiApiKey(): string {
  try {
    const raw = localStorage.getItem(GEMINI_STORAGE_KEY) || import.meta.env.VITE_GEMINI_API_KEY || '';
    return sanitizeApiKey(raw);
  } catch {
    return sanitizeApiKey(import.meta.env.VITE_GEMINI_API_KEY || '');
  }
}

export function saveStoredGeminiApiKey(key: string): void {
  try {
    const clean = sanitizeApiKey(key);
    localStorage.setItem(GEMINI_STORAGE_KEY, clean);
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

export interface GeminiServiceResponse {
  success: boolean;
  data?: GeminiAnalysisResult;
  error?: string;
  activeModel?: string;
}

/**
 * Valida rápidamente una API Key ejecutando un ping ligero contra la API de Google
 */
export async function testGeminiApiKey(apiKey: string): Promise<{ success: boolean; message: string; model?: string }> {
  const cleanKey = sanitizeApiKey(apiKey);
  if (!cleanKey) {
    return { success: false, message: 'La API Key está vacía.' };
  }

  for (const model of CANDIDATE_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'ping' }] }],
          generationConfig: { maxOutputTokens: 5 }
        })
      });

      if (res.ok) {
        return { 
          success: true, 
          message: `Conexión exitosa verificada con Google AI Studio.`,
          model 
        };
      }

      const errJson = await res.json().catch(() => null);
      const errMsg = errJson?.error?.message || `HTTP ${res.status}`;

      if (res.status === 400 && (errMsg.includes('API key not valid') || errMsg.includes('API_KEY_INVALID'))) {
        return { 
          success: false, 
          message: 'La API Key no es válida. Asegúrate de copiar la clave completa de Google AI Studio (comienza con "AIzaSy...").' 
        };
      }

      if (res.status === 403) {
        return { 
          success: false, 
          message: 'Permiso denegado: Asegúrate de que la API "Generative Language API" esté habilitada en tu proyecto de Google Cloud.' 
        };
      }

      if (res.status === 429) {
        return { 
          success: false, 
          message: 'Límite de cuota alcanzado (429). Espera un minuto antes de reintentar.' 
        };
      }
    } catch (e: any) {
      // Intentar con el siguiente modelo si fue error 404
      continue;
    }
  }

  return {
    success: false,
    message: 'No se pudo comunicar con Google Generative Language API. Verifica tu conexión a internet o el estado de tu clave.'
  };
}

/**
 * Ejecuta el análisis profundo institucional de una acción con Gemini Flash
 */
export async function runGeminiStockAnalysis(
  stock: StockRecord, 
  peers: StockRecord[],
  apiKey?: string
): Promise<GeminiServiceResponse> {
  const key = sanitizeApiKey(apiKey || getStoredGeminiApiKey());
  if (!key) {
    return { 
      success: false, 
      error: 'No se ha configurado ninguna API Key de Gemini. Ingresa tu clave para continuar.' 
    };
  }

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

Devuelve EXCLUSIVAMENTE un objeto JSON válido (sin código markdown ni explicaciones externas) con la siguiente estructura exacta:
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
    "verdict": "Favorable: Política Activa de Recompra de Acciones"
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

  let lastError = 'No se pudo generar el análisis.';

  // Cascada automática de modelos
  for (const model of CANDIDATE_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 8192,
            responseMimeType: 'application/json'
          }
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => null);
        const errMsg = errJson?.error?.message || `HTTP ${response.status}`;

        if (response.status === 400 && (errMsg.includes('API key not valid') || errMsg.includes('API_KEY_INVALID'))) {
          return {
            success: false,
            error: 'La API Key ingresada no es válida. Copia una clave nueva desde Google AI Studio (aistudio.google.com/app/apikey).'
          };
        }

        if (response.status === 403) {
          return {
            success: false,
            error: 'Permiso denegado (403): La clave no tiene permisos para Generative Language API.'
          };
        }

        if (response.status === 429) {
          return {
            success: false,
            error: 'Cuota de peticiones excedida temporalmente (429). Espera 30 segundos.'
          };
        }

        lastError = `Error en modelo ${model}: ${errMsg}`;
        // Probar siguiente modelo
        continue;
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        lastError = 'El modelo devolvió una respuesta vacía.';
        continue;
      }

      // Limpiar posibles backticks o envoltura markdown
      const cleaned = rawText.replace(/```json/gi, '').replace(/```/gi, '').trim();
      const parsed = JSON.parse(cleaned) as GeminiAnalysisResult;

      return {
        success: true,
        data: parsed,
        activeModel: model
      };
    } catch (err: any) {
      lastError = err?.message || 'Error de procesamiento de respuesta JSON.';
      console.warn(`Intento con ${model} falló:`, err);
    }
  }

  return {
    success: false,
    error: lastError
  };
}
