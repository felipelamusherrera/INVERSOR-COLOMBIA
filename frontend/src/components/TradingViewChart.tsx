import React, { useEffect, useRef, memo } from 'react';

interface TradingViewChartProps {
  ticker: string;
  companyName?: string;
  theme?: 'dark' | 'light';
  height?: number | string;
}

export const TradingViewChart: React.FC<TradingViewChartProps> = memo(({
  ticker,
  companyName,
  theme = 'dark',
  height = 640
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const numericHeight = typeof height === 'number' ? height : parseInt(String(height)) || 640;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Limpiar contenido previo para recrear el widget al cambiar de ticker
    container.innerHTML = '';

    const widgetWrapper = document.createElement('div');
    widgetWrapper.className = 'tradingview-widget-container__widget';
    widgetWrapper.style.height = `${numericHeight - 36}px`;
    widgetWrapper.style.minHeight = `${numericHeight - 36}px`;
    widgetWrapper.style.width = '100%';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;

    // Configuración completa de TradingView con dimensiones fijas de 640px para evitar colapsos
    const widgetConfig = {
      width: "100%",
      height: numericHeight - 36,
      autosize: false,
      symbol: ticker,
      interval: "D",
      timezone: "America/New_York",
      theme: theme,
      style: "1", // 1 = Velas Japonesas (Candlesticks)
      locale: "es",
      enable_publishing: false,
      allow_symbol_change: true,
      hide_side_toolbar: false, // Desbloquea Barra de Dibujos, Fibonacci, Geometrías y Regla
      withdateranges: true,
      hide_volume: false,
      support_host: "https://www.tradingview.com",
      studies: [
        "RSI@tv-basicstudies",
        "MASimple@tv-basicstudies"
      ],
      toolbar_bg: "#07090e",
      backgroundColor: "rgba(10, 14, 23, 1)",
      gridColor: "rgba(255, 255, 255, 0.05)",
      details: true,
      hotlist: true,
      calendar: false
    };

    script.innerHTML = JSON.stringify(widgetConfig);

    container.appendChild(widgetWrapper);
    container.appendChild(script);

    return () => {
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [ticker, theme, numericHeight]);

  return (
    <div style={{ width: '100%' }}>
      {/* Cabecera descriptiva */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        background: 'rgba(15, 23, 42, 0.65)',
        border: '1px solid var(--border-subtle)',
        borderBottom: 'none',
        borderTopLeftRadius: '12px',
        borderTopRightRadius: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            fontSize: '0.72rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            padding: '3px 8px',
            borderRadius: '4px',
            background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
            color: '#fff'
          }}>
            TradingView Pro
          </span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Herramientas activas: <strong>Velas Japonesas, Retrocesos Fibonacci, Líneas de Tendencia & Indicadores</strong>
          </span>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {ticker} {companyName ? `· ${companyName}` : ''}
        </div>
      </div>

      {/* Contenedor del Widget con Altura Fija de 640px */}
      <div 
        className="tradingview-widget-container" 
        ref={containerRef} 
        style={{ 
          height: `${numericHeight}px`,
          minHeight: `${numericHeight}px`,
          width: '100%', 
          borderBottomLeftRadius: '12px', 
          borderBottomRightRadius: '12px', 
          overflow: 'hidden', 
          border: '1px solid var(--border-subtle)',
          background: '#07090e'
        }}
      >
        <div 
          className="tradingview-widget-container__widget" 
          style={{ 
            height: `${numericHeight - 36}px`, 
            minHeight: `${numericHeight - 36}px`, 
            width: '100%' 
          }} 
        />
      </div>
    </div>
  );
});
