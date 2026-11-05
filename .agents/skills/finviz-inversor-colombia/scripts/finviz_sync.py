# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "requests>=2.31.0",
#     "supabase>=2.0.0",
#     "pandas>=2.0.0",
#     "python-dotenv>=1.0.0",
# ]
# ///

"""
Herramienta CLI para la extracción de métricas desde Finviz y
sincronización con Supabase manteniendo un histórico móvil de 30 días.
Desarrollada para el aplicativo "Inversor Colombia".
"""

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests

# Cargar variables de entorno desde .env
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[3] / ".env")
    load_dotenv()
except ImportError:
    pass

FINVIZ_COL_STRING = (
    "0,1,2,3,4,5,6,7,8,9,10,70,79,100,144,145,146,16,17,18,19,20,21,22,23,77,78,"
    "82,127,128,132,133,142,32,33,34,35,36,37,38,39,40,41,74,14,147,148,24,25,26,"
    "28,29,30,31,84,65,66,67,63,64,81,86,87,88,60,61,134,57,58,125,126,48,49,50,"
    "51,52,53,54,55,56,59,42,43,44,45,46,47,138,139,140,62,69,68,136,137,150,103,"
    "105,107,108,109,120,121,122"
)

DEFAULT_FILTER_CODE = "cap_smallover"
DEFAULT_ORDER = "-marketcap"
DEFAULT_MIN_MARKET_CAP = 1000.0  # Millones de USD ($1,000M = $1B)
STRATEGY_FILTER_CODE = "fa_curratio_o1,fa_epsqoq_o15,fa_epsyoyttm_o15,fa_fpe_u30,fa_quickratio_o1,fa_roi_o10,geo_usa,ta_rsi_nos40"

HTTP_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


def round_num(val: Any, decimals: int = 4) -> Optional[float]:
    if val is None or val == "-" or val == "":
        return None
    try:
        f = float(val)
        return round(f, decimals)
    except (ValueError, TypeError):
        return None


def scale_millions(val: Any) -> Optional[float]:
    """Convierte cifras de Finviz reportadas en millones a unidades reales."""
    if val is None or val == "-" or val == "":
        return None
    try:
        return round(float(val) * 1e6, 2)
    except (ValueError, TypeError):
        return None


def to_int(val: Any, multiplier: float = 1.0) -> Optional[int]:
    if val is None or val == "-" or val == "":
        return None
    try:
        return int(float(val) * multiplier)
    except (ValueError, TypeError):
        return None


def map_finviz_row(row: Dict[str, Any], snapshot_date_str: str) -> Dict[str, Any]:
    """Mapea la fila JSON cruda de Finviz a las columnas SQL de Supabase."""
    t = row.get("text", {})
    n = row.get("numbers", {})

    return {
        "ticker": t.get("ticker"),
        "snapshot_date": snapshot_date_str,
        "company": t.get("company"),
        "sector": t.get("sector"),
        "industry": t.get("industry"),
        "country": t.get("country"),
        "ipo_date": t.get("ipoDate"),
        "index_name": t.get("index"),
        "asset_type": t.get("securityType"),

        # Valoración
        "market_cap": scale_millions(n.get("marketCap")),
        "enterprise_value": scale_millions(n.get("enterpriseValue")),
        "price": round_num(n.get("price"), 2),
        "pe": round_num(n.get("PE"), 2),
        "forward_pe": round_num(n.get("forwardPE"), 2),
        "peg": round_num(n.get("PEG"), 2),
        "ps": round_num(n.get("PS"), 2),
        "ev_ebitda": round_num(n.get("evEbitda"), 2),
        "ev_sales": round_num(n.get("evSales"), 2),

        # EPS, Crecimiento y Ventas
        "eps": round_num(n.get("eps"), 4),
        "eps_this_y": round_num(n.get("epsYoY"), 2),
        "eps_next_y": round_num(n.get("epsYoY1"), 2),
        "eps_past_5y": round_num(n.get("sales5Years"), 2),
        "eps_next_5y": round_num(n.get("estLTGrowth"), 2),
        "eps_qq": round_num(n.get("epsQoQ"), 2),
        "sales_qq": round_num(n.get("salesQoQ"), 2),
        "eps_next_q": round_num(n.get("estQ1"), 4),
        "income": scale_millions(n.get("income")),
        "sales": scale_millions(n.get("sales")),
        "eps_surprise": round_num(n.get("epsSurprise"), 2),
        "revenue_surprise": round_num(n.get("revenueSurprise"), 2),
        "eps_yoy_ttm": round_num(n.get("epsYoYTTM"), 2),
        "sales_yoy_ttm": round_num(n.get("salesYoYTTM"), 2),

        # Márgenes y Rentabilidad
        "gross_m": round_num(n.get("grossMargin"), 2),
        "oper_m": round_num(n.get("operMargin"), 2),
        "profit_m": round_num(n.get("netMargin"), 2),
        "roa": round_num(n.get("roa"), 2),
        "roe": round_num(n.get("roe"), 2),
        "roic": round_num(n.get("roi"), 2),
        "curr_r": round_num(n.get("curRatio"), 2),
        "quick_r": round_num(n.get("quickRatio"), 2),
        "lt_debt_eq": round_num(n.get("ltdebtEq"), 2),
        "debt_eq": round_num(n.get("debtEq"), 2),
        "cash_sh": round_num(n.get("cashPerShare"), 2),

        # Acciones y Estructura
        "outstanding": to_int(n.get("sharesOutstanding2"), 1e6),
        "float_shares": to_int(n.get("sharesFloat"), 1e6),
        "insider_own": round_num(n.get("insiderOwn"), 2),
        "inst_own": round_num(n.get("instOwn"), 2),
        "inst_trans": round_num(n.get("instTrans"), 2),
        "short_float": round_num(n.get("shortInterestShare"), 2),
        "short_ratio": round_num(n.get("shortInterestRatio"), 2),
        "short_interest": to_int(n.get("shortInterest"), 1e6),

        # Cotización y Precios
        "change_pct": round_num(n.get("change"), 2),
        "volume": to_int(n.get("volume")),
        "avg_volume": to_int(n.get("averageVolume")),
        "rel_volume": round_num(n.get("relativeVolume"), 2),
        "prev_close": round_num(n.get("prevClose"), 2),
        "open": round_num(n.get("open"), 2),
        "high": round_num(n.get("high"), 2),
        "low": round_num(n.get("low"), 2),
        "change_from_open_pct": round_num(n.get("changeopen"), 2),
        "gap_pct": round_num(n.get("gap"), 2),
        "w52_high": round_num(n.get("high52w"), 2),
        "w52_low": round_num(n.get("low52w"), 2),
        "all_time_high": round_num(n.get("highAt"), 2),
        "all_time_low": round_num(n.get("lowAt"), 2),
        "beta": round_num(n.get("beta"), 2),
        "atr": round_num(n.get("averageTrueRange"), 2),
        "volatility_w": round_num(n.get("volatility1w"), 2),
        "volatility_m": round_num(n.get("volatility4w"), 2),
        "sma20": round_num(n.get("sma20"), 2),
        "sma50": round_num(n.get("sma50"), 2),
        "sma200": round_num(n.get("sma200"), 2),
        "d50_high": round_num(n.get("high50d"), 2),
        "d50_low": round_num(n.get("low50d"), 2),
        "rsi": round_num(n.get("rsi"), 2),

        # Rendimientos Temporales
        "perf_week": round_num(n.get("perf1w"), 2),
        "perf_month": round_num(n.get("perf4w"), 2),
        "perf_quart": round_num(n.get("perf13w"), 2),
        "perf_half": round_num(n.get("perf26w"), 2),
        "perf_year": round_num(n.get("perf52w"), 2),
        "perf_ytd": round_num(n.get("perfYtd"), 2),
        "perf_3y": round_num(n.get("perf3y"), 2),
        "perf_5y": round_num(n.get("perf5y"), 2),
        "recom": round_num(n.get("recom"), 2),
        "target_price": round_num(n.get("targetPrice"), 2),

        # Noticias y Textos
        "earnings_date": t.get("earningsDate"),
        "news_url": t.get("newsUrl"),
        "news_title": t.get("newsTitle"),
        "daily_digest": t.get("wiimDailyDigest"),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def get_supabase_client():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        print("ERROR: Faltan credenciales de Supabase en .env", file=sys.stderr)
        sys.exit(1)

    from supabase import create_client
    return create_client(url, key)


def _fetch_finviz_partition(
    session: requests.Session,
    filter_code: str,
    order: str,
    min_market_cap_millions: Optional[float],
    today_str: str,
    limit_remaining: Optional[int],
    sleep_sec: float
) -> List[Dict[str, Any]]:
    base_url = f"https://finviz.com/screener/stocks?v=152&c={FINVIZ_COL_STRING}"
    if filter_code:
        base_url += f"&f={filter_code}"
    if order:
        base_url += f"&o={order}"

    records = []
    page = 1
    stop_due_to_threshold = False

    while True:
        r_val = (page - 1) * 20 + 1
        page_url = f"{base_url}&r={r_val}"

        try:
            resp = session.get(page_url, timeout=15)
        except Exception as e:
            sys.stderr.write(f"Error de conexión en página {page}: {e}\n")
            break

        if resp.status_code != 200:
            sys.stderr.write(f"Respuesta inesperada de Finviz (status {resp.status_code}) en página {page}\n")
            break

        scripts = re.findall(r"<script[^>]*>(.*?)</script>", resp.text, re.DOTALL)
        matched = [x for x in scripts if "rows" in x and "totalCount" in x]

        if not matched:
            sys.stderr.write(f"No se encontraron bloques de datos en la página {page}.\n")
            break

        try:
            payload = json.loads(matched[0]).get("data", {})
        except Exception as e:
            sys.stderr.write(f"Error decodificando JSON en página {page}: {e}\n")
            break

        total_count = payload.get("totalCount", 0)
        raw_rows = payload.get("rows", [])

        if not raw_rows:
            break

        for row in raw_rows:
            cap_val = row.get("numbers", {}).get("marketCap")

            if min_market_cap_millions is not None and order.startswith("-marketcap"):
                if cap_val is not None and cap_val < min_market_cap_millions:
                    stop_due_to_threshold = True
                    break

            if min_market_cap_millions is not None and cap_val is not None and cap_val < min_market_cap_millions:
                continue

            rec = map_finviz_row(row, today_str)
            if rec.get("ticker"):
                records.append(rec)
            if limit_remaining and len(records) >= limit_remaining:
                break

        sys.stderr.write(f"[{filter_code}] Página {page} ({len(records)}/{total_count} acciones cargadas)...\n")

        if stop_due_to_threshold:
            sys.stderr.write(f"[{filter_code}] Alcanzado umbral mínimo de Market Cap ({min_market_cap_millions:,.0f}M). Finalizando tramo.\n")
            break

        if (limit_remaining and len(records) >= limit_remaining) or (page * 20 >= total_count):
            break

        page += 1
        time.sleep(sleep_sec)

    return records


def fetch_from_finviz(
    filter_code: str = DEFAULT_FILTER_CODE,
    order: str = DEFAULT_ORDER,
    limit: Optional[int] = None,
    min_market_cap_millions: Optional[float] = DEFAULT_MIN_MARKET_CAP,
    sleep_sec: float = 0.35
) -> List[Dict[str, Any]]:
    """Descarga de alta velocidad extrayendo el JSON estructurado directamente de Finviz."""
    session = requests.Session()
    session.headers.update(HTTP_HEADERS)
    try:
        session.get("https://finviz.com/", timeout=10)
        time.sleep(0.3)
    except Exception:
        pass

    today_str = datetime.now(timezone.utc).date().isoformat()

    # Si se solicita el universo de capitalización > 1.000M o cap_smallover,
    # segmentamos en 4 tramos para superar el límite anónimo de 1.000 acciones por consulta de Finviz
    if filter_code in ["cap_smallover", "universe_1b", "all"] and (min_market_cap_millions or 0) >= 1000.0:
        sys.stderr.write(
            "Modo Universo Completo (> $1.000M USD): Particionando en 4 tramos para evadir límite de 1.000 acciones de Finviz...\n"
        )
        partitions = [
            ("cap_largeover", "-marketcap", None),           # Mega + Large (>= $10B): ~928 stocks
            ("cap_mid,geo_usa", "-marketcap", None),         # Mid Cap USA ($2B-$10B): ~917 stocks
            ("cap_mid,geo_notusa", "-marketcap", None),      # Mid Cap Internacional ($2B-$10B): ~180 stocks
            ("cap_small", "-marketcap", min_market_cap_millions), # Small Cap ($1B-$2B): ~491 stocks
        ]

        seen_tickers = set()
        all_records = []

        for p_filter, p_order, p_min_cap in partitions:
            rem = (limit - len(all_records)) if limit else None
            if limit and rem <= 0:
                break
            p_recs = _fetch_finviz_partition(
                session=session,
                filter_code=p_filter,
                order=p_order,
                min_market_cap_millions=p_min_cap,
                today_str=today_str,
                limit_remaining=rem,
                sleep_sec=sleep_sec
            )
            for r in p_recs:
                tk = r.get("ticker")
                if tk and tk not in seen_tickers:
                    seen_tickers.add(tk)
                    all_records.append(r)

        sys.stderr.write(f"Extracción finalizada. Total de acciones recopiladas: {len(all_records)}\n")
        return all_records

    # Modo estándar para un solo filtro (ej: estrategia, etc.)
    if filter_code == "strategy":
        filter_code = STRATEGY_FILTER_CODE

    sys.stderr.write(
        f"Iniciando extracción Finviz...\n"
        f"Filtro: {filter_code or 'Ninguno'} | Orden: {order} | "
        f"Cap. Mínima: {f'${min_market_cap_millions:,.0f}M' if min_market_cap_millions else 'Sin límite'}\n"
    )
    return _fetch_finviz_partition(
        session=session,
        filter_code=filter_code,
        order=order,
        min_market_cap_millions=min_market_cap_millions,
        today_str=today_str,
        limit_remaining=limit,
        sleep_sec=sleep_sec
    )


def cmd_fetch(args):
    output_path = Path(args.output).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    filter_code = args.filters if args.filters is not None else DEFAULT_FILTER_CODE
    order = args.order if args.order is not None else DEFAULT_ORDER

    records = fetch_from_finviz(
        filter_code=filter_code,
        order=order,
        limit=args.limit,
        min_market_cap_millions=args.min_market_cap,
        sleep_sec=args.sleep
    )

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2, ensure_ascii=False)

    print(f"Éxito: {len(records)} acciones guardadas en: {output_path}")

    if args.export_csv:
        csv_path = Path(args.export_csv).resolve()
        csv_path.parent.mkdir(parents=True, exist_ok=True)
        import pandas as pd
        df = pd.DataFrame(records)
        df.to_csv(csv_path, index=False)
        print(f"Exportación CSV guardada en: {csv_path}")


def cmd_push(args):
    input_path = Path(args.input).resolve()
    if not input_path.exists():
        print(f"ERROR: Archivo no encontrado: {input_path}", file=sys.stderr)
        sys.exit(1)

    with open(input_path, "r", encoding="utf-8") as f:
        records = json.load(f)

    if not records:
        print("Aviso: No hay registros en el archivo para sincronizar.")
        return

    client = get_supabase_client()
    table_name = "inversor_colombia_stocks"

    sys.stderr.write(f"Conectado a Supabase. Sincronizando {len(records)} acciones...\n")

    batch_size = args.batch_size
    total_inserted = 0

    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        try:
            client.table(table_name).upsert(batch, on_conflict="ticker,snapshot_date").execute()
            total_inserted += len(batch)
            sys.stderr.write(f"Lote {total_inserted}/{len(records)} sincronizado en Supabase...\n")
        except Exception as e:
            print(f"ERROR insertando lote {i}-{i+len(batch)}: {e}", file=sys.stderr)
            sys.exit(1)

    print(f"Éxito: {total_inserted} acciones registradas en Supabase para hoy.")

    # Mantenimiento de Ventana Móvil de 30 días
    retention_days = args.retention_days
    cutoff_date = (datetime.now(timezone.utc) - timedelta(days=retention_days)).date().isoformat()
    sys.stderr.write(f"Aplicando retención de {retention_days} días: purgando fechas anteriores a {cutoff_date}...\n")

    try:
        del_res = client.table(table_name).delete().lt("snapshot_date", cutoff_date).execute()
        count = len(del_res.data) if hasattr(del_res, "data") and del_res.data else 0
        if count > 0:
            print(f"Limpieza: Se eliminaron {count} registros antiguos (> {retention_days} días).")
        else:
            print(f"Base de datos al día: No hay registros con más de {retention_days} días.")
    except Exception as e:
        sys.stderr.write(f"Aviso en limpieza de histórico: {e}\n")


def cmd_sync(args):
    temp_output = Path(args.output).resolve()
    temp_output.parent.mkdir(parents=True, exist_ok=True)

    filter_code = args.filters if args.filters is not None else DEFAULT_FILTER_CODE
    order = args.order if args.order is not None else DEFAULT_ORDER

    records = fetch_from_finviz(
        filter_code=filter_code,
        order=order,
        limit=args.limit,
        min_market_cap_millions=args.min_market_cap,
        sleep_sec=args.sleep
    )

    with open(temp_output, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2, ensure_ascii=False)

    args.input = str(temp_output)
    cmd_push(args)


def cmd_test_connection(args):
    sys.stderr.write("Comprobando credenciales y conexión con Supabase...\n")
    client = get_supabase_client()
    table_name = "inversor_colombia_stocks"

    try:
        res = client.table(table_name).select("ticker, company, snapshot_date", count="exact").limit(3).execute()
        count = res.count if hasattr(res, "count") and res.count is not None else len(res.data)
        print("Conexión exitosa con Supabase!")
        print(f"Tabla '{table_name}' accesible.")
        print(f"Total de registros históricos almacenados: {count}")

        try:
            v_res = client.table("inversor_colombia_latest").select("ticker, snapshot_date", count="exact").limit(3).execute()
            latest_count = v_res.count if hasattr(v_res, "count") and v_res.count is not None else len(v_res.data)
            print(f"Vista 'inversor_colombia_latest' activa. Acciones únicas en el snapshot más reciente: {latest_count}")
        except Exception:
            pass
    except Exception as e:
        print(f"ERROR al consultar '{table_name}': {e}", file=sys.stderr)
        sys.exit(1)


def cmd_backfill_prices(args):
    """Backfill de series temporales de 3 años para acciones en stock_prices_history."""
    client = get_supabase_client()
    table_name = "stock_prices_history"

    tickers = []
    if args.tickers:
        tickers = [t.strip().upper() for t in args.tickers.split(",") if t.strip()]
    elif args.top:
        res = client.table("inversor_colombia_latest").select("ticker").order("market_cap", desc=True).limit(args.top).execute()
        tickers = [r["ticker"] for r in (res.data or []) if r.get("ticker")]
    else:
        print("ERROR: Debe especificar --tickers (ej: NVDA,AAPL) o --top (ej: 50)", file=sys.stderr)
        sys.exit(1)

    print(f"Iniciando precarga de 3 años de histórico para {len(tickers)} acciones...")

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }

    total_records = 0
    for idx, ticker in enumerate(tickers, 1):
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?range=3y&interval=1d"
        try:
            resp = requests.get(url, headers=headers, timeout=10)
            if resp.status_code != 200:
                print(f"[{idx}/{len(tickers)}] {ticker}: Error HTTP {resp.status_code}")
                continue

            data = resp.json()
            result = data.get("chart", {}).get("result", [{}])[0]
            timestamps = result.get("timestamp", [])
            quotes = result.get("indicators", {}).get("quote", [{}])[0]
            closes = quotes.get("close", [])
            volumes = quotes.get("volume", [])
            opens = quotes.get("open", [])
            highs = quotes.get("high", [])
            lows = quotes.get("low", [])

            rows = []
            for i in range(len(timestamps)):
                c = closes[i]
                if c is None or c <= 0:
                    continue
                dt = datetime.fromtimestamp(timestamps[i], timezone.utc).date().isoformat()
                rows.append({
                    "ticker": ticker,
                    "price_date": dt,
                    "open_price": round(opens[i], 2) if opens and opens[i] else None,
                    "high_price": round(highs[i], 2) if highs and highs[i] else None,
                    "low_price": round(lows[i], 2) if lows and lows[i] else None,
                    "close_price": round(c, 2),
                    "volume": int(volumes[i]) if volumes and volumes[i] else None
                })

            if rows:
                for b in range(0, len(rows), 200):
                    client.table(table_name).upsert(rows[b:b+200], on_conflict="ticker,price_date").execute()
                total_records += len(rows)
                print(f"[{idx}/{len(tickers)}] {ticker}: {len(rows)} días precargados exitosamente.")

            time.sleep(0.3)
        except Exception as e:
            print(f"[{idx}/{len(tickers)}] {ticker}: Error al procesar: {e}", file=sys.stderr)

    print(f"Precarga finalizada. {total_records} registros históricos insertados en Supabase.")


def main():
    parser = argparse.ArgumentParser(
        description="Sincronizador Finviz -> Supabase para Inversor Colombia",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # fetch
    p_fetch = subparsers.add_parser("fetch")
    p_fetch.add_argument("--limit", type=int, default=None, help="Límite máximo de acciones (opcional)")
    p_fetch.add_argument("--min-market-cap", type=float, default=DEFAULT_MIN_MARKET_CAP, help="Capitalización bursátil mínima en millones USD (1000 = $1B)")
    p_fetch.add_argument("--output", type=str, required=True)
    p_fetch.add_argument("--filters", type=str, default=DEFAULT_FILTER_CODE)
    p_fetch.add_argument("--order", type=str, default=DEFAULT_ORDER)
    p_fetch.add_argument("--sleep", type=float, default=0.35)
    p_fetch.add_argument("--export-csv", type=str, default=None)
    p_fetch.set_defaults(func=cmd_fetch)

    # push
    p_push = subparsers.add_parser("push")
    p_push.add_argument("--input", type=str, required=True)
    p_push.add_argument("--batch-size", type=int, default=150)
    p_push.add_argument("--retention-days", type=int, default=30)
    p_push.set_defaults(func=cmd_push)

    # sync
    p_sync = subparsers.add_parser("sync")
    p_sync.add_argument("--limit", type=int, default=None, help="Límite máximo de acciones (opcional)")
    p_sync.add_argument("--min-market-cap", type=float, default=DEFAULT_MIN_MARKET_CAP, help="Capitalización bursátil mínima en millones USD (1000 = $1B)")
    p_sync.add_argument("--output", type=str, default="data/latest_snapshot.json")
    p_sync.add_argument("--filters", type=str, default=DEFAULT_FILTER_CODE)
    p_sync.add_argument("--order", type=str, default=DEFAULT_ORDER)
    p_sync.add_argument("--batch-size", type=int, default=150)
    p_sync.add_argument("--retention-days", type=int, default=30)
    p_sync.add_argument("--sleep", type=float, default=0.35)
    p_sync.set_defaults(func=cmd_sync)

    # backfill-prices
    p_backfill = subparsers.add_parser("backfill-prices", help="Precarga de 3 años de precios en stock_prices_history")
    p_backfill.add_argument("--tickers", type=str, default=None, help="Lista de tickers separados por coma (ej: NVDA,AAPL,PSX)")
    p_backfill.add_argument("--top", type=int, default=None, help="Número de acciones top por market cap a precargar")
    p_backfill.set_defaults(func=cmd_backfill_prices)

    # test-connection
    p_test = subparsers.add_parser("test-connection")
    p_test.set_defaults(func=cmd_test_connection)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
