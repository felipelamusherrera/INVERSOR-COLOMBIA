// ============================================================================
// Supabase Edge Function: agent-chat
// Fase 1: Backend Seguro & Motor RAG Financiero (Costo $0 - Google AI Studio)
// Aplicativo: Inversor Colombia — Agente Inversor IA
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

// Rastreador en memoria para Rate Limiting (mínimo 3 segundos entre consultas por usuario)
const userCallTracker = new Map<string, number>();

Deno.serve(async (req: Request) => {
  // Manejo de preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Verificación obligatoria de autenticación (Prevención de abuso y agotamiento de cuota)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ 
          error: 'UNAUTHORIZED', 
          message: 'Se requiere iniciar sesión con una cuenta activa para interactuar con el Agente Inversor IA.' 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://jptusquuyenbwrgasigt.supabase.co';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabaseAuthClient = createClient(supabaseUrl, supabaseAnonKey || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');
    
    const { data: authData, error: authErr } = await supabaseAuthClient.auth.getUser(token);
    if (authErr || !authData?.user) {
      return new Response(
        JSON.stringify({ 
          error: 'UNAUTHORIZED', 
          message: 'Sesión no válida o expirada. Por favor, inicia sesión nuevamente.' 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1.1 Rate Limiting por usuario autenticado (Protección contra agotamiento de cuota)
    const now = Date.now();
    const lastCall = userCallTracker.get(authData.user.id);
    if (lastCall && now - lastCall < 3000) {
      return new Response(
        JSON.stringify({
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Por favor espera unos segundos antes de enviar una nueva consulta al asistente.',
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    userCallTracker.set(authData.user.id, now);

    const body: EdgeAgentRequest = await req.json();
    const { message, activeTicker, intent, ragPromptContext, conversationHistory = [] } = body;

    // 1.2 Sanitización y truncamiento de tamaño máximo de texto de entrada
    const sanitizedMessage = (message || '').trim().slice(0, 1500);
    const sanitizedRag = (ragPromptContext || '').slice(0, 6000);

    if (!sanitizedMessage) {
      return new Response(
        JSON.stringify({ error: 'El mensaje de consulta es obligatorio.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';

    // Si el frontend aún no inyectó contexto RAG, lo consultamos directamente en el servidor
    let serverRagContext = sanitizedRag;
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

    const systemInstruction = `Eres el "Agente Inversor IA", el Analista Cuantitativo e Institucional nativo de la plataforma "Inversor Colombia".
REGLAS ESTRICTAS DE AUDITORÍA Y PRECISIÓN (Pauta auditor-inversor):
1. NUNCA inventes ni alucines cifras financieras. Utiliza EXCLUSIVAMENTE los datos verificados en el bloque [CONTEXTO RAG FINANCIERO EN VIVO] provisto en la consulta.
2. Formatea las cifras monetarias grandes de forma limpia: miles de millones como "$X.XX B USD", millones como "$X.XX M USD" y billones (trillions) como "$X.XX T USD". Jamás concatene números crudos largos con letras (ej. prohibido escribir "$14414300000M USD").
3. Responde siempre en español profesional, directo, estructurado con tablas Markdown cuando compares activos, viñetas claras y conclusiones accionables.
4. En análisis operativos o técnicos, aplica nuestra regla institucional de Riesgo Medio-Alto (Horizonte Swing a 3 meses): especifica Zona de Entrada, Stop Loss técnico, Target 1 (donde se activa el Trailing Stop a Breakeven) y Target 2 (rumbo a Valor Intrínseco).
5. Intención detectada: ${intent || 'general_market'}.
6. AUDITORÍA OBLIGATORIA DE FUENTES: Finaliza siempre con el bloque "Auditoría de Fuentes & Integridad de Datos (Estándar auditor-inversor)" con el Ticker, Compañía, Sector real, ETF sectorial verificado (XLK Tecnología, XLV Salud, etc.), corte de Supabase y sello "AUDIT STATUS: APPROVED BY AUDITOR_INVERSOR".`;

    // 1.3 Historial reciente formateado para Gemini API
    const recentHistory = conversationHistory.slice(-4).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: (m.content || '').slice(0, 1000) }]
    }));

    const currentPromptTurn = {
      role: 'user',
      parts: [{
        text: `=== CONTEXTO RAG FINANCIERO EN VIVO (SUPABASE) ===\n${serverRagContext || 'Consulta general de mercado sin ticker único fijado.'}\n\n=== CONSULTA DEL INVERSOR ===\n${sanitizedMessage}`
      }]
    };

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
          systemInstruction: {
            parts: [{ text: systemInstruction }]
          },
          contents: [...recentHistory, currentPromptTurn],
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
