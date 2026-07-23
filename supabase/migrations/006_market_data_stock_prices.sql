-- ==============================================
-- Roneira AI HIFI — historical OHLCV cache
-- Backs DatabaseService.insertStockPrices/getStockPrices/getLatestPrice,
-- which previously referenced a table that was never created.
-- ==============================================

CREATE SCHEMA IF NOT EXISTS market_data;

CREATE TABLE IF NOT EXISTS market_data.stock_prices (
  time TIMESTAMPTZ NOT NULL,
  ticker TEXT NOT NULL,
  open NUMERIC NOT NULL,
  high NUMERIC NOT NULL,
  low NUMERIC NOT NULL,
  close NUMERIC NOT NULL,
  volume BIGINT NOT NULL,
  adjusted_close NUMERIC,
  source TEXT NOT NULL,
  PRIMARY KEY (ticker, time)
);

CREATE INDEX IF NOT EXISTS idx_stock_prices_ticker_time
  ON market_data.stock_prices (ticker, time DESC);

-- Accessed exclusively via the backend's direct Postgres connection.
REVOKE ALL ON market_data.stock_prices FROM anon, authenticated;
