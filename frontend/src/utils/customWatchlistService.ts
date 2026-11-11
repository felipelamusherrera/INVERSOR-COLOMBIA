/**
 * Servicio Centralizado de Listas de Seguimiento Personalizadas (Custom Watchlists)
 * Permite a los usuarios crear, agrupar y organizar acciones de interés en múltiples listas.
 */

export interface CustomWatchlist {
  id: string;
  name: string;
  description?: string;
  color?: string;
  tickers: string[];
  createdAt: string;
}

const STORAGE_KEY = 'inversor_colombia_custom_watchlists';
const LEGACY_STORAGE_KEY = 'inversor_colombia_watchlist';

const DEFAULT_WATCHLISTS: CustomWatchlist[] = [
  {
    id: 'list-fav',
    name: 'Favoritas Core',
    description: 'Acciones principales en seguimiento prioritario',
    color: '#06b6d4',
    tickers: ['NVDA', 'AAPL', 'MSFT', 'MU'],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'list-ia-tech',
    name: 'Tecnología & IA',
    description: 'Semiconductores, centros de datos e infraestructura de IA',
    color: '#3b82f6',
    tickers: ['NVDA', 'MU', 'AVGO', 'AMD'],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'list-swing',
    name: 'Oportunidades Swing 3M',
    description: 'Tesis de inversión para horizonte swing de mediano plazo',
    color: '#10b981',
    tickers: ['MU', 'CMG', 'WINA'],
    createdAt: new Date().toISOString(),
  },
];

/**
 * Obtiene todas las listas de seguimiento guardadas. Si no existen, inicializa las predeterminadas
 * integrando los tickers del almacenamiento previo para máxima retrocompatibilidad.
 */
export function getCustomWatchlists(): CustomWatchlist[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }

    // Si no existen listas modernas, migrar la lista simple previa
    let initialTickers = ['NVDA', 'AAPL', 'MSFT', 'MU'];
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      try {
        const legacyParsed = JSON.parse(legacyRaw);
        if (Array.isArray(legacyParsed) && legacyParsed.length > 0) {
          initialTickers = legacyParsed;
        }
      } catch {}
    }

    const migrated = [...DEFAULT_WATCHLISTS];
    migrated[0].tickers = Array.from(new Set([...migrated[0].tickers, ...initialTickers]));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  } catch (err) {
    console.error('Error reading custom watchlists:', err);
    return DEFAULT_WATCHLISTS;
  }
}

/**
 * Guarda las listas de seguimiento y emite un evento global para sincronizar componentes
 */
export function saveCustomWatchlists(lists: CustomWatchlist[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
    // Sincronizar lista clásica legacy con todos los tickers únicos
    const allUnique = getAllWatchlistTickers(lists);
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(allUnique));
    window.dispatchEvent(new Event('custom_watchlists_updated'));
  } catch (err) {
    console.error('Error saving custom watchlists:', err);
  }
}

/**
 * Crea una nueva lista de seguimiento con nombre personalizado
 */
export function createCustomWatchlist(name: string, description?: string): CustomWatchlist {
  const lists = getCustomWatchlists();
  const id = `list-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const colors = ['#06b6d4', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];
  const color = colors[lists.length % colors.length];

  const newList: CustomWatchlist = {
    id,
    name: name.trim(),
    description: description?.trim() || 'Lista personalizada de seguimiento',
    color,
    tickers: [],
    createdAt: new Date().toISOString(),
  };

  lists.push(newList);
  saveCustomWatchlists(lists);
  return newList;
}

/**
 * Elimina una lista de seguimiento por ID
 */
export function deleteCustomWatchlist(listId: string): void {
  const lists = getCustomWatchlists().filter((l) => l.id !== listId);
  saveCustomWatchlists(lists);
}

/**
 * Agrega un ticker a una lista específica
 */
export function addTickerToWatchlist(listId: string, ticker: string): boolean {
  const sym = ticker.toUpperCase().trim();
  const lists = getCustomWatchlists();
  const target = lists.find((l) => l.id === listId);
  if (!target) return false;

  if (!target.tickers.includes(sym)) {
    target.tickers.push(sym);
    saveCustomWatchlists(lists);
    return true;
  }
  return false;
}

/**
 * Remueve un ticker de una lista específica
 */
export function removeTickerFromWatchlist(listId: string, ticker: string): boolean {
  const sym = ticker.toUpperCase().trim();
  const lists = getCustomWatchlists();
  const target = lists.find((l) => l.id === listId);
  if (!target) return false;

  if (target.tickers.includes(sym)) {
    target.tickers = target.tickers.filter((t) => t !== sym);
    saveCustomWatchlists(lists);
    return true;
  }
  return false;
}

/**
 * Devuelve todas las listas a las que pertenece un ticker determinado
 */
export function getWatchlistsForTicker(ticker: string): CustomWatchlist[] {
  const sym = ticker.toUpperCase().trim();
  const lists = getCustomWatchlists();
  return lists.filter((l) => l.tickers.includes(sym));
}

/**
 * Devuelve true si el ticker está en al menos una lista
 */
export function isTickerInAnyWatchlist(ticker: string): boolean {
  const sym = ticker.toUpperCase().trim();
  const lists = getCustomWatchlists();
  return lists.some((l) => l.tickers.includes(sym));
}

/**
 * Obtiene todos los tickers únicos contenidos en todas las listas
 */
export function getAllWatchlistTickers(lists?: CustomWatchlist[]): string[] {
  const allLists = lists || getCustomWatchlists();
  const set = new Set<string>();
  allLists.forEach((l) => l.tickers.forEach((t) => set.add(t)));
  return Array.from(set);
}
