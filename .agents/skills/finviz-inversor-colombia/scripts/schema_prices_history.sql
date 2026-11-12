-- ==============================================================================
-- INVERSOR COLOMBIA: TABLA DE PRECIOS HISTÓRICOS (ESCENARIO B)
-- Almacena series temporales ligeras (OHLCV + RSI) de hasta 3 años de antigüedad
-- 100% SEGURO: No contiene ninguna instrucción DROP destructiva ni elimina datos.
-- ==============================================================================

-- 1. Crear tabla de precios si no existe (no toca tablas existentes ni datos)
CREATE TABLE IF NOT EXISTS public.stock_prices_history (
    ticker TEXT NOT NULL,
    price_date DATE NOT NULL,
    open_price NUMERIC,
    high_price NUMERIC,
    low_price NUMERIC,
    close_price NUMERIC NOT NULL,
    volume BIGINT,
    change_pct NUMERIC,
    rsi NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (ticker, price_date)
);

-- 2. Crear índice para optimizar consultas por ticker y fecha descendente
CREATE INDEX IF NOT EXISTS idx_stock_prices_history_ticker_date 
ON public.stock_prices_history (ticker, price_date DESC);

-- 3. Habilitar seguridad por fila (RLS)
ALTER TABLE public.stock_prices_history ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de acceso público (Lectura y Escritura para la aplicación)
DO $$
BEGIN
    -- 4.1 Lectura pública autorizada para usuarios y aplicación
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'stock_prices_history' AND policyname = 'Lectura publica precios historicos'
    ) THEN
        CREATE POLICY "Lectura publica precios historicos"
        ON public.stock_prices_history
        FOR SELECT
        TO anon, authenticated
        USING (true);
    END IF;

    -- 4.2 Eliminar política insegura previa de escritura abierta si existiese
    DROP POLICY IF EXISTS "Escritura precios historicos" ON public.stock_prices_history;

    -- 4.3 Escritura segura restringida a service_role (ETL/sincronización) y administradores
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'stock_prices_history' AND policyname = 'Escritura segura solo service_role y admin'
    ) THEN
        CREATE POLICY "Escritura segura solo service_role y admin"
        ON public.stock_prices_history
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
    END IF;
END $$;
