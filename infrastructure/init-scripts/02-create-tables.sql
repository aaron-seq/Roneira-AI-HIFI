-- Roneira AI HIFI - Database Tables Schema
-- Creates tables for portfolio management, historical stock data, and predictions

-- =====================================================
-- PORTFOLIO SCHEMA - User portfolio and holdings
-- =====================================================

-- User portfolios table
CREATE TABLE IF NOT EXISTS portfolio.portfolios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL DEFAULT 'Default Portfolio',
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Portfolio holdings (stocks owned)
CREATE TABLE IF NOT EXISTS portfolio.holdings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id UUID NOT NULL REFERENCES portfolio.portfolios(id) ON DELETE CASCADE,
    ticker VARCHAR(10) NOT NULL,
    shares DECIMAL(18, 8) NOT NULL,
    average_cost DECIMAL(18, 4) NOT NULL,
    purchase_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT positive_shares CHECK (shares > 0),
    CONSTRAINT positive_cost CHECK (average_cost >= 0)
);

-- Index for fast portfolio lookups
CREATE INDEX IF NOT EXISTS idx_holdings_portfolio_id ON portfolio.holdings(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_holdings_ticker ON portfolio.holdings(ticker);

-- =====================================================
-- MARKET DATA SCHEMA - Historical stock prices
-- =====================================================

-- Historical stock prices (TimescaleDB hypertable)
CREATE TABLE IF NOT EXISTS market_data.stock_prices (
    time TIMESTAMPTZ NOT NULL,
    ticker VARCHAR(10) NOT NULL,
    open DECIMAL(18, 4) NOT NULL,
    high DECIMAL(18, 4) NOT NULL,
    low DECIMAL(18, 4) NOT NULL,
    close DECIMAL(18, 4) NOT NULL,
    volume BIGINT NOT NULL,
    adjusted_close DECIMAL(18, 4),
    source VARCHAR(50) DEFAULT 'yahoo_finance'
);

-- Convert to TimescaleDB hypertable for efficient time-series queries
SELECT create_hypertable(
    'market_data.stock_prices',
    'time',
    if_not_exists => TRUE
);

-- Create index for ticker + time queries
CREATE INDEX IF NOT EXISTS idx_stock_prices_ticker_time 
ON market_data.stock_prices(ticker, time DESC);

-- Technical indicators cache
CREATE TABLE IF NOT EXISTS market_data.technical_indicators (
    time TIMESTAMPTZ NOT NULL,
    ticker VARCHAR(10) NOT NULL,
    sma_20 DECIMAL(18, 4),
    sma_50 DECIMAL(18, 4),
    sma_200 DECIMAL(18, 4),
    ema_12 DECIMAL(18, 4),
    ema_26 DECIMAL(18, 4),
    rsi_14 DECIMAL(8, 4),
    macd DECIMAL(18, 4),
    macd_signal DECIMAL(18, 4),
    bollinger_upper DECIMAL(18, 4),
    bollinger_lower DECIMAL(18, 4),
    atr_14 DECIMAL(18, 4)
);

SELECT create_hypertable(
    'market_data.technical_indicators',
    'time',
    if_not_exists => TRUE
);

-- =====================================================
-- ML PREDICTIONS SCHEMA - Prediction history and models
-- =====================================================

-- Prediction history (for backtesting and analysis)
CREATE TABLE IF NOT EXISTS ml_predictions.predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker VARCHAR(10) NOT NULL,
    prediction_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    target_date DATE NOT NULL,
    predicted_price DECIMAL(18, 4) NOT NULL,
    actual_price DECIMAL(18, 4),
    confidence DECIMAL(5, 4) NOT NULL,
    model_type VARCHAR(50) NOT NULL,
    model_version VARCHAR(20),
    pdm_signal VARCHAR(20),
    features_used JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for ticker + prediction time
CREATE INDEX IF NOT EXISTS idx_predictions_ticker_time 
ON ml_predictions.predictions(ticker, prediction_time DESC);

-- PDM strategy signals history
CREATE TABLE IF NOT EXISTS ml_predictions.pdm_signals (
    time TIMESTAMPTZ NOT NULL,
    ticker VARCHAR(10) NOT NULL,
    signal VARCHAR(20) NOT NULL, -- BUY, SELL, HOLD
    strength DECIMAL(5, 4) NOT NULL,
    price_derivative DECIMAL(18, 8),
    volume_derivative DECIMAL(18, 8),
    momentum DECIMAL(18, 8),
    liquidity BIGINT
);

SELECT create_hypertable(
    'ml_predictions.pdm_signals',
    'time',
    if_not_exists => TRUE
);

-- =====================================================
-- SESSION AND CACHE TABLES
-- =====================================================

-- API rate limit tracking
CREATE TABLE IF NOT EXISTS public.rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_ip VARCHAR(45) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 1,
    window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_endpoint 
ON public.rate_limits(client_ip, endpoint, window_start);

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_portfolios_updated_at ON portfolio.portfolios;
CREATE TRIGGER update_portfolios_updated_at
    BEFORE UPDATE ON portfolio.portfolios
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_holdings_updated_at ON portfolio.holdings;
CREATE TRIGGER update_holdings_updated_at
    BEFORE UPDATE ON portfolio.holdings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Log successful table creation
DO $$
BEGIN
    RAISE NOTICE 'All database tables and hypertables created successfully';
END $$;
