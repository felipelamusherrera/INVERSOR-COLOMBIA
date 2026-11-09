// ============================================================================
// Supabase Edge Function: agent-chat
// Fase 1: Backend Seguro & Motor RAG Financiero (Costo $0 - Google AI Studio)
// Aplicativo: Inversor Colombia (Estilo WarrenAI Institucional)
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface EdgeAgentRequest {
  message: string;
  activeTicker?: string;
  intent?: string;
  ragPromptContext?: string;
  conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
}

Deno.serve(async (req: Request) => {
  // Manejo de preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: EdgeAgentRequest = await req.json();
    const { message, activeTicker, intent, ragPromptContext, conversationHistory = [] } = body;

    if (!message || !message.trim()) {
      return new Response(
        JSON.stringify({ error: 'El mensaje de consulta es obligatorio.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://jptusquuyenbwrgasigt.supabase.co';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';

    // Si el frontend aún no inyectó contexto RAG, lo consultamos directamente en el servidor
    let serverRagContext = ragPromptContext || '';
    const dataSources: string[] = ['Supabase stocks_finviz (Tiempo Real)', 'Supabase prices_daily (OHLCV)'];

    if (!serverRagContext && supabaseKey && activeTicker) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: stockRows } = await supabase
        .from('stocks_finviz')
        .select('*')
        .eq('ticker', activeTicker.toUpperCase())
        .order('snapshot_date', { ascending: false })
        .limit(1);

      if (stockRows && stockRows.length > 0) {
        const s = stockRows[0];
        serverRagContext = `
DATOS VERIFICADOS EN SUPABASE PARA ${s.ticker} (${s.company}):
- Sector: ${s.sector || 'N/A'} | Industria: ${s.industry || 'N/A'}
- Precio Actual: $${s.price ?? 'N/A'} USD | Cambio Diario: ${s.change_pct ?? 0}%
- Market Cap: $${s.market_cap ?? 'N/A'}M | P/E: ${s.pe ?? 'N/A'} | Forward P/E: ${s.forward_pe ?? 'N/A'} | PEG: ${s.peg ?? 'N/A'}
- ROIC: ${s.roic ?? 'N/A'}% | ROE: ${s.roe ?? 'N/A'}% | Margen Neto: ${s.profit_m ?? 'N/A'}% | Margen Operativo: ${s.oper_m ?? 'N/A'}%
- Crecimiento Ventas YoY: ${s.sales_yoy_ttm ?? s.sales_qq ?? 'N/A'}% | EPS Q/Q: ${s.eps_qq ?? 'N/A'}%
- Deuda/Equity: ${s.debt_eq ?? 'N/A'} | Current Ratio: ${s.curr_r ?? 'N/A'}
- RSI (14): ${s.rsi ?? 'N/A'} | Volumen Relativo (RVol): ${s.rel_volume ?? 'N/A'}x | Target Consenso: $${s.target_price ?? 'N/A'} USD
`;
      }
    }

    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({
          error: 'SERVER_KEY_NOT_CONFIGURED',
          message: 'La variable GEMINI_API_KEY no está configurada en los secretos del servidor.',
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemInstruction = `Eres "InversorAI", el Agente Analista Cuantitativo e Institucional de la plataforma "Inversor Colombia" (equivalente avanzado a WarrenAI de InvestingPro).
REGLAS ESTRICTAS DE AUDITORÍA Y PRECISIÓN:
1. NUNCA inventes ni alucines cifras financieras. Utiliza EXCLUSIVAMENTE los datos verificados en el bloque [CONTEXTO RAG FINANCIERO EN VIVO] provisto en la consulta.
2. Formatea las cifras monetarias grandes de forma limpia: miles de millones como "$X.XX B USD", millones como "$X.XX M USD" y billones (trillions) como "$X.XX T USD". Jamás concatene números crudos largos con letras (ej. prohibido escribir "$14414300000M USD").
3. Responde siempre en español profesional, directo, estructurado con tablas Markdown cuando compares activos, viñetas claras y conclusiones accionables.
4. En análisis operativos o técnicos, aplica nuestra regla institucional de Riesgo Medio-Alto (Horizonte Swing a 3 meses): especifica Zona de Entrada, Stop Loss técnico, Target 1 (donde se activa el Trailing Stop a Breakeven) y Target 2 (rumbo a Valor Intrínseco).
5. Intención detectada: ${intent || 'general_market'}.`;

    const historyText = conversationHistory
      .slice(-4)
      .map((m) => `${m.role === 'user' ? 'Inversor' : 'InversorAI'}: ${m.content}`)
      .join('\n\n');

    const fullPrompt = `${systemInstruction}

=== CONTEXTO RAG FINANCIERO EN VIVO (SUPABASE) ===
${serverRagContext || 'Consulta general de mercado sin ticker único fijado.'}

${historyText ? `=== HISTORIAL RECIENTE DE CONVERSACIÓN ===\n${historyText}\n` : ''}
=== CONSULTA ACTUAL DEL INVERSOR ===
${message}`;

    // Intentar primero con gemini-1.5-pro (máximo razonamiento analítico) y fallback automático a gemini-2.0-flash
    const modelsToTry = ['gemini-1.5-pro', 'gemini-2.0-flash', 'gemini-1.5-flash'];
    let replyText = '';
    let modelUsed = '';

    for (const modelName of modelsToTry) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`;
      const llmRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
          generationConfig: {
            temperature: 0.2,
            topP: 0.9,
            maxOutputTokens: 2048,
          },
        }),
      });

      if (llmRes.ok) {
        const llmData = await llmRes.json();
        const candidateText = llmData?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidateText) {
          replyText = candidateText;
          modelUsed = `${modelName} (Google AI Studio Server)`;
          break;
        }
      }
    }

    if (!replyText) {
      return new Response(
        JSON.stringify({
          error: 'UPSTREAM_LLM_UNAVAILABLE',
          message: 'Los modelos de Google AI Studio alcanzaron el límite temporal de cuota.',
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        reply: replyText,
        modelUsed,
        dataSources,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Error interno del servidor RAG';
    return new Response(
      JSON.stringify({ error: 'INTERNAL_ERROR', message: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
