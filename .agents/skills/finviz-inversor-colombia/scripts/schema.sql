-- ============================================================
-- Esquema de Base de Datos para Aplicativo: "Inversor Colombia"
-- Tabla: inversor_colombia_stocks (Histórico móvil de 30 días)
-- Motor: PostgreSQL (Supabase)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.inversor_colombia_stocks (
    -- Clave Primaria Compuesta: Ticker + Fecha de Snapshot
    ticker VARCHAR(15) NOT NULL,
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Perfil e Identificación
    company VARCHAR(255),
    sector VARCHAR(100),
    industry VARCHAR(150),
    country VARCHAR(100),
    ipo_date VARCHAR(50),
    index_name VARCHAR(100),
    asset_type VARCHAR(50),

    -- Valoración y Múltiplos
    market_cap NUMERIC,
    price NUMERIC,
    pe NUMERIC,
    forward_pe NUMERIC,
    peg NUMERIC,
    ps NUMERIC,
    enterprise_value NUMERIC,
    ev_ebitda NUMERIC,
    ev_sales NUMERIC,

    -- Beneficios, Ingresos y Crecimiento
    eps NUMERIC,
    eps_this_y NUMERIC,
    eps_next_y NUMERIC,
    eps_past_5y NUMERIC,
    eps_next_5y NUMERIC,
    sales_past_5y NUMERIC,
    eps_qq NUMERIC,
    sales_qq NUMERIC,
    eps_next_q NUMERIC,
    income NUMERIC,
    sales NUMERIC,
    eps_surprise NUMERIC,
    revenue_surprise NUMERIC,
    eps_yoy_ttm NUMERIC,
    sales_yoy_ttm NUMERIC,
    eps_past_3y NUMERIC,

    -- Rentabilidad y Solvencia
    roa NUMERIC,
    roe NUMERIC,
    roic NUMERIC,
    curr_r NUMERIC,
    quick_r NUMERIC,
    lt_debt_eq NUMERIC,
    debt_eq NUMERIC,
    gross_m NUMERIC,
    oper_m NUMERIC,
    profit_m NUMERIC,
    cash_sh NUMERIC,

    -- Dividendos
    dividend NUMERIC,
    dividend_gr_1y NUMERIC,
    dividend_gr_3y NUMERIC,

    -- Estructura Accionaria y Cortos
    outstanding BIGINT,
    float_shares BIGINT,
    insider_own NUMERIC,
    inst_own NUMERIC,
    inst_trans NUMERIC,
    short_float NUMERIC,
    short_ratio NUMERIC,
    short_interest BIGINT,

    -- Cotización, Precios y Rango
    change_pct NUMERIC,
    volume BIGINT,
    avg_volume BIGINT,
    rel_volume NUMERIC,
    prev_close NUMERIC,
    open NUMERIC,
    high NUMERIC,
    low NUMERIC,
    change_from_open_pct NUMERIC,
    gap_pct NUMERIC,
    w52_range VARCHAR(50),
    w52_high NUMERIC,
    w52_low NUMERIC,
    all_time_high NUMERIC,
    all_time_low NUMERIC,

    -- Indicadores Técnicos y Volatilidad
    beta NUMERIC,
    atr NUMERIC,
    volatility_w NUMERIC,
    volatility_m NUMERIC,
    sma20 NUMERIC,
    sma50 NUMERIC,
    sma200 NUMERIC,
    d50_high NUMERIC,
    d50_low NUMERIC,
    rsi NUMERIC,

    -- Rendimiento Temporal
    perf_week NUMERIC,
    perf_month NUMERIC,
    perf_quart NUMERIC,
    perf_half NUMERIC,
    perf_year NUMERIC,
    perf_ytd NUMERIC,
    perf_3y NUMERIC,
    perf_5y NUMERIC,
    perf_10y NUMERIC,

    -- Estimaciones y Noticias
    recom NUMERIC,
    target_price NUMERIC,
    earnings_date VARCHAR(50),
    news_url TEXT,
    news_title TEXT,
    daily_digest TEXT,

    -- Específicos para Fondos y ETFs
    single_category VARCHAR(100),
    tags TEXT,
    expense NUMERIC,
    holdings BIGINT,
    aum NUMERIC,
    return_1y NUMERIC,
    return_3y NUMERIC,
    return_5y NUMERIC,

    -- Auditoría
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),

    PRIMARY KEY (ticker, snapshot_date)
);

-- Índices optimizados para consultas por fecha y por acción
CREATE INDEX IF NOT EXISTS idx_inversor_stocks_date ON public.inversor_colombia_stocks (snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_inversor_stocks_ticker ON public.inversor_colombia_stocks (ticker);
CREATE INDEX IF NOT EXISTS idx_inversor_stocks_sector ON public.inversor_colombia_stocks (sector);
CREATE INDEX IF NOT EXISTS idx_inversor_stocks_peg ON public.inversor_colombia_stocks (peg);
CREATE INDEX IF NOT EXISTS idx_inversor_stocks_rsi ON public.inversor_colombia_stocks (rsi);

-- Vista con el snapshot más reciente por Ticker (para cuando el app solo necesite la foto actual)
CREATE OR REPLACE VIEW public.inversor_colombia_latest AS
SELECT DISTINCT ON (ticker) *
FROM public.inversor_colombia_stocks
ORDER BY ticker, snapshot_date DESC;

-- Habilitar RLS (Row Level Security) y política de lectura pública
ALTER TABLE public.inversor_colombia_stocks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'inversor_colombia_stocks' 
        AND policyname = 'Permitir lectura publica de stocks'
    ) THEN
        CREATE POLICY "Permitir lectura publica de stocks" 
        ON public.inversor_colombia_stocks 
        FOR SELECT 
        USING (true);
    END IF;
END $$;
