import React, { useState, useEffect } from 'react';
import { X, Bookmark, Plus, Check, FolderPlus, Layers } from 'lucide-react';
import { toast } from 'sonner';
import {
  getCustomWatchlists,
  addTickerToWatchlist,
  removeTickerFromWatchlist,
  createCustomWatchlist,
  type CustomWatchlist,
} from '../utils/customWatchlistService';
import type { StockRecord } from '../types/stock';

interface AddToWatchlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  stock: StockRecord | null;
  onSuccess?: () => void;
}

export const AddToWatchlistModal: React.FC<AddToWatchlistModalProps> = ({
  isOpen,
  onClose,
  stock,
  onSuccess,
}) => {
  if (!isOpen || !stock) return null;

  const [watchlists, setWatchlists] = useState<CustomWatchlist[]>([]);
  const [newListName, setNewListName] = useState('');
  const [newListDesc, setNewListDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const loadLists = () => {
    setWatchlists(getCustomWatchlists());
  };

  useEffect(() => {
    if (isOpen) {
      loadLists();
    }
  }, [isOpen]);

  const handleToggle = (list: CustomWatchlist) => {
    const isMember = list.tickers.includes(stock.ticker);
    if (isMember) {
      removeTickerFromWatchlist(list.id, stock.ticker);
      toast.info(`${stock.ticker} removido de "${list.name}"`);
    } else {
      addTickerToWatchlist(list.id, stock.ticker);
      toast.success(`${stock.ticker} agregado a "${list.name}"`);
    }
    loadLists();
    if (onSuccess) onSuccess();
  };

  const handleCreateNewList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) {
      toast.error('El nombre de la lista no puede estar vacío');
      return;
    }

    const created = createCustomWatchlist(newListName, newListDesc);
    addTickerToWatchlist(created.id, stock.ticker);
    toast.success(`Lista "${created.name}" creada con ${stock.ticker} incluido`);
    setNewListName('');
    setNewListDesc('');
    setIsCreating(false);
    loadLists();
    if (onSuccess) onSuccess();
  };

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
          maxWidth: '460px',
          padding: '26px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(6, 182, 212, 0.15)',
                color: 'var(--accent-cyan)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(6, 182, 212, 0.3)',
              }}
            >
              <Bookmark size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                Listas de Seguimiento
              </h3>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                Organiza a <strong style={{ color: '#fff' }}>{stock.company} ({stock.ticker})</strong>
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

        {/* Listado de Listas de Seguimiento */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '14px 0', maxHeight: '280px', overflowY: 'auto' }}>
          {watchlists.map((list) => {
            const isMember = list.tickers.includes(stock.ticker);
            return (
              <div
                key={list.id}
                onClick={() => handleToggle(list)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: isMember ? 'rgba(6, 182, 212, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                  border: isMember ? '1px solid rgba(6, 182, 212, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: list.color || '#06b6d4',
                    }}
                  />
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#fff' }}>{list.name}</div>
                    <div style={{ fontSize: '0.70rem', color: 'var(--text-muted)' }}>
                      {list.tickers.length} acciones guardadas · {list.description || 'Sin descripción'}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '6px',
                    border: isMember ? '2px solid var(--accent-cyan)' : '2px solid rgba(255, 255, 255, 0.2)',
                    background: isMember ? 'var(--accent-cyan)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#070b14',
                  }}
                >
                  {isMember && <Check size={14} strokeWidth={3} />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Sección: Crear Nueva Lista */}
        {!isCreating ? (
          <button
            onClick={() => setIsCreating(true)}
            className="btn btn-secondary"
            style={{ width: '100%', padding: '10px', fontSize: '0.80rem', fontWeight: 700, gap: '6px', marginTop: '6px' }}
          >
            <Plus size={15} /> + Crear Nueva Lista de Seguimiento
          </button>
        ) : (
          <form
            onSubmit={handleCreateNewList}
            style={{
              marginTop: '10px',
              padding: '14px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ fontSize: '0.80rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
              Nueva Lista de Seguimiento
            </div>
            <input
              type="text"
              placeholder="Nombre de la lista (ej: Dividendos Aristócratas)"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              required
              autoFocus
              style={{
                width: '100%',
                background: '#070b14',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                padding: '8px 12px',
                color: '#fff',
                fontSize: '0.82rem',
              }}
            />
            <input
              type="text"
              placeholder="Descripción opcional (ej: Tesis swing sector salud)"
              value={newListDesc}
              onChange={(e) => setNewListDesc(e.target.value)}
              style={{
                width: '100%',
                background: '#070b14',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                padding: '8px 12px',
                color: '#fff',
                fontSize: '0.80rem',
              }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="btn btn-secondary"
                style={{ flex: 1, padding: '7px', fontSize: '0.78rem' }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 1, padding: '7px', fontSize: '0.78rem', fontWeight: 800 }}
              >
                Crear y Guardar
              </button>
            </div>
          </form>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <button
            onClick={onClose}
            className="btn btn-primary"
            style={{ padding: '8px 20px', fontSize: '0.82rem', fontWeight: 800 }}
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};
