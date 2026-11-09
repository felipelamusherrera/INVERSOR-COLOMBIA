#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "requests>=2.31.0",
#     "python-dotenv>=1.0.0",
# ]
# ///

"""
Sincronizador Oficial de Series de Precios Históricos (Yahoo Finance -> Supabase)
Aplicativo: Inversor Colombia

Arquitectura en Dos Fases:
1. Carga Inicial / Nuevos Activos (3 Años):
   - Se ejecuta una única vez por ticker. Descarga las ~750 sesiones bursátiles reales
     de los últimos 3 años desde Yahoo Finance (Apertura, Máximo, Mínimo, Cierre, Volumen y RSI).
2. Sincronización Diaria Incremental (Delta):
   - Para los activos que ya tienen su histórico de 3 años en `stock_prices_history`,
     NO vuelve a descargar ni sobreescribir los 3 años.
   - Únicamente consulta los últimos días para calcular el RSI (14) exacto e inserta
     los últimos 3 cierres bursátiles, reduciendo el consumo de recursos en >99%.
"""

import argparse
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

import requests

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    load_dotenv()
except ImportError:
    pass

DEFAULT_SUPABASE_URL = "https://jptusquuyenbwrgasigt.supabase.co"
DEFAULT_SUPABASE_KEY = "sb_publishable_DH3nRkidf1sVejfCN0naVg_z35CsuUU"

HTTP_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
}


def get_credentials() -> Tuple[str, str]:
    url = os.environ.get("SUPABASE_URL") or DEFAULT_SUPABASE_URL
    key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or DEFAULT_SUPABASE_KEY
    return url.rstrip("/"), key


def get_active_tickers(base_url: str, api_key: str) -> List[str]:
    """Obtiene la totalidad de tickers únicos activos en inversor_colombia_latest paginando de 1000 en 1000."""
    headers = {
        "apikey": api_key,
        "Authorization": f"Bearer {api_key}"
    }
    all_tickers: List[str] = []
    seen: Set[str] = set()
    offset = 0

    while True:
        url = (
            f"{base_url}/rest/v1/inversor_colombia_latest"
            f"?select=ticker,market_cap&order=market_cap.desc.nullslast&offset={offset}&limit=1000"
        )
        try:
            resp = requests.get(url, headers=headers, timeout=20)
            if resp.status_code != 200:
                break
            data = resp.json()
            if not data:
                break
            for row in data:
                t = row.get("ticker")
                if t and t not in seen:
                    seen.add(t)
                    all_tickers.append(t)
            if len(data) < 1000:
                break
            offset += 1000
        except Exception as e:
            print(f"Error consultando tickers activos en offset {offset}: {e}", file=sys.stderr)
            break

    return all_tickers


def get_tickers_with_history(base_url: str, api_key: str) -> Set[str]:
    """
    Detecta de manera instantánea qué tickers ya tienen historia multianual cargada.
    Consulta únicamente un día hábil de hace ~1 año (ej. 350 a 365 días atrás) en lugar de leer toda la tabla.
    """
    headers = {
        "apikey": api_key,
        "Authorization": f"Bearer {api_key}"
    }
    # Ventana de 7 días hace ~11 meses para cubrir fines de semana/festivos y capturar 1 a 5 filas por ticker
    d_end = (datetime.now(timezone.utc) - timedelta(days=330)).date().isoformat()
    d_start = (datetime.now(timezone.utc) - timedelta(days=337)).date().isoformat()

    seeded_tickers: Set[str] = set()
    offset = 0
    while True:
        url = (
            f"{base_url}/rest/v1/stock_prices_history"
            f"?price_date=gte.{d_start}&price_date=lte.{d_end}&select=ticker&offset={offset}&limit=1000"
        )
        try:
            resp = requests.get(url, headers=headers, timeout=20)
            if resp.status_code != 200:
                break
            data = resp.json()
            if not data:
                break
            for row in data:
                t = row.get("ticker")
                if t:
                    seeded_tickers.add(t)
            if len(data) < 1000:
                break
            offset += 1000
        except Exception as e:
            print(f"Aviso verificando historial existente: {e}", file=sys.stderr)
            break

    return seeded_tickers


def compute_rsi(prices: List[float], period: int = 14) -> List[Optional[float]]:
    """Calcula el RSI (14) de Wilder sobre una lista de precios de cierre."""
    rsi: List[Optional[float]] = [None] * len(prices)
    if len(prices) <= period:
        return rsi

    gains = 0.0
    losses = 0.0
    for i in range(1, period + 1):
        diff = prices[i] - prices[i - 1]
        if diff >= 0:
            gains += diff
        else:
            losses += abs(diff)

    avg_gain = gains / period
    avg_loss = losses / period
    rs = 100.0 if avg_loss == 0 else avg_gain / avg_loss
    rsi[period] = round(100.0 - (100.0 / (1.0 + rs)), 1)

    for i in range(period + 1, len(prices)):
        diff = prices[i] - prices[i - 1]
        gain = diff if diff > 0 else 0.0
        loss = abs(diff) if diff < 0 else 0.0
        avg_gain = (avg_gain * (period - 1) + gain) / period
        avg_loss = (avg_loss * (period - 1) + loss) / period
        rs = 100.0 if avg_loss == 0 else avg_gain / avg_loss
        rsi[i] = round(100.0 - (100.0 / (1.0 + rs)), 1)

    return rsi


def fetch_yahoo_bars(ticker: str, is_incremental: bool) -> Tuple[str, List[Dict]]:
    """
    Descarga las barras reales de Yahoo Finance para un ticker.
    - Si es incremental: pide range=1mo (para tener las 14 sesiones previas del RSI) y retorna solo las últimas 3 sesiones.
    - Si es carga inicial: pide range=3y y retorna todas las ~753 sesiones.
    """
    time_range = "1mo" if is_incremental else "3y"
    # En Yahoo Finance algunos tickers con punto o clase (ej. BRK.A) usan guion (BRK-A)
    yf_ticker = ticker.replace(".", "-")
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{yf_ticker}?range={time_range}&interval=1d"

    try:
        resp = requests.get(url, headers=HTTP_HEADERS, timeout=12)
        if resp.status_code != 200:
            return ticker, []

        data = resp.json()
        result_list = data.get("chart", {}).get("result")
        if not result_list:
            return ticker, []

        result = result_list[0]
        timestamps = result.get("timestamp", [])
        quotes_list = result.get("indicators", {}).get("quote", [{}])
        if not timestamps or not quotes_list:
            return ticker, []

        quotes = quotes_list[0]
        closes = quotes.get("close", [])
        opens = quotes.get("open", [])
        highs = quotes.get("high", [])
        lows = quotes.get("low", [])
        volumes = quotes.get("volume", [])

        valid_indices: List[int] = []
        valid_closes: List[float] = []
        for i in range(len(timestamps)):
            if i < len(closes) and closes[i] is not None and closes[i] > 0:
                valid_indices.append(i)
                valid_closes.append(float(closes[i]))

        if not valid_closes:
            return ticker, []

        calculated_rsi = compute_rsi(valid_closes, period=14)

        rows: List[Dict] = []
        seen_dates: Set[str] = set()
        for idx_in_valid, orig_idx in enumerate(valid_indices):
            c = valid_closes[idx_in_valid]
            op = opens[orig_idx] if (opens and orig_idx < len(opens) and opens[orig_idx] is not None) else c
            hi = highs[orig_idx] if (highs and orig_idx < len(highs) and highs[orig_idx] is not None) else max(c, op)
            lo = lows[orig_idx] if (lows and orig_idx < len(lows) and lows[orig_idx] is not None) else min(c, op)
            vol = volumes[orig_idx] if (volumes and orig_idx < len(volumes) and volumes[orig_idx] is not None) else None
            dt = datetime.fromtimestamp(timestamps[orig_idx], timezone.utc).date().isoformat()

            if dt in seen_dates:
                continue
            seen_dates.add(dt)

            rows.append({
                "ticker": ticker,
                "price_date": dt,
                "open_price": round(float(op), 2),
                "high_price": round(float(hi), 2),
                "low_price": round(float(lo), 2),
                "close_price": round(float(c), 2),
                "volume": int(vol) if vol is not None else None,
                "rsi": calculated_rsi[idx_in_valid]
            })

        if is_incremental:
            return ticker, rows[-3:]
        return ticker, rows
    except Exception:
        return ticker, []


def upsert_batch_to_supabase(base_url: str, api_key: str, rows: List[Dict], chunk_size: int = 2000) -> int:
    """Realiza upsert masivo en Supabase con bloques de 2000 filas."""
    if not rows:
        return 0

    # Asegurar que no existan claves duplicadas (ticker, price_date) dentro del mismo lote
    dedup: Dict[Tuple[str, str], Dict] = {}
    for r in rows:
        dedup[(r["ticker"], r["price_date"])] = r
    unique_rows = list(dedup.values())

    url = f"{base_url}/rest/v1/stock_prices_history"
    headers = {
        "apikey": api_key,
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal"
    }

    inserted = 0
    for b in range(0, len(unique_rows), chunk_size):
        chunk = unique_rows[b:b + chunk_size]
        for attempt in range(3):
            try:
                resp = requests.post(url, headers=headers, json=chunk, timeout=30)
                if resp.status_code in (200, 201, 204):
                    inserted += len(chunk)
                    break
                else:
                    if attempt == 2:
                        print(f"Error HTTP {resp.status_code} en upsert: {resp.text[:150]}", file=sys.stderr)
            except Exception as e:
                if attempt == 2:
                    print(f"Excepción en upsert tras 3 intentos: {e}", file=sys.stderr)
                time.sleep(1)

    return inserted


def purge_old_records(base_url: str, api_key: str, retention_years: int = 3):
    """Limpia registros con más de 3 años de antigüedad para mantener el tamaño óptimo."""
    cutoff_date = (datetime.now(timezone.utc) - timedelta(days=retention_years * 365 + 15)).date().isoformat()
    url = f"{base_url}/rest/v1/stock_prices_history?price_date=lt.{cutoff_date}"
    headers = {
        "apikey": api_key,
        "Authorization": f"Bearer {api_key}"
    }
    try:
        resp = requests.delete(url, headers=headers, timeout=20)
        if resp.status_code in (200, 204):
            print(f"Mantenimiento de ventana de {retention_years} años: purgados registros anteriores a {cutoff_date}.")
    except Exception as e:
        print(f"Aviso en limpieza histórica: {e}", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(description="Sincronizador de precios históricos reales (Yahoo Finance -> Supabase)")
    parser.add_argument("--mode", choices=["auto", "initial", "incremental"], default="auto",
                        help="auto: 3 años para tickers nuevos y 3 días para existentes; initial: fuerza 3 años para todos")
    parser.add_argument("--tickers", type=str, default=None,
                        help="Lista opcional de tickers separados por coma (ej: TSM,AAPL,NVDA)")
    parser.add_argument("--workers", type=int, default=16,
                        help="Hilos concurrentes para descarga desde Yahoo Finance")
    parser.add_argument("--retention-years", type=int, default=3,
                        help="Años de historia a conservar en Supabase")

    args = parser.parse_args()
    base_url, api_key = get_credentials()

    print("=== Sincronizador de Series Históricas Reales (Yahoo Finance -> Supabase) ===", flush=True)
    t_start = time.time()

    if args.tickers:
        target_tickers = [t.strip().upper() for t in args.tickers.split(",") if t.strip()]
        print(f"Tickers manuales seleccionados: {len(target_tickers)}", flush=True)
    else:
        target_tickers = get_active_tickers(base_url, api_key)
        print(f"Total de acciones activas en Inversor Colombia: {len(target_tickers)}", flush=True)

    if not target_tickers:
        print("No se encontraron acciones para procesar.", flush=True)
        return

    seeded_tickers: Set[str] = set()
    if args.mode != "initial":
        seeded_tickers = get_tickers_with_history(base_url, api_key)
        print(f"Acciones que ya cuentan con histórico de 3 años en Supabase: {len(seeded_tickers)}", flush=True)

    new_tickers = [t for t in target_tickers if t not in seeded_tickers]
    inc_tickers = [t for t in target_tickers if t in seeded_tickers]

    print(
        f"Plan de ejecución:\n"
        f"  -> Carga inicial completa (3 años): {len(new_tickers)} acciones\n"
        f"  -> Actualización incremental (últimos 3 días): {len(inc_tickers)} acciones",
        flush=True
    )

    total_upserted = 0
    buffer_rows: List[Dict] = []
    processed = 0
    total_count = len(target_tickers)

    # Procesar en lotes de 60 acciones con ThreadPoolExecutor
    batch_tickers_size = 60
    for i in range(0, total_count, batch_tickers_size):
        sub_tickers = target_tickers[i:i + batch_tickers_size]
        with ThreadPoolExecutor(max_workers=args.workers) as executor:
            futures = {
                executor.submit(fetch_yahoo_bars, t, (t in seeded_tickers and args.mode != "initial")): t
                for t in sub_tickers
            }
            for fut in as_completed(futures):
                t_name, rows = fut.result()
                processed += 1
                if rows:
                    buffer_rows.extend(rows)

        # Subir a Supabase cuando el buffer supera 4000 filas o al terminar el bloque
        if len(buffer_rows) >= 4000 or (i + batch_tickers_size >= total_count):
            saved = upsert_batch_to_supabase(base_url, api_key, buffer_rows, chunk_size=2000)
            total_upserted += saved
            buffer_rows.clear()
            elapsed = time.time() - t_start
            print(
                f"Progreso: [{processed}/{total_count} acciones] | "
                f"Filas sincronizadas: {total_upserted:,} | Tiempo: {elapsed:.1f}s",
                flush=True
            )

    purge_old_records(base_url, api_key, retention_years=args.retention_years)
    total_time = time.time() - t_start
    print(f"=== Sincronización Finalizada en {total_time:.1f}s ({total_upserted:,} registros reales procesados) ===", flush=True)


if __name__ == "__main__":
    main()
