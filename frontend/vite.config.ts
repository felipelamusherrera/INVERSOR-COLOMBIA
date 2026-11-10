import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import path from 'path'

// Caché en memoria del servidor (15 minutos TTL) para optimizar la cuota gratuita de Google AI Studio
const serverResponseCache = new Map<string, { reply: string; modelUsed: string; timestamp: number }>()
const CACHE_TTL_MS = 15 * 60 * 1000

function agentBackendServerPlugin(geminiApiKey: string): Plugin {
  return {
    name: 'inversor-colombia-agent-backend',
    configureServer(server) {
      server.middlewares.use('/api/agent/chat', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          })
          res.end()
          return
        }

        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Method Not Allowed' }))
          return
        }

        try {
          const chunks: Buffer[] = []
          for await (const chunk of req) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
          }
          const rawBody = Buffer.concat(chunks).toString('utf-8')
          const body = JSON.parse(rawBody || '{}')

          const { message, activeTicker, intent, ragPromptContext, conversationHistory = [] } = body

          if (!message || typeof message !== 'string') {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'El mensaje de consulta es obligatorio.' }))
            return
          }

          // Verificar caché del servidor para consultas idénticas recientes
          const cacheKey = `${activeTicker || 'GLOBAL'}::${intent || 'auto'}::${message.trim().toLowerCase()}`
          const cached = serverResponseCache.get(cacheKey)
          if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(
              JSON.stringify({
                reply: cached.reply,
                modelUsed: `${cached.modelUsed} (Server Cache)`,
                cached: true,
                timestamp: new Date().toISOString(),
              })
            )
            return
          }

          const activeServerKey = geminiApiKey || process.env.GEMINI_API_KEY || ''
          if (!activeServerKey || activeServerKey === 'tu_gemini_api_key_aqui') {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(
              JSON.stringify({
                useDeterministicEngine: true,
                reason: 'SERVER_KEY_PENDING',
              })
            )
            return
          }

          const systemInstruction = `Eres el "Agente Inversor IA", el Analista Cuantitativo e Institucional nativo de la plataforma "Inversor Colombia".
REGLAS ESTRICTAS DE AUDITORÍA Y PRECISIÓN:
1. NUNCA inventes ni alucines cifras financieras. Utiliza EXCLUSIVAMENTE los datos verificados en el bloque [CONTEXTO RAG FINANCIERO EN VIVO] provisto en la consulta.
2. Formatea las cifras monetarias grandes de forma limpia: miles de millones como "$X.XX B USD", millones como "$X.XX M USD" y billones (trillions) como "$X.XX T USD". Jamás concatenes números crudos largos con letras.
3. Responde siempre en español profesional, directo, estructurado con tablas Markdown cuando compares activos, viñetas claras y conclusiones accionables.
4. En análisis operativos o técnicos, aplica nuestra regla institucional de Riesgo Medio-Alto (Horizonte Swing a 3 meses): especifica Zona de Entrada, Stop Loss técnico, Target 1 (donde se activa el Trailing Stop a Breakeven) y Target 2 (rumbo a Valor Intrínseco).
5. Intención detectada: ${intent || 'general_market'}.`

          const historyText = Array.isArray(conversationHistory)
            ? conversationHistory
                .slice(-4)
                .map((m: { role: string; content: string }) => `${m.role === 'user' ? 'Inversor' : 'InversorAI'}: ${m.content}`)
                .join('\n\n')
            : ''

          const fullPrompt = `${systemInstruction}

=== CONTEXTO RAG FINANCIERO EN VIVO (SUPABASE) ===
${ragPromptContext || 'Consulta general de mercado.'}

${historyText ? `=== HISTORIAL RECIENTE DE CONVERSACIÓN ===\n${historyText}\n` : ''}
=== CONSULTA ACTUAL DEL INVERSOR ===
${message}`

          // Prioridad: gemini-1.5-pro (Razonamiento Institucional) -> gemini-2.0-flash -> gemini-1.5-flash
          const modelsToTry = ['gemini-1.5-pro', 'gemini-2.0-flash', 'gemini-1.5-flash']
          let replyText = ''
          let modelUsed = ''

          for (const modelName of modelsToTry) {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${activeServerKey}`
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
            })

            if (llmRes.ok) {
              const llmData = (await llmRes.json()) as {
                candidates?: { content?: { parts?: { text?: string }[] } }[]
              }
              const candidateText = llmData?.candidates?.[0]?.content?.parts?.[0]?.text
              if (candidateText) {
                replyText = candidateText
                modelUsed = `${modelName} (Google AI Studio Server)`
                break
              }
            }
          }

          if (!replyText) {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(
              JSON.stringify({
                useDeterministicEngine: true,
                reason: 'RATE_LIMIT_OR_QUOTA_FALLBACK',
              })
            )
            return
          }

          serverResponseCache.set(cacheKey, {
            reply: replyText,
            modelUsed,
            timestamp: Date.now(),
          })

          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(
            JSON.stringify({
              reply: replyText,
              modelUsed,
              cached: false,
              timestamp: new Date().toISOString(),
            })
          )
        } catch (err: unknown) {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(
            JSON.stringify({
              useDeterministicEngine: true,
              reason: err instanceof Error ? err.message : 'SERVER_FALLBACK',
            })
          )
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Cargar variables de entorno tanto de frontend/ como de la raíz del proyecto (sin exponer GEMINI_API_KEY al cliente)
  const rootEnv = loadEnv(mode, path.resolve(process.cwd(), '..'), '')
  const localEnv = loadEnv(mode, process.cwd(), '')
  const serverGeminiKey = localEnv.GEMINI_API_KEY || rootEnv.GEMINI_API_KEY || ''

  return {
    base: './',
    plugins: [react(), agentBackendServerPlugin(serverGeminiKey)],
    server: {
      host: true,
      proxy: {
        '/api/chart': {
          target: 'https://query1.finance.yahoo.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/chart/, '/v8/finance/chart'),
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
          },
        },
        '/api/news': {
          target: 'https://query1.finance.yahoo.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/news/, '/v1/finance/search'),
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
          },
        },
      },
    },
  }
})
