import React, { useState, useRef, useMemo } from 'react';

export interface CandleDataPoint {
  date: string;
  displayDate: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  price?: number;
  volume?: number;
}

export interface ChartAlert {
  id: string;
  targetPrice: number;
  condition: 'ABOVE' | 'BELOW';
  note?: string;
}

interface CandlestickChartProps {
  data: CandleDataPoint[];
  alerts?: ChartAlert[];
  height?: number;
  onSelectPrice?: (price: number) => void;
}

export const CandlestickChart: React.FC<CandlestickChartProps> = ({
  data,
  alerts = [],
  height = 340,
  onSelectPrice
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const padding = { top: 20, right: 65, bottom: 28, left: 15 };

  // Calcular mínimos y máximos de precio
  const { minPrice, maxPrice, priceRange } = useMemo(() => {
    if (!data.length) return { minPrice: 0, maxPrice: 100, priceRange: 100 };

    let min = Infinity;
    let max = -Infinity;

    for (const d of data) {
      const h = d.high ?? d.price ?? 0;
      const l = d.low ?? d.price ?? 0;
      if (h > max) max = h;
      if (l < min && l > 0) min = l;
    }

    if (min === Infinity || max === -Infinity) {
      return { minPrice: 0, maxPrice: 100, priceRange: 100 };
    }

    // Margen del 3% arriba y abajo
    const span = max - min || 1;
    const finalMin = Math.max(0, min - span * 0.04);
    const finalMax = max + span * 0.04;

    return {
      minPrice: finalMin,
      maxPrice: finalMax,
      priceRange: finalMax - finalMin
    };
  }, [data]);

  // Líneas de cuadrícula horizontal (precios)
  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    const count = 5;
    for (let i = 0; i <= count; i++) {
      ticks.push(minPrice + (priceRange / count) * i);
    }
    return ticks;
  }, [minPrice, priceRange]);

  // Ticks de fechas horizontales
  const xTicks = useMemo(() => {
    if (data.length <= 6) return data.map((d, i) => ({ index: i, date: d.displayDate }));
    const count = 6;
    const step = Math.floor(data.length / (count - 1));
    const result = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.min(data.length - 1, i * step);
      result.push({ index: idx, date: data[idx]?.displayDate || '' });
    }
    return result;
  }, [data]);

  // Manejo de hover
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setMousePos({ x, y });

    const plotWidth = rect.width - padding.left - padding.right;
    if (x >= padding.left && x <= rect.width - padding.right && data.length > 0) {
      const relX = x - padding.left;
      const slotWidth = plotWidth / data.length;
      const idx = Math.min(data.length - 1, Math.max(0, Math.floor(relX / slotWidth)));
      setHoverIndex(idx);
    } else {
      setHoverIndex(null);
    }
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
    setMousePos(null);
  };

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onSelectPrice) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const plotHeight = height - padding.top - padding.bottom;

    if (y >= padding.top && y <= height - padding.bottom) {
      const normY = (y - padding.top) / plotHeight;
      const clickedPrice = maxPrice - normY * priceRange;
      onSelectPrice(Number(clickedPrice.toFixed(2)));
    }
  };

  const hoveredCandle = hoverIndex !== null ? data[hoverIndex] : null;

  return (
    <div 
      ref={containerRef} 
      style={{ 
        position: 'relative', 
        width: '100%', 
        height, 
        background: 'rgba(7, 9, 14, 0.4)', 
        borderRadius: '10px',
        border: '1px solid var(--border-subtle)',
        userSelect: 'none'
      }}
    >
      {/* Tarjeta de Información flotante de la vela */}
      <div style={{
        position: 'absolute',
        top: '8px',
        left: '12px',
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        fontSize: '0.78rem',
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(8px)',
        padding: '5px 12px',
        borderRadius: '6px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        color: 'var(--text-secondary)'
      }}>
        {hoveredCandle ? (
          <>
            <span>Fecha: <strong style={{ color: '#fff' }}>{hoveredCandle.date}</strong></span>
            <span>Apertura: <strong style={{ color: '#fff' }}>${(hoveredCandle.open ?? hoveredCandle.price ?? 0).toFixed(2)}</strong></span>
            <span>Máximo: <strong style={{ color: '#10b981' }}>${(hoveredCandle.high ?? hoveredCandle.price ?? 0).toFixed(2)}</strong></span>
            <span>Mínimo: <strong style={{ color: '#ef4444' }}>${(hoveredCandle.low ?? hoveredCandle.price ?? 0).toFixed(2)}</strong></span>
            <span>Cierre: <strong style={{ color: (hoveredCandle.close ?? 0) >= (hoveredCandle.open ?? 0) ? '#10b981' : '#ef4444' }}>
              ${(hoveredCandle.close ?? hoveredCandle.price ?? 0).toFixed(2)}
            </strong></span>
            {hoveredCandle.volume && (
              <span>Vol: <strong style={{ color: '#f59e0b' }}>{hoveredCandle.volume.toLocaleString('es-CO')}</strong></span>
            )}
          </>
        ) : (
          <span>Pasa el cursor sobre las velas para ver <strong>OHLCV</strong> detallado</span>
        )}
      </div>

      <svg
        width="100%"
        height={height}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        style={{ cursor: onSelectPrice ? 'crosshair' : 'default', display: 'block' }}
      >
        {/* Renderizado responsivo usando porcentajes calculados */}
        {containerRef.current && (() => {
          const totalWidth = containerRef.current.clientWidth;
          const plotWidth = totalWidth - padding.left - padding.right;
          const plotHeight = height - padding.top - padding.bottom;
          const candleSlot = plotWidth / (data.length || 1);
          const candleBodyWidth = Math.max(1.8, Math.min(12, candleSlot * 0.72));

          const getY = (val: number) => {
            const ratio = (val - minPrice) / (priceRange || 1);
            return padding.top + plotHeight * (1 - ratio);
          };

          return (
            <g>
              {/* Cuadrícula horizontal (precios) */}
              {yTicks.map((tick, i) => {
                const y = getY(tick);
                return (
                  <g key={i}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={totalWidth - padding.right}
                      y2={y}
                      stroke="rgba(255, 255, 255, 0.05)"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={totalWidth - padding.right + 8}
                      y={y + 4}
                      fill="var(--text-muted)"
                      fontSize="10"
                      fontFamily="monospace"
                    >
                      ${tick.toFixed(2)}
                    </text>
                  </g>
                );
              })}

              {/* Cuadrícula vertical (fechas) */}
              {xTicks.map((tick, i) => {
                const x = padding.left + (tick.index + 0.5) * candleSlot;
                return (
                  <g key={i}>
                    <line
                      x1={x}
                      y1={padding.top}
                      x2={x}
                      y2={height - padding.bottom}
                      stroke="rgba(255, 255, 255, 0.03)"
                      strokeDasharray="2 2"
                    />
                    <text
                      x={x}
                      y={height - padding.bottom + 18}
                      fill="var(--text-muted)"
                      fontSize="10"
                      textAnchor="middle"
                    >
                      {tick.date}
                    </text>
                  </g>
                );
              })}

              {/* Velas Japonesas */}
              {data.map((d, i) => {
                const open = d.open ?? d.price ?? 0;
                const high = d.high ?? d.price ?? 0;
                const low = d.low ?? d.price ?? 0;
                const close = d.close ?? d.price ?? 0;

                const isBullish = close >= open;
                const color = isBullish ? '#10b981' : '#ef4444';

                const xCenter = padding.left + (i + 0.5) * candleSlot;
                const yHigh = getY(high);
                const yLow = getY(low);
                const yOpen = getY(open);
                const yClose = getY(close);

                const yBodyTop = Math.min(yOpen, yClose);
                const bodyHeight = Math.max(2, Math.abs(yClose - yOpen));

                const isHovered = hoverIndex === i;

                return (
                  <g key={i} opacity={hoverIndex === null || isHovered ? 1 : 0.75}>
                    {/* Mecha (Wick) */}
                    <line
                      x1={xCenter}
                      y1={yHigh}
                      x2={xCenter}
                      y2={yLow}
                      stroke={color}
                      strokeWidth={isHovered ? 2 : 1}
                    />
                    {/* Cuerpo (Body) */}
                    <rect
                      x={xCenter - candleBodyWidth / 2}
                      y={yBodyTop}
                      width={candleBodyWidth}
                      height={bodyHeight}
                      fill={color}
                      stroke={color}
                      strokeWidth={1}
                      rx={1}
                    />
                  </g>
                );
              })}

              {/* Líneas de Alertas Activas */}
              {alerts.map(alert => {
                const yAlert = getY(alert.targetPrice);
                if (yAlert < padding.top || yAlert > height - padding.bottom) return null;

                return (
                  <g key={alert.id}>
                    <line
                      x1={padding.left}
                      y1={yAlert}
                      x2={totalWidth - padding.right}
                      y2={yAlert}
                      stroke="#f59e0b"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                    />
                    {/* Badge en el eje derecho */}
                    <rect
                      x={totalWidth - padding.right + 2}
                      y={yAlert - 9}
                      width={60}
                      height={18}
                      fill="#f59e0b"
                      rx={3}
                    />
                    <text
                      x={totalWidth - padding.right + 32}
                      y={yAlert + 4}
                      fill="#000"
                      fontSize="10"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      ${alert.targetPrice.toFixed(1)}
                    </text>
                  </g>
                );
              })}

              {/* Crosshair interactivo al hacer hover */}
              {mousePos && hoverIndex !== null && (
                <g>
                  {/* Línea vertical */}
                  <line
                    x1={padding.left + (hoverIndex + 0.5) * candleSlot}
                    y1={padding.top}
                    x2={padding.left + (hoverIndex + 0.5) * candleSlot}
                    y2={height - padding.bottom}
                    stroke="rgba(255, 255, 255, 0.4)"
                    strokeDasharray="2 2"
                  />
                  {/* Línea horizontal */}
                  <line
                    x1={padding.left}
                    y1={mousePos.y}
                    x2={totalWidth - padding.right}
                    y2={mousePos.y}
                    stroke="rgba(255, 255, 255, 0.4)"
                    strokeDasharray="2 2"
                  />
                </g>
              )}
            </g>
          );
        })()}
      </svg>
    </div>
  );
};
