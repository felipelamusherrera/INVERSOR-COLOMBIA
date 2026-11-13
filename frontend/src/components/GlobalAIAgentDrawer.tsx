import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Bot,
  Sparkles,
  X,
  Send,
  Trash2,
  ShieldCheck,
  Database,
  Briefcase,
  Layers,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
  Loader2,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { StockRecord } from '../types/stock';
import type {
  AgentConversationMessage,
  AgentIntentType,
  AgentPortfolioPositionInput,
  AgentPortfolioSnapshot,
  AgentQuickAction,
  ScreenerUIFilterPayload,
} from '../types/agent';
import { queryInversorAIAgent } from '../services/agentRagService';

interface GlobalAIAgentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
  stocks: StockRecord[];
  activeStock: StockRecord | null;
  currentTab: string;
  onSelectStock: (stock: StockRecord) => void;
  onNavigateTab?: (tab: string) => void;
  onApplyScreenerFilters?: (filters: ScreenerUIFilterPayload) => void;
  externalPromptTrigger?: { prompt: string; intent?: AgentIntentType; timestamp: number } | null;
}

const STORAGE_CHAT_KEY = 'inversor_colombia_agent_chat_history_v1';

export const GlobalAIAgentDrawer: React.FC<GlobalAIAgentDrawerProps> = ({
  isOpen,
  onClose,
  onOpen,
  stocks,
  activeStock,
  currentTab,
  onSelectStock,
  onNavigateTab,
  onApplyScreenerFilters,
  externalPromptTrigger,
}) => {
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastSendTimeRef = useRef<number>(0);

  // Ancho dinámico del drawer con persistencia en localStorage
  const [drawerWidth, setDrawerWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('inversor_agent_drawer_width');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 440 && parsed <= 1600) return parsed;
      }
    } catch {}
    return 680; // Ancho predeterminado confortable para tablas cuantitativas
  });

  const [isResizing, setIsResizing] = useState(false);
  const resizeStartXRef = useRef<number>(0);
  const resizeStartWidthRef = useRef<number>(0);

  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartXRef.current = e.clientX;
    resizeStartWidthRef.current = drawerWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = resizeStartXRef.current - moveEvent.clientX; // Desplazar hacia la izquierda agranda el panel
      const newWidth = Math.min(
        Math.max(460, resizeStartWidthRef.current + deltaX),
        Math.min(1450, window.innerWidth - 20)
      );
      setDrawerWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    try {
      localStorage.setItem('inversor_agent_drawer_width', String(drawerWidth));
    } catch {}
  }, [drawerWidth]);

  // Ticker contextual seleccionado dentro del Agente
  const [contextTicker, setContextTicker] = useState<string>(activeStock?.ticker || 'NVDA');

  useEffect(() => {
    if (activeStock?.ticker) {
      setContextTicker(activeStock.ticker);
    }
  }, [activeStock?.ticker]);

  // Historial de conversación persistido en localStorage
  const [messages, setMessages] = useState<AgentConversationMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CHAT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Ignorar errores de lectura
    }
    return [
      {
        id: 'welcome-msg',
        role: 'assistant',
        content: `### 🤖 Bienvenido al Agente Inversor IA\n\nSoy tu **Analista Cuantitativo e Institucional** conectado en tiempo real a la base de datos de **Inversor Colombia (Supabase)**.\n\n**¿Qué puedo hacer por ti hoy?**\n* **Diagnóstico Integral**: Evalúo valoración, flujo de caja libre (FCF), márgenes y ROIC de cualquier acción.\n* **Comparativa de Rivales**: Enfrento cara a cara una empresa contra sus competidores directos del sector.\n* **Lectura Técnica & Hoja de Ruta**: Calculo soportes reales (**SMA 50 / SMA 200**), RSI, RVol, Zona de Entrada, Stop Loss y Targets con *Trailing Breakeven*.\n* **Screener por Lenguaje Natural**: Filtra el mercado escribiendo criterios como *"Empresas tecnológicas con ROIC > 20% y baja deuda"*.\n* **Auditoría de Cartera**: Analizo tus posiciones abiertas en **Mi Cartera**, concentración sectorial y liquidez disponible.`,
        timestamp: new Date().toISOString(),
        modelUsed: 'Motor Cuantitativo Institucional (Supabase RAG)',
        dataSources: ['Supabase stocks_finviz', 'Supabase prices_daily'],
      },
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_CHAT_KEY, JSON.stringify(messages.slice(-25)));
    } catch {
      // Ignorar errores de cuota
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isLoading]);

  // Escuchar disparos externos (ej. botón "Analizar Gráfico con IA" desde otros módulos)
  const lastProcessedTriggerRef = useRef<number>(0);
  useEffect(() => {
    if (
      externalPromptTrigger &&
      externalPromptTrigger.timestamp > lastProcessedTriggerRef.current
    ) {
      lastProcessedTriggerRef.current = externalPromptTrigger.timestamp;
      handleSendQuery(externalPromptTrigger.prompt, externalPromptTrigger.intent);
    }
  }, [externalPromptTrigger]);

  // Leer y consolidar el estado en vivo de Mi Cartera desde localStorage + cotizaciones reales
  const getLivePortfolioSnapshot = (): AgentPortfolioSnapshot => {
    let cashAvailable = 10000;
    try {
      const savedCash = localStorage.getItem('inversor_colombia_portfolio_cash');
      if (savedCash !== null) cashAvailable = Number(savedCash);
    } catch {
      // Ignorar
    }

    interface RawLot {
      id: string;
      ticker: string;
      direction: 'LONG' | 'SHORT';
      shares: number;
      entryPrice: number;
    }

    let rawLots: RawLot[] = [];
    try {
      const savedPos = localStorage.getItem('inversor_colombia_portfolio_positions');
      if (savedPos) rawLots = JSON.parse(savedPos);
    } catch {
      // Ignorar
    }

    // Agrupar lotes por ticker + dirección (promediado institucional igual que en Watchlist.tsx)
    const grouped = new Map<
      string,
      { ticker: string; direction: 'LONG' | 'SHORT'; totalShares: number; totalCost: number }
    >();

    for (const lot of rawLots) {
      const key = `${lot.ticker.toUpperCase()}_${lot.direction}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.totalShares += Number(lot.shares);
        existing.totalCost += Number(lot.shares) * Number(lot.entryPrice);
      } else {
        grouped.set(key, {
          ticker: lot.ticker.toUpperCase(),
          direction: lot.direction,
          totalShares: Number(lot.shares),
          totalCost: Number(lot.shares) * Number(lot.entryPrice),
        });
      }
    }

    const positions: AgentPortfolioPositionInput[] = [];
    let positionsTotalMarketValue = 0;

    for (const item of grouped.values()) {
      if (item.totalShares <= 0) continue;
      const avgEntryPrice = item.totalCost / item.totalShares;
      const stockObj = stocks.find((s) => s.ticker.toUpperCase() === item.ticker);
      const currentPrice = stockObj?.price || avgEntryPrice;
      const marketValue = item.totalShares * currentPrice;
      const unrealizedPnL =
        item.direction === 'LONG'
          ? (currentPrice - avgEntryPrice) * item.totalShares
          : (avgEntryPrice - currentPrice) * item.totalShares;
      const unrealizedPnLPct =
        avgEntryPrice > 0 ? (unrealizedPnL / (avgEntryPrice * item.totalShares)) * 100 : 0;

      positionsTotalMarketValue += marketValue;
      positions.push({
        ticker: item.ticker,
        company: stockObj?.company || item.ticker,
        sector: stockObj?.sector || 'Technology',
        type: item.direction,
        shares: Number(item.totalShares.toFixed(4)),
        avgEntryPrice: Number(avgEntryPrice.toFixed(2)),
        currentPrice: Number(currentPrice.toFixed(2)),
        marketValue: Number(marketValue.toFixed(2)),
        unrealizedPnL: Number(unrealizedPnL.toFixed(2)),
        unrealizedPnLPct: Number(unrealizedPnLPct.toFixed(2)),
      });
    }

    return {
      positions,
      cashAvailable: Number(cashAvailable.toFixed(2)),
      totalValue: Number((cashAvailable + positionsTotalMarketValue).toFixed(2)),
    };
  };

  // Acciones rápidas contextuales en la parte superior del chat
  const quickActions: AgentQuickAction[] = useMemo(() => {
    const t = contextTicker || activeStock?.ticker || 'NVDA';
    return [
      {
        label: `🔍 Diagnóstico ${t}`,
        prompt: `Realiza un diagnóstico institucional completo de ${t}: valoración P/E, flujo de caja libre, ROIC, márgenes y niveles clave.`,
        intent: 'stock_diagnosis',
      },
      {
        label: `⚔️ ${t} vs Rivales`,
        prompt: `Compara cara a cara a ${t} frente a sus principales competidores del sector en múltiplos P/E, Forward P/E, ROIC y crecimiento.`,
        intent: 'peer_comparison',
      },
      {
        label: `📊 Niveles Técnicos ${t}`,
        prompt: `Analiza la estructura técnica de ${t}: medias móviles reales SMA 50 y SMA 200, distancia a ATH, RSI, RVol y calcula Zona de Entrada, Stop Loss y Targets.`,
        intent: 'technical_chart',
      },
      {
        label: `🛡️ DAFO & Foso ${t}`,
        prompt: `Evalúa el foso económico (Moat), matriz DAFO (Fortalezas, Debilidades, Oportunidades y Amenazas) y solvencia de deuda de ${t}.`,
        intent: 'swot_moat',
      },
      {
        label: `💼 Auditar mi Cartera`,
        prompt: `Audita el estado actual de mi cartera: posiciones abiertas, peso porcentual por acción, concentración sectorial y liquidez en efectivo disponible.`,
        intent: 'portfolio_audit',
      },
      {
        label: `🔎 Screener IA: Calidad`,
        prompt: `Busca acciones en el mercado con ROIC > 20%, margen neto alto y baja deuda.`,
        intent: 'screener_query',
      },
    ];
  }, [contextTicker, activeStock?.ticker]);

  // Enviar consulta al motor RAG y Backend Seguro
  const handleSendQuery = async (customPrompt?: string, explicitIntent?: AgentIntentType) => {
    const textToSend = (customPrompt ?? inputMessage).trim();
    if (!textToSend || isLoading) return;

    // Control de frecuencia UI: prevenir doble clic o envíos accidentales en ráfaga
    const now = Date.now();
    if (now - lastSendTimeRef.current < 2000) return;
    lastSendTimeRef.current = now;

    if (!customPrompt) {
      setInputMessage('');
    }

    const userMsg: AgentConversationMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toISOString(),
      intent: explicitIntent,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const portfolioSnapshot = getLivePortfolioSnapshot();
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await queryInversorAIAgent(
        {
          message: textToSend,
          activeTicker: contextTicker || activeStock?.ticker,
          activeTab: currentTab,
          intent: explicitIntent,
          includePortfolio: true,
          portfolioSnapshot,
          conversationHistory: historyPayload,
        },
        stocks
      );

      const assistantMsg: AgentConversationMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        timestamp: response.timestamp,
        intent: response.intentDetected,
        modelUsed: response.modelUsed,
        dataSources: response.dataSources,
        suggestedFollowUps: response.suggestedFollowUps,
        screenerFilterPayload: response.screenerFilterPayload,
        screenerUIFilters: response.screenerUIFilters,
      };

      if (response.ragContextSummary?.tickersAnalyzed?.[0]) {
        setContextTicker(response.ragContextSummary.tickersAnalyzed[0]);
      }

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error('Error en consulta al Agente Inversor IA:', err);
      toast.error('Error al procesar la consulta cuantitativa.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    const resetMsg: AgentConversationMessage = {
      id: `welcome-${Date.now()}`,
      role: 'assistant',
      content: `### 🤖 Historial Reiniciado — Agente Inversor IA\n\nListo para una nueva sesión de análisis cuantitativo. Selecciona una **Acción Rápida** o escribe tu consulta sobre cualquier activo de la base de datos.`,
      timestamp: new Date().toISOString(),
      modelUsed: 'Motor Cuantitativo Institucional (Supabase RAG)',
    };
    setMessages([resetMsg]);
    localStorage.removeItem(STORAGE_CHAT_KEY);
    toast.success('Conversación reiniciada');
  };

  const handleCopyMessage = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    toast.success('Análisis copiado al portapapeles');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Mapa rápido de tickers válidos para hacerlos clicables en las tablas y respuestas
  const validTickersMap = useMemo(() => {
    const map = new Map<string, StockRecord>();
    for (const s of stocks) {
      map.set(s.ticker.toUpperCase(), s);
    }
    return map;
  }, [stocks]);

  // Lista de acciones seleccionables completa para el dropdown (incluyendo contextTicker y activeStock)
  const selectableStocks = useMemo(() => {
    const map = new Map<string, StockRecord>();
    if (contextTicker && validTickersMap.has(contextTicker)) {
      map.set(contextTicker, validTickersMap.get(contextTicker)!);
    }
    if (activeStock?.ticker) {
      map.set(activeStock.ticker, activeStock);
    }
    for (const s of stocks) {
      if (!map.has(s.ticker)) {
        map.set(s.ticker, s);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.ticker.localeCompare(b.ticker));
  }, [stocks, contextTicker, activeStock, validTickersMap]);

  // Renderizador de texto enriquecido (Tablas Markdown, Negritas y Tickers Clicables)
  const renderFormattedInline = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const inner = part.slice(2, -2);
        const cleanTicker = inner.replace(/[^A-Z-]/g, '');
        const matchedStock =
          validTickersMap.get(inner.toUpperCase()) ||
          (inner.includes('(') ? validTickersMap.get(cleanTicker) : undefined);

        if (matchedStock && inner.length <= 18) {
          return (
            <button
              key={idx}
              onClick={() => {
                onSelectStock(matchedStock);
                toast.info(`Abriendo análisis detallado de ${matchedStock.ticker}`);
              }}
              style={{
                background: 'rgba(16, 185, 129, 0.14)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                color: '#34d399',
                fontWeight: 800,
                padding: '1px 6px',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontFamily: 'var(--font-mono)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                margin: '0 2px',
              }}
              title={`Ir al análisis de ${matchedStock.company}`}
            >
              {inner}
              <ExternalLink size={10} />
            </button>
          );
        }

        // Coloreado semántico para variaciones porcentuales o precios
        if (/^\+\d+(\.\d+)?%$/.test(inner)) {
          return (
            <strong key={idx} style={{ color: '#10b981', fontWeight: 800 }}>
              {inner}
            </strong>
          );
        }
        if (/^-\d+(\.\d+)?%$/.test(inner)) {
          return (
            <strong key={idx} style={{ color: '#f87171', fontWeight: 800 }}>
              {inner}
            </strong>
          );
        }

        return (
          <strong key={idx} style={{ color: '#f8fafc', fontWeight: 700 }}>
            {inner}
          </strong>
        );
      }

      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={idx}
            style={{
              background: 'rgba(6, 182, 212, 0.12)',
              color: '#22d3ee',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '0.76rem',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {part.slice(1, -1)}
          </code>
        );
      }

      return <span key={idx}>{part}</span>;
    });
  };

  // Limpia los bloques de auditoría técnica interna para que nunca sean mostrados al usuario
  const cleanUserFacingContent = (raw: string): string => {
    if (!raw) return '';
    let text = raw;
    text = text.replace(/\n*---\s*\n+####\s*🛡️\s*Auditoría de Fuentes[\s\S]*?(?=\n###|\n##|$)/gi, '');
    text = text.replace(/####\s*🛡️\s*Auditoría de Fuentes[\s\S]*?(?=\n###|\n##|$)/gi, '');
    text = text.replace(/🛡️\s*Auditoría de Fuentes[\s\S]*?(?=\n###|\n##|$)/gi, '');
    text = text.replace(/\*{1,2}Dictamen de Auditoría\*{1,2}:[\s\S]*?(?=\n###|\n##|$)/gi, '');
    text = text.replace(/\*{1,2}AUDIT STATUS\*{1,2}:?[\s\S]*?(?=\n###|\n##|$)/gi, '');
    text = text.replace(/\n*---\s*$/g, '');
    return text.trim();
  };

  const renderMarkdownContent = (content: string) => {
    const cleaned = cleanUserFacingContent(content);
    const lines = cleaned.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i].trim();

      // Saltos vacíos
      if (!line) {
        i++;
        continue;
      }

      // Detectar bloque de tabla Markdown
      if (line.startsWith('|') && line.endsWith('|')) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          tableLines.push(lines[i].trim());
          i++;
        }

        if (tableLines.length >= 2) {
          const headers = tableLines[0]
            .split('|')
            .slice(1, -1)
            .map((h) => h.trim());
          const dataRows = tableLines.slice(2).map((r) =>
            r
              .split('|')
              .slice(1, -1)
              .map((c) => c.trim())
          );

          elements.push(
            <div
              key={`table-${i}`}
              style={{
                overflowX: 'auto',
                margin: '10px 0',
                borderRadius: '8px',
                border: '1px solid rgba(148, 163, 184, 0.18)',
                background: 'rgba(7, 11, 20, 0.75)',
              }}
            >
              <table
                style={{
                  width: '100%',
                  minWidth: '600px',
                  borderCollapse: 'collapse',
                  fontSize: '0.75rem',
                  textAlign: 'left',
                }}
              >
                <thead>
                  <tr style={{ background: 'rgba(15, 23, 42, 0.95)', borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>
                    {headers.map((h, hIdx) => (
                      <th
                        key={hIdx}
                        style={{
                          padding: '7px 8px',
                          color: '#94a3b8',
                          fontWeight: 700,
                          fontSize: '0.7rem',
                          textTransform: 'uppercase',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataRows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      style={{
                        borderBottom:
                          rIdx < dataRows.length - 1 ? '1px solid rgba(255, 255, 255, 0.05)' : 'none',
                        background: rIdx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)',
                      }}
                    >
                      {row.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          style={{
                            padding: '6px 8px',
                            color: '#e2e8f0',
                            whiteSpace: cIdx === 0 ? 'nowrap' : 'normal',
                          }}
                        >
                          {renderFormattedInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
          continue;
        }
      }

      // Encabezados ### y ####
      if (line.startsWith('### ')) {
        elements.push(
          <h3
            key={`h3-${i}`}
            style={{
              fontSize: '0.96rem',
              fontWeight: 800,
              color: '#ffffff',
              margin: '8px 0 6px 0',
              paddingBottom: '6px',
              borderBottom: '1px solid rgba(16, 185, 129, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {renderFormattedInline(line.replace('### ', ''))}
          </h3>
        );
        i++;
        continue;
      }

      // Ocultar bloques de auditoría técnica interna (el usuario no debe verlos)
      if (
        line.startsWith('#### 🛡️ Auditoría de Fuentes') ||
        line.toLowerCase().includes('auditoría de fuentes') ||
        line.toLowerCase().includes('audit status: approved')
      ) {
        i++;
        while (i < lines.length && (lines[i].trim().startsWith('* ') || lines[i].trim().startsWith('- ') || lines[i].trim() === '')) {
          i++;
        }
        continue;
      }

      if (line.startsWith('#### ')) {
        elements.push(
          <h4
            key={`h4-${i}`}
            style={{
              fontSize: '0.84rem',
              fontWeight: 700,
              color: '#38bdf8',
              margin: '10px 0 4px 0',
              letterSpacing: '0.01em',
            }}
          >
            {renderFormattedInline(line.replace('#### ', ''))}
          </h4>
        );
        i++;
        continue;
      }

      // Viñetas (* o -)
      if (line.startsWith('* ') || line.startsWith('- ')) {
        elements.push(
          <div
            key={`li-${i}`}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '7px',
              margin: '4px 0',
              fontSize: '0.82rem',
              lineHeight: 1.5,
              color: '#cbd5e1',
              paddingLeft: '4px',
            }}
          >
            <span style={{ color: '#10b981', fontWeight: 900, marginTop: '1px' }}>•</span>
            <div style={{ flex: 1 }}>{renderFormattedInline(line.slice(2))}</div>
          </div>
        );
        i++;
        continue;
      }

      // Listas numeradas (1. , 2. )
      if (/^\d+\.\s/.test(line)) {
        const numMatch = line.match(/^(\d+\.)\s(.*)$/);
        if (numMatch) {
          elements.push(
            <div
              key={`num-${i}`}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '7px',
                margin: '5px 0',
                fontSize: '0.82rem',
                lineHeight: 1.5,
                color: '#cbd5e1',
              }}
            >
              <span style={{ color: '#38bdf8', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                {numMatch[1]}
              </span>
              <div style={{ flex: 1 }}>{renderFormattedInline(numMatch[2])}</div>
            </div>
          );
          i++;
          continue;
        }
      }

      // Párrafo normal
      elements.push(
        <p
          key={`p-${i}`}
          style={{
            margin: '5px 0',
            fontSize: '0.82rem',
            lineHeight: 1.55,
            color: '#cbd5e1',
          }}
        >
          {renderFormattedInline(line)}
        </p>
      );
      i++;
    }

    return elements;
  };

  return (
    <>
      {/* 1. BOTÓN FLOTANTE GLOBAL (Cuando el Drawer está cerrado) */}
      {!isOpen && (
        <button
          id="floating-ai-agent-trigger"
          onClick={onOpen}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 90,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 18px',
            borderRadius: '999px',
            background: 'linear-gradient(135deg, #059669 0%, #0284c7 100%)',
            border: '1px solid rgba(52, 211, 153, 0.45)',
            boxShadow: '0 10px 30px -5px rgba(16, 185, 129, 0.5), 0 0 15px rgba(6, 182, 212, 0.35)',
            color: '#ffffff',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
          }}
          title="Abrir Agente Inversor IA"
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.16)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <Bot size={19} color="#fff" />
            <span
              style={{
                position: 'absolute',
                top: '-1px',
                right: '-1px',
                width: '9px',
                height: '9px',
                borderRadius: '50%',
                background: '#34d399',
                border: '2px solid #064e3b',
              }}
            />
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '0.84rem', fontWeight: 800, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: '5px' }}>
              Agente Inversor IA
              <Sparkles size={13} color="#fde047" />
            </div>
            <div style={{ fontSize: '0.68rem', color: 'rgba(255, 255, 255, 0.85)', fontWeight: 600 }}>
              {contextTicker ? `Activo: ${contextTicker} · Consultar RAG` : 'Consultor Cuantitativo en Vivo'}
            </div>
          </div>
        </button>
      )}

      {/* 2. OVERLAY & DRAWER LATERAL DESLIZANTE */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 120,
            display: 'flex',
            justifyContent: 'flex-end',
            background: 'rgba(3, 7, 18, 0.55)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={onClose}
        >
          <aside
            style={{
              width: `min(${drawerWidth}px, 100vw)`,
              height: '100vh',
              background: 'linear-gradient(180deg, #0b1120 0%, #070b14 100%)',
              borderLeft: isResizing ? '2px solid var(--accent-cyan)' : '1px solid rgba(56, 189, 248, 0.22)',
              boxShadow: '-12px 0 40px rgba(0, 0, 0, 0.75)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
              userSelect: isResizing ? 'none' : 'auto',
              transition: isResizing ? 'none' : 'width 0.18s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Tirador interactivo para redimensionar arrastrando */}
            <div
              onMouseDown={handleMouseDownResize}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: '10px',
                cursor: 'col-resize',
                zIndex: 100,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isResizing ? 'rgba(6, 182, 212, 0.25)' : 'transparent',
              }}
              title="Arrastra para ajustar el ancho de la ventana"
            >
              <div
                style={{
                  width: '3px',
                  height: '42px',
                  borderRadius: '3px',
                  background: isResizing ? 'var(--accent-cyan)' : 'rgba(148, 163, 184, 0.4)',
                }}
              />
            </div>
            {/* CABECERA DEL DRAWER */}
            <div
              style={{
                padding: '16px 20px',
                background: 'rgba(15, 23, 42, 0.92)',
                borderBottom: '1px solid rgba(148, 163, 184, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #10b981 0%, #0284c7 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 16px rgba(16, 185, 129, 0.35)',
                  }}
                >
                  <Bot size={22} color="#ffffff" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <span style={{ fontWeight: 800, fontSize: '1rem', color: '#ffffff' }}>
                      Agente Inversor IA
                    </span>
                    <span
                      style={{
                        fontSize: '0.62rem',
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#34d399',
                        border: '1px solid rgba(16, 185, 129, 0.35)',
                      }}
                    >
                      RAG EN VIVO
                    </span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                    <Database size={11} color="#38bdf8" />
                    Conectado a Supabase ({stocks.length} activos sincronizados)
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Selectores de ancho preestablecido */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '7px',
                  padding: '2px',
                  border: '1px solid rgba(255, 255, 255, 0.08)'
                }}>
                  <button
                    onClick={() => setDrawerWidth(540)}
                    style={{
                      padding: '3px 7px',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      background: drawerWidth <= 620 ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                      color: drawerWidth <= 620 ? '#38bdf8' : '#94a3b8',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer'
                    }}
                    title="Ancho Compacto (540px)"
                  >
                    540px
                  </button>
                  <button
                    onClick={() => setDrawerWidth(880)}
                    style={{
                      padding: '3px 7px',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      background: drawerWidth > 620 && drawerWidth < 1050 ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                      color: drawerWidth > 620 && drawerWidth < 1050 ? '#38bdf8' : '#94a3b8',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer'
                    }}
                    title="Ancho Amplio (880px) para Tablas"
                  >
                    880px
                  </button>
                  <button
                    onClick={() => setDrawerWidth(1200)}
                    style={{
                      padding: '3px 7px',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      background: drawerWidth >= 1050 ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                      color: drawerWidth >= 1050 ? '#38bdf8' : '#94a3b8',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer'
                    }}
                    title="Ancho Máximo (1200px)"
                  >
                    Max
                  </button>
                </div>

                {/* Botón toggle de alternar modo compacto / expandido */}
                <button
                  onClick={() => setDrawerWidth((prev) => (prev > 700 ? 540 : 920))}
                  className="btn btn-secondary"
                  style={{ padding: '6px 8px' }}
                  title={drawerWidth > 700 ? 'Reducir a tamaño compacto (540px)' : 'Expandir ventana del agente'}
                >
                  {drawerWidth > 700 ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>

                <button
                  onClick={handleClearHistory}
                  className="btn btn-secondary"
                  style={{ padding: '6px 8px', fontSize: '0.72rem' }}
                  title="Limpiar conversación"
                >
                  <Trash2 size={14} />
                </button>
                <button
                  onClick={onClose}
                  className="btn btn-secondary"
                  style={{ padding: '6px 8px' }}
                  title="Cerrar panel"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* BARRA DE CONTEXTO DE ACTIVO Y SELECTOR RÁPIDO */}
            <div
              style={{
                padding: '10px 20px',
                background: 'rgba(7, 11, 20, 0.9)',
                borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>
                  Ticker en Foco:
                </span>
                <select
                  value={contextTicker}
                  onChange={(e) => {
                    const chosen = e.target.value;
                    setContextTicker(chosen);
                    const st = validTickersMap.get(chosen);
                    if (st) onSelectStock(st);
                  }}
                  style={{
                    background: '#0f172a',
                    color: '#34d399',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    fontSize: '0.76rem',
                    fontWeight: 800,
                    fontFamily: 'var(--font-mono)',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {selectableStocks.map((s) => (
                    <option key={s.ticker} value={s.ticker}>
                      {s.ticker} — {s.company?.slice(0, 22)} (${s.price?.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              {contextTicker && validTickersMap.get(contextTicker) && (
                <button
                  onClick={() => {
                    const st = validTickersMap.get(contextTicker);
                    if (st) onSelectStock(st);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#38bdf8',
                    fontSize: '0.73rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  Ver Informe 11 Secciones de {contextTicker}
                  <ChevronRight size={13} />
                </button>
              )}
            </div>

            {/* BARRA DE ACCIONES RÁPIDAS (CHIPS CONTEXTUALES) */}
            <div
              style={{
                padding: '10px 16px',
                background: 'rgba(15, 23, 42, 0.55)',
                borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                display: 'flex',
                gap: '6px',
                overflowX: 'auto',
                flexShrink: 0,
              }}
            >
              {quickActions.map((qa, idx) => (
                <button
                  key={idx}
                  disabled={isLoading}
                  onClick={() => handleSendQuery(qa.prompt, qa.intent)}
                  style={{
                    whiteSpace: 'nowrap',
                    padding: '5px 10px',
                    borderRadius: '999px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    background: 'rgba(30, 41, 59, 0.85)',
                    border: '1px solid rgba(148, 163, 184, 0.22)',
                    color: '#e2e8f0',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#10b981';
                    e.currentTarget.style.background = 'rgba(16, 185, 129, 0.14)';
                    e.currentTarget.style.color = '#fff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.22)';
                    e.currentTarget.style.background = 'rgba(30, 41, 59, 0.85)';
                    e.currentTarget.style.color = '#e2e8f0';
                  }}
                >
                  {qa.label}
                </button>
              ))}
            </div>

            {/* ÁREA CENTRAL DE MENSAJES DEL CHAT */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isUser ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <div
                      style={{
                        maxWidth: isUser ? '86%' : '100%',
                        width: isUser ? 'auto' : '100%',
                        padding: isUser ? '10px 14px' : '14px 16px',
                        borderRadius: isUser ? '14px 14px 2px 14px' : '12px',
                        background: isUser
                          ? 'linear-gradient(135deg, #059669 0%, #0284c7 100%)'
                          : 'rgba(15, 23, 42, 0.88)',
                        border: isUser
                          ? '1px solid rgba(52, 211, 153, 0.35)'
                          : '1px solid rgba(148, 163, 184, 0.16)',
                        color: '#ffffff',
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
                      }}
                    >
                      {!isUser && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '8px',
                            paddingBottom: '6px',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <ShieldCheck size={13} color="#10b981" />
                            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8' }}>
                              {msg.modelUsed || 'Agente Inversor IA'}
                            </span>
                          </div>
                          <button
                            onClick={() => handleCopyMessage(msg.id, msg.content)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#94a3b8',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.68rem',
                            }}
                            title="Copiar respuesta"
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check size={12} color="#10b981" />
                                <span style={{ color: '#10b981' }}>Copiado</span>
                              </>
                            ) : (
                              <>
                                <Copy size={12} />
                                <span>Copiar</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}

                      {isUser ? (
                        <div style={{ fontSize: '0.84rem', lineHeight: 1.5, fontWeight: 500 }}>
                          {msg.content}
                        </div>
                      ) : (
                        <div>{renderMarkdownContent(msg.content)}</div>
                      )}

                      {/* Botón directo al Screener o Cartera según la intención */}
                      {!isUser && msg.intent === 'screener_query' && onNavigateTab && (
                        <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                          <button
                            onClick={() => {
                              if (msg.screenerUIFilters && onApplyScreenerFilters) {
                                onApplyScreenerFilters(msg.screenerUIFilters);
                              }
                              onNavigateTab('screener');
                              onClose();
                            }}
                            className="btn"
                            style={{
                              width: '100%',
                              justifyContent: 'center',
                              fontSize: '0.76rem',
                              fontWeight: 700,
                              padding: '7px 12px',
                              background: 'rgba(16, 185, 129, 0.16)',
                              border: '1px solid rgba(16, 185, 129, 0.4)',
                              color: '#34d399',
                            }}
                          >
                            <Layers size={13} color="#34d399" />
                            Aplicar estos Filtros en la Tabla del Screener Acciones
                          </button>
                        </div>
                      )}

                      {!isUser && msg.intent === 'portfolio_audit' && onNavigateTab && (
                        <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                          <button
                            onClick={() => {
                              onNavigateTab('watchlist');
                              onClose();
                            }}
                            className="btn btn-secondary"
                            style={{ width: '100%', justifyContent: 'center', fontSize: '0.75rem', padding: '6px 12px' }}
                          >
                            <Briefcase size={13} color="#38bdf8" />
                            Ir a Mi Cartera para Gestionar Posiciones
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Sugerencias de seguimiento contextuales en el último mensaje del asistente */}
                    {!isUser &&
                      msg.suggestedFollowUps &&
                      msg.suggestedFollowUps.length > 0 &&
                      msg.id === messages[messages.length - 1]?.id && (
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '6px',
                            marginTop: '8px',
                          }}
                        >
                          {msg.suggestedFollowUps.slice(0, 3).map((follow, fIdx) => (
                            <button
                              key={fIdx}
                              disabled={isLoading}
                              onClick={() => handleSendQuery(follow.prompt, follow.intent)}
                              style={{
                                padding: '4px 9px',
                                borderRadius: '6px',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                background: 'rgba(16, 185, 129, 0.08)',
                                border: '1px solid rgba(16, 185, 129, 0.28)',
                                color: '#34d399',
                                cursor: 'pointer',
                              }}
                            >
                              {follow.label}
                            </button>
                          ))}
                        </div>
                      )}
                  </div>
                );
              })}

              {isLoading && (
                <div
                  style={{
                    padding: '14px 16px',
                    borderRadius: '12px',
                    background: 'rgba(15, 23, 42, 0.85)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    color: '#38bdf8',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                  }}
                >
                  <Loader2 size={16} className="animate-spin" />
                  <span>
                    Extrayendo métricas verificadas de Supabase y calculando estructura institucional...
                  </span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* CAJA DE ENTRADA DE CONSULTA */}
            <div
              style={{
                padding: '14px 18px',
                background: 'rgba(15, 23, 42, 0.96)',
                borderTop: '1px solid rgba(148, 163, 184, 0.16)',
              }}
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendQuery();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#070b14',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  borderRadius: '10px',
                  padding: '8px 12px',
                }}
              >
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={`Pregunta sobre ${contextTicker || 'cualquier acción'}, rivales, screener o tu cartera...`}
                  disabled={isLoading}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#ffffff',
                    fontSize: '0.83rem',
                    fontFamily: 'inherit',
                  }}
                />
                <button
                  type="submit"
                  disabled={isLoading || !inputMessage.trim()}
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    background:
                      isLoading || !inputMessage.trim()
                        ? 'rgba(148, 163, 184, 0.15)'
                        : 'linear-gradient(135deg, #10b981 0%, #0284c7 100%)',
                    border: 'none',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: isLoading || !inputMessage.trim() ? 'not-allowed' : 'pointer',
                  }}
                  title="Enviar consulta"
                >
                  <Send size={15} />
                </button>
              </form>
              <div
                style={{
                  marginTop: '6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.67rem',
                  color: '#64748b',
                }}
              >
                <span>Datos auditados en tiempo real · Cero configuración de claves</span>
                <span>Haz clic en cualquier ticker de la respuesta para abrir su informe</span>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
};
