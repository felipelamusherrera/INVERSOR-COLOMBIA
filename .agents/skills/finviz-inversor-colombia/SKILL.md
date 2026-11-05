---
name: finviz-inversor-colombia
description: >-
  Extrae más de 100 métricas financieras clave desde Finviz Screener sin costo de API
  y las sincroniza en Supabase manteniendo un histórico móvil de 30 días para el aplicativo
  "Inversor Colombia". Úsalo cuando el usuario pida actualizar las acciones, sincronizar
  datos con Supabase, consultar métricas de valoración o analizar el comportamiento mensual.
---

# Finviz Inversor Colombia

## Overview
Esta Skill permite extraer automáticamente más de **100 métricas financieras** (fundamentales, de valoración, solvencia, rentabilidad, dividendos y análisis técnico) desde Finviz Screener de forma **100% gratuita** (sin API de pago).

Los datos se normalizan y sincronizan en **Supabase (PostgreSQL)** en la tabla `inversor_colombia_stocks`. 

### Modelo de Ventana Móvil de 30 Días
En lugar de sobreescribir la base de datos a diario, la Skill mantiene un **histórico continuo de los últimos 30 días**:
- Cada registro tiene la clave compuesta `(ticker, snapshot_date)`.
- En cada ejecución diaria, se registra la foto del día (`snapshot_date = CURRENT_DATE`).
- Se purgan automáticamente los registros que superen los **30 días de antigüedad**.
- Se incluye la vista SQL `inversor_colombia_latest` para consultar instantáneamente el estado más reciente de cada acción.

## Dependencies
- Gestor de ejecución: `uv` (`C:\Users\felip\AppData\Local\hermes\bin\uv.exe`).
- Paquetes Python gestionados automáticamente con PEP 723:
  - `finvizfinance`
  - `supabase`
  - `pandas`
  - `python-dotenv`

---

## Quick Start

### 1. Crear o Actualizar la tabla en Supabase
Ejecuta el script SQL en el **SQL Editor** de tu panel de Supabase:
[schema.sql](file:///c:/Users/felip/Documents/IA/ANALIZADOR%20ACCIONES/.agents/skills/finviz-inversor-colombia/scripts/schema.sql)

Crea:
- Tabla `inversor_colombia_stocks` con clave primaria `(ticker, snapshot_date)`.
- Vista `inversor_colombia_latest` (último valor de cada ticker).
- Índices de alto rendimiento para búsquedas por fecha, sector, PEG y RSI.

### 2. Configurar Credenciales en `.env`
Edita o crea el archivo `.env` en la raíz del proyecto:
```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_KEY=tu_supabase_service_role_key
```

### 3. Verificar la Conexión
```bash
uv run .agents/skills/finviz-inversor-colombia/scripts/finviz_sync.py test-connection
```

### 4. Sincronizar al Cierre de Mercado (Todas las acciones > $1B)
```bash
uv run .agents/skills/finviz-inversor-colombia/scripts/finviz_sync.py sync --min-market-cap 1000 --retention-days 30
```

---

## Utility Scripts

Script principal: [finviz_sync.py](file:///c:/Users/felip/Documents/IA/ANALIZADOR%20ACCIONES/.agents/skills/finviz-inversor-colombia/scripts/finviz_sync.py).

### Subcomandos:

#### A. `sync` (Extracción y sincronización en un solo paso)
Extrae por defecto todas las acciones con capitalización bursátil superior a $1.000M ($1B):
```bash
uv run .agents/skills/finviz-inversor-colombia/scripts/finviz_sync.py sync --min-market-cap 1000 --retention-days 30
```

Para extraer únicamente las acciones que cumplen la **Estrategia Inversor Colombia**:
```bash
uv run .agents/skills/finviz-inversor-colombia/scripts/finviz_sync.py sync --filters strategy
```

#### B. `backfill-prices` (Series temporales históricas de 3 años - Escenario B)
Precarga hasta 3 años de cotizaciones diarias (756 sesiones) directamente en la tabla `stock_prices_history`:
```bash
# Para tickers específicos:
uv run .agents/skills/finviz-inversor-colombia/scripts/finviz_sync.py backfill-prices --tickers NVDA,AAPL,MSFT,PSX

# Para las top 50 acciones por capitalización de mercado:
uv run .agents/skills/finviz-inversor-colombia/scripts/finviz_sync.py backfill-prices --top 50
```

#### C. `fetch` y `push` (Flujo desacoplado)
```bash
# Extraer a archivo local:
uv run .agents/skills/finviz-inversor-colombia/scripts/finviz_sync.py fetch --min-market-cap 1000 --output data/stocks.json --export-csv data/stocks.csv

# Subir a Supabase:
uv run .agents/skills/finviz-inversor-colombia/scripts/finviz_sync.py push --input data/stocks.json --retention-days 30
```

---

## Consultas Útiles en Supabase para "Inversor Colombia"

1. **Obtener la foto actual de todas las acciones:**
   ```sql
   SELECT * FROM inversor_colombia_latest ORDER BY peg ASC;
   ```

2. **Obtener el comportamiento de los últimos 30 días para un Ticker específico:**
   ```sql
   SELECT snapshot_date, price, pe, rsi, volume, change_pct 
   FROM inversor_colombia_stocks 
   WHERE ticker = 'PSX' 
   ORDER BY snapshot_date ASC;
   ```

3. **Ver las acciones con mayor crecimiento de precio en el mes:**
   ```sql
   WITH first_day AS (
       SELECT DISTINCT ON (ticker) ticker, price as initial_price, snapshot_date 
       FROM inversor_colombia_stocks ORDER BY ticker, snapshot_date ASC
   ),
   latest_day AS (
       SELECT DISTINCT ON (ticker) ticker, price as current_price, snapshot_date 
       FROM inversor_colombia_stocks ORDER BY ticker, snapshot_date DESC
   )
   SELECT l.ticker, f.initial_price, l.current_price, 
          ROUND(((l.current_price - f.initial_price) / f.initial_price * 100), 2) as monthly_return_pct
   FROM latest_day l
   JOIN first_day f ON l.ticker = f.ticker
   ORDER BY monthly_return_pct DESC;
   ```

---

## Rate Limiting & Web Hygiene
- Pausa de 1 segundo entre páginas de Finviz para navegación amigable y continua sin bloqueos.
- Resguardo local automático en `data/latest_snapshot.json`.
