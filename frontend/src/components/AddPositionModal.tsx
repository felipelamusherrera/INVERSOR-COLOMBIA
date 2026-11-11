import React, { useState } from 'react';
import { X, Briefcase, TrendingUp, TrendingDown, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { addPortfolioPosition, type PortfolioPosition } from '../utils/portfolioManager';
import type { StockRecord } from '../types/stock';

interface AddPositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  stock?: StockRecord | null;
  onSuccess?: (position: PortfolioPosition) => void;
}

export const AddPositionModal: React.FC<AddPositionModalProps> = ({
  isOpen,
  onClose,
  stock,
  onSuccess,
}) => {
  if (!isOpen) return null;

  const defaultPrice = stock?.price ?? 100;
  const [ticker, setTicker] = useState(stock?.ticker || 'NVDA');
  const [direction, setDirection] = useState<'LONG' | 'SHORT'>('LONG');
  const [shares, setShares] = useState<number>(() => {
    // Calcular lote sugerido de $30 USD (convicción media) o mínimo 1 acción
    if (defaultPrice > 0) {
      const calc = Number((30 / defaultPrice).toFixed(3));
      return calc >= 1 ? Math.round(calc) : calc;
    }
    return 10;
  });
  const [entryPrice, setEntryPrice] = useState<number>(defaultPrice);
  const [entryDate, setEntryDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState<string>(
    stock ? `Entrada swing en ${stock.company} (${stock.sector})` : 'Entrada táctica institucional'
  );
  const [stopLoss, setStopLoss] = useState<number>(Number((defaultPrice * 0.952).toFixed(2)));
  const [target1, setTarget1] = useState<number>(Number((defaultPrice * 1.095).toFixed(2)));
  const [target2, setTarget2] = useState<number>(Number((defaultPrice * 1.220).toFixed(2)));

  const handlePriceChange = (val: number) => {
    setEntryPrice(val);
    setStopLoss(Number((val * 0.952).toFixed(2)));
    setTarget1(Number((val * 1.095).toFixed(2)));
    setTarget2(Number((val * 1.220).toFixed(2)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker.trim()) {
      toast.error('Por favor ingresa un ticker válido');
      return;
    }
    if (shares <= 0 || entryPrice <= 0) {
      toast.error('La cantidad de acciones y el precio deben ser mayores a cero');
      return;
    }

    const created = addPortfolioPosition({
      ticker: ticker.toUpperCase().trim(),
      direction,
      shares,
      entryPrice,
      entryDate,
      notes,
      stopLoss,
      target1,
      target2,
      convictionTier: '$30.00 USD (Convicción Media)',
    });

    toast.success(`¡Posición ${direction} en ${created.ticker} agregada con éxito a Mi Cartera!`);
    if (onSuccess) onSuccess(created);
    onClose();
  };

  const totalCost = Number((shares * entryPrice).toFixed(2));

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(3, 7, 18, 0.78)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#0b1320',
          border: '1px solid var(--border-medium)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '520px',
          padding: '28px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--accent-green)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            >
              <Briefcase size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                Registrar Posición en Cartera
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                {stock ? `${stock.company} (${stock.ticker})` : 'Ingreso oficial a Mi Cartera'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Ticker */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' }}>
              Ticker de la Acción
            </label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="ej: NVDA, AAPL, MU"
              required
              className="font-mono"
              style={{
                width: '100%',
                background: '#070b14',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '10px 14px',
                color: '#fff',
                fontSize: '1rem',
                fontWeight: 800,
              }}
            />
          </div>

          {/* Dirección LONG / SHORT */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
              Estrategia / Dirección de la Posición
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDirection('LONG')}
                style={{
                  padding: '10px',
                  borderRadius: '8px',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  border: direction === 'LONG' ? '2px solid var(--accent-green)' : '1px solid var(--border-subtle)',
                  background: direction === 'LONG' ? 'rgba(16, 185, 129, 0.2)' : '#070b14',
                  color: direction === 'LONG' ? 'var(--accent-green)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <TrendingUp size={16} /> LONG (Compra / Alcista)
              </button>

              <button
                type="button"
                onClick={() => setDirection('SHORT')}
                style={{
                  padding: '10px',
                  borderRadius: '8px',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  border: direction === 'SHORT' ? '2px solid var(--accent-red)' : '1px solid var(--border-subtle)',
                  background: direction === 'SHORT' ? 'rgba(239, 68, 68, 0.2)' : '#070b14',
                  color: direction === 'SHORT' ? 'var(--accent-red)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <TrendingDown size={16} /> SHORT (Venta en Corto)
              </button>
            </div>
          </div>

          {/* Cantidad y Precio de Entrada */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' }}>
                Cantidad de Acciones (Lote)
              </label>
              <input
                type="number"
                step="any"
                min="0.001"
                value={shares}
                onChange={(e) => setShares(parseFloat(e.target.value) || 0)}
                required
                className="font-mono"
                style={{
                  width: '100%',
                  background: '#070b14',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  color: '#fff',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' }}>
                Precio de Entrada (USD)
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                value={entryPrice}
                onChange={(e) => handlePriceChange(parseFloat(e.target.value) || 0)}
                required
                className="font-mono"
                style={{
                  width: '100%',
                  background: '#070b14',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  color: '#fff',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                }}
              />
            </div>
          </div>

          {/* Parámetros Tácticos Sugeridos: Stop Loss y Targets */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: '#ef4444', fontWeight: 700, marginBottom: '4px' }}>
                Stop Loss (-4.8%)
              </label>
              <input
                type="number"
                step="any"
                value={stopLoss}
                onChange={(e) => setStopLoss(parseFloat(e.target.value) || 0)}
                className="font-mono"
                style={{
                  width: '100%',
                  background: '#070b14',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  color: '#ef4444',
                  fontSize: '0.82rem',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--accent-green)', fontWeight: 700, marginBottom: '4px' }}>
                Target 1 (+9.5%)
              </label>
              <input
                type="number"
                step="any"
                value={target1}
                onChange={(e) => setTarget1(parseFloat(e.target.value) || 0)}
                className="font-mono"
                style={{
                  width: '100%',
                  background: '#070b14',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  color: 'var(--accent-green)',
                  fontSize: '0.82rem',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--accent-cyan)', fontWeight: 700, marginBottom: '4px' }}>
                Target 2 (+22.0%)
              </label>
              <input
                type="number"
                step="any"
                value={target2}
                onChange={(e) => setTarget2(parseFloat(e.target.value) || 0)}
                className="font-mono"
                style={{
                  width: '100%',
                  background: '#070b14',
                  border: '1px solid rgba(6, 182, 212, 0.3)',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  color: 'var(--accent-cyan)',
                  fontSize: '0.82rem',
                }}
              />
            </div>
          </div>

          {/* Fecha y Notas */}
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' }}>
                Fecha
              </label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                style={{
                  width: '100%',
                  background: '#070b14',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '8px 10px',
                  color: '#fff',
                  fontSize: '0.80rem',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' }}>
                Tesis / Notas
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ej: Breakout sobre SMA 50 con RVol institucional"
                style={{
                  width: '100%',
                  background: '#070b14',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: '#fff',
                  fontSize: '0.80rem',
                }}
              />
            </div>
          </div>

          {/* Resumen Financiero de la Posición */}
          <div
            style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.22)',
              borderRadius: '8px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Valor Total de la Posición</div>
              <div className="font-mono" style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--accent-green)' }}>
                ${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Trailing Stop en Target 1 rumbo a Target 2
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ flex: 1, padding: '11px', fontWeight: 700 }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{
                flex: 1.3,
                padding: '11px',
                fontWeight: 800,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.25)',
              }}
            >
              <CheckCircle2 size={16} /> Confirmar en Mi Cartera
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
