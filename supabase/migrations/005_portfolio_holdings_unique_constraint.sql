-- ==============================================
-- Roneira AI HIFI — portfolio_holdings uniqueness
-- One row per (user, ticker) so buys/sells against an existing
-- position can be applied as an atomic upsert instead of a
-- read-then-write race between concurrent requests.
-- ==============================================

ALTER TABLE public.portfolio_holdings
  ADD CONSTRAINT portfolio_holdings_user_ticker_unique UNIQUE (user_id, ticker);
