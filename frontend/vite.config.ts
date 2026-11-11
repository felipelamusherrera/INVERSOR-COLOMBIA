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

      // Caché y middleware para Estados Contables Trimestrales (SEC EDGAR XBRL + Nasdaq)
      let cachedSecTickers: Record<string, { cik_str: number; ticker: string; title: string }> | null = null
      const quarterlyFinancialsCache = new Map<string, { data: any; timestamp: number }>()
      const QUARTERLY_TTL_MS = 60 * 60 * 1000 // 1 hora de caché

      server.middlewares.use('/api/financials/quarterly', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          })
          res.end()
          return
        }

        try {
          const urlObj = new URL(req.url || '', 'http://localhost')
          const ticker = (urlObj.searchParams.get('ticker') || '').toUpperCase().trim()
          if (!ticker) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Ticker is required' }))
            return
          }

          const cached = quarterlyFinancialsCache.get(ticker)
          if (cached && Date.now() - cached.timestamp < QUARTERLY_TTL_MS) {
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
            res.end(JSON.stringify(cached.data))
            return
          }

          // 1. Obtener CIK desde SEC
          if (!cachedSecTickers) {
            try {
              const secTRes = await fetch('https://www.sec.gov/files/company_tickers.json', {
                headers: { 'User-Agent': 'InversorColombia admin@inversorcolombia.com' },
              })
              if (secTRes.ok) {
                cachedSecTickers = await secTRes.json()
              }
            } catch (e) {
              console.error('Error fetching SEC tickers:', e)
            }
          }

          const tickerEntry = cachedSecTickers
            ? Object.values(cachedSecTickers).find((t) => t.ticker === ticker)
            : null

          let secQuarterlyRevenues: { frame: string; val: number; date: string }[] = []
          let secQuarterlyEps: { frame: string; val: number; date: string }[] = []
          let secAnnualFCF: number | null = null
          let secQuarterlyFCF: { frame: string; val: number; date: string }[] = []
          let secOperatingCashFlow: number | null = null
          let secCapEx: number | null = null

          if (tickerEntry) {
            try {
              const cik = String(tickerEntry.cik_str).padStart(10, '0')
              const factsRes = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, {
                headers: { 'User-Agent': 'InversorColombia admin@inversorcolombia.com' },
              })
              if (factsRes.ok) {
                const facts = await factsRes.json()
                const gaap = facts.facts?.['us-gaap'] || {}

                const revKey = [
                  'RevenueFromContractWithCustomerExcludingAssessedTax',
                  'Revenues',
                  'SalesRevenueNet',
                  'SalesRevenueGoodsNet',
                ].find((k) => gaap[k]?.units?.USD)
                if (revKey) {
                  const revUnits = gaap[revKey].units.USD || []
                  const filteredRevs: { frame: string; val: number; date: string }[] = []
                  const seenFrames = new Set<string>()

                  for (let i = revUnits.length - 1; i >= 0; i--) {
                    const u = revUnits[i]
                    const frame = u.frame || (u.fy && u.fp && u.fp.startsWith('Q') ? `CY${u.fy}${u.fp}` : null)
                    if (!frame || !frame.startsWith('CY') || !frame.includes('Q')) continue

                    // Filtrar períodos acumulados de 6 o 9 meses en 10-Q
                    if (u.start && u.end) {
                      const days = (new Date(u.end).getTime() - new Date(u.start).getTime()) / (1000 * 3600 * 24)
                      if (days > 115) continue
                    }

                    if (!seenFrames.has(frame)) {
                      seenFrames.add(frame)
                      filteredRevs.push({ frame, val: Number(u.val), date: u.end || u.filed })
                    }
                  }
                  secQuarterlyRevenues = filteredRevs.reverse()
                }

                const epsKey = ['EarningsPerShareDiluted', 'EarningsPerShareBasic'].find(
                  (k) => gaap[k]?.units?.['USD/shares']
                )
                if (epsKey) {
                  const epsUnits = gaap[epsKey].units['USD/shares'] || []
                  const filteredEps: { frame: string; val: number; date: string }[] = []
                  const seenFrames = new Set<string>()

                  for (let i = epsUnits.length - 1; i >= 0; i--) {
                    const u = epsUnits[i]
                    const frame = u.frame || (u.fy && u.fp && u.fp.startsWith('Q') ? `CY${u.fy}${u.fp}` : null)
                    if (!frame || !frame.startsWith('CY') || !frame.includes('Q')) continue

                    if (u.start && u.end) {
                      const days = (new Date(u.end).getTime() - new Date(u.start).getTime()) / (1000 * 3600 * 24)
                      if (days > 115) continue
                    }

                    if (!seenFrames.has(frame)) {
                      seenFrames.add(frame)
                      filteredEps.push({ frame, val: Number(u.val), date: u.end || u.filed })
                    }
                  }
                  secQuarterlyEps = filteredEps.reverse()
                }

                // 3. Extracción de Flujo de Caja Operativo (OCF) y Gastos de Capital (CapEx) para FCF Real
                const ocfKey = [
                  'NetCashProvidedByUsedInOperatingActivities',
                  'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations',
                ].find((k) => gaap[k]?.units?.USD)

                const capexKey = [
                  'PaymentsToAcquirePropertyPlantAndEquipment',
                  'PaymentsToAcquireProductiveAssets',
                  'PaymentsForPropertyPlantAndEquipment',
                ].find((k) => gaap[k]?.units?.USD)

                if (ocfKey) {
                  const ocfUnits = gaap[ocfKey].units.USD || []
                  const capexUnits = capexKey ? (gaap[capexKey].units?.USD || []) : []

                  // FCF Anual (10-K)
                  const annualOcf = ocfUnits.filter((u: any) => u.form === '10-K').slice(-1)[0]
                  const annualCapex = capexUnits.filter((u: any) => u.form === '10-K').slice(-1)[0]
                  if (annualOcf) {
                    secOperatingCashFlow = Number(annualOcf.val)
                    secCapEx = annualCapex ? Math.abs(Number(annualCapex.val)) : 0
                    secAnnualFCF = secOperatingCashFlow - secCapEx
                  }

                  // Mapa de CapEx trimestral
                  const capexMap = new Map<string, number>()
                  for (const c of capexUnits) {
                    const frame = c.frame || (c.fy && c.fp && c.fp.startsWith('Q') ? `CY${c.fy}${c.fp}` : null)
                    if (frame) {
                      capexMap.set(frame, Math.abs(Number(c.val)))
                    }
                  }

                  const qFcfList: { frame: string; val: number; date: string }[] = []
                  const seenFcfFrames = new Set<string>()

                  for (let i = ocfUnits.length - 1; i >= 0; i--) {
                    const u = ocfUnits[i]
                    const frame = u.frame || (u.fy && u.fp && u.fp.startsWith('Q') ? `CY${u.fy}${u.fp}` : null)
                    if (!frame || !frame.startsWith('CY') || !frame.includes('Q')) continue

                    if (u.start && u.end) {
                      const days = (new Date(u.end).getTime() - new Date(u.start).getTime()) / (1000 * 3600 * 24)
                      if (days > 115) continue
                    }

                    if (!seenFcfFrames.has(frame)) {
                      seenFcfFrames.add(frame)
                      const qOcf = Number(u.val)
                      const qCapex = capexMap.get(frame) || 0
                      qFcfList.push({ frame, val: qOcf - qCapex, date: u.end || u.filed })
                    }
                  }
                  secQuarterlyFCF = qFcfList.reverse()

                  // Si no hay 10-K anual (ej. IPO reciente como CBRS), calcular TTM como la suma de los trimestres disponibles
                  if (secAnnualFCF === null && secQuarterlyFCF.length > 0) {
                    const last4 = secQuarterlyFCF.slice(-4)
                    secAnnualFCF = last4.reduce((acc, curr) => acc + curr.val, 0)
                  }
                }
              }
            } catch (e) {
              console.error(`Error fetching SEC facts for ${ticker}:`, e)
            }
          }

          // 2. Obtener Histórico de Sorpresas y Próximo Reporte desde Nasdaq
          let nasdaqSurprises: any[] = []
          let upcomingReport: any = null

          try {
            const [surpRes, dateRes] = await Promise.all([
              fetch(`https://api.nasdaq.com/api/company/${ticker}/earnings-surprise`, {
                headers: {
                  'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
                  Accept: 'application/json, text/plain, */*',
                },
              }).catch(() => null),
              fetch(`https://api.nasdaq.com/api/analyst/${ticker}/earnings-date`, {
                headers: {
                  'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
                  Accept: 'application/json, text/plain, */*',
                },
              }).catch(() => null),
            ])

            if (surpRes && surpRes.ok) {
              const surpJson = await surpRes.json()
              nasdaqSurprises = surpJson?.data?.earningsSurpriseTable?.rows || []
            }

            if (dateRes && dateRes.ok) {
              const dateJson = await dateRes.json()
              upcomingReport = dateJson?.data || null
            }
          } catch (e) {
            console.error(`Error fetching Nasdaq data for ${ticker}:`, e)
          }

          const resultPayload = {
            ticker,
            companyName: tickerEntry?.title || ticker,
            secQuarterlyRevenues,
            secQuarterlyEps,
            secAnnualFCF,
            secQuarterlyFCF,
            secOperatingCashFlow,
            secCapEx,
            nasdaqSurprises,
            upcomingReport,
            timestamp: new Date().toISOString(),
          }

          quarterlyFinancialsCache.set(ticker, { data: resultPayload, timestamp: Date.now() })

          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
          res.end(JSON.stringify(resultPayload))
        } catch (err: any) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: err?.message || 'Error processing quarterly financials' }))
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
        '/api/nasdaq': {
          target: 'https://api.nasdaq.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/nasdaq/, '/api'),
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
          },
        },
        '/api/sec-facts': {
          target: 'https://data.sec.gov',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/sec-facts/, '/api/xbrl'),
          headers: {
            'User-Agent': 'InversorColombia admin@inversorcolombia.com',
            'Accept': 'application/json',
          },
        },
        '/api/sec-tickers': {
          target: 'https://www.sec.gov',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/sec-tickers/, '/files/company_tickers.json'),
          headers: {
            'User-Agent': 'InversorColombia admin@inversorcolombia.com',
            'Accept': 'application/json',
          },
        },
      },
    },
  }
})
