-- Captured historical portfolio values, not a volatile per-symbol quote cache.
-- Editable current holdings do not establish the composition of a past book:
-- history starts when an authenticated user requests a server-calculated capture.
CREATE TABLE IF NOT EXISTS public.portfolio_valuation_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  valuation_date DATE NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  holdings_observed_at TIMESTAMPTZ NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('INR', 'USD')),
  invested_value NUMERIC,
  current_value NUMERIC,
  pnl NUMERIC GENERATED ALWAYS AS (current_value - invested_value) STORED,
  pnl_percent NUMERIC,
  total_holdings INTEGER NOT NULL CHECK (total_holdings BETWEEN 0 AND 200),
  priced_holdings INTEGER NOT NULL CHECK (priced_holdings BETWEEN 0 AND total_holdings),
  coverage_complete BOOLEAN NOT NULL,
  usd_inr NUMERIC,
  exclusions JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(exclusions) = 'array'),
  quote_sources JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(quote_sources) = 'array'),
  UNIQUE (user_id, valuation_date, currency),
  CHECK (isfinite(valuation_date) AND isfinite(captured_at) AND isfinite(holdings_observed_at)),
  CHECK (valuation_date = (captured_at AT TIME ZONE 'UTC')::date),
  CHECK (holdings_observed_at <= captured_at),
  CHECK (coverage_complete = (priced_holdings = total_holdings)),
  CHECK (usd_inr IS NULL OR (usd_inr > 0 AND usd_inr < 'Infinity'::numeric)),
  CHECK (
    (total_holdings > 0 AND priced_holdings = 0
      AND invested_value IS NULL AND current_value IS NULL AND pnl IS NULL AND pnl_percent IS NULL)
    OR
    ((total_holdings = 0 OR priced_holdings > 0)
      AND invested_value IS NOT NULL AND invested_value >= 0 AND invested_value < 'Infinity'::numeric
      AND current_value IS NOT NULL AND current_value >= 0 AND current_value < 'Infinity'::numeric
      AND pnl IS NOT NULL AND pnl > '-Infinity'::numeric AND pnl < 'Infinity'::numeric
      AND ((total_holdings = 0 AND invested_value = 0 AND current_value = 0)
        OR (total_holdings > 0 AND current_value > 0))
      AND (pnl_percent IS NULL OR (invested_value > 0 AND pnl_percent > '-Infinity'::numeric AND pnl_percent < 'Infinity'::numeric))
      AND (invested_value > 0 OR pnl_percent IS NULL))
  )
);

ALTER TABLE public.portfolio_valuation_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own portfolio valuations"
  ON public.portfolio_valuation_snapshots FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- A normal authenticated user may request a capture through Next.js, but cannot
-- manufacture historical totals by writing directly through the public API.
REVOKE ALL ON public.portfolio_valuation_snapshots FROM anon, authenticated;
GRANT SELECT ON public.portfolio_valuation_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.portfolio_valuation_snapshots TO service_role;

-- Concurrent HTTP requests can finish their database writes out of order. A
-- delayed older capture must return, rather than overwrite, the newer record.
CREATE OR REPLACE FUNCTION public.save_portfolio_valuation_snapshot(p_snapshot JSONB)
RETURNS public.portfolio_valuation_snapshots
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  saved public.portfolio_valuation_snapshots%ROWTYPE;
BEGIN
  INSERT INTO public.portfolio_valuation_snapshots (
    user_id, valuation_date, captured_at, holdings_observed_at, currency,
    invested_value, current_value, pnl_percent, total_holdings, priced_holdings,
    coverage_complete, usd_inr, exclusions, quote_sources
  )
  SELECT incoming.* FROM jsonb_to_record(p_snapshot) AS incoming(
    user_id UUID, valuation_date DATE, captured_at TIMESTAMPTZ, holdings_observed_at TIMESTAMPTZ, currency TEXT,
    invested_value NUMERIC, current_value NUMERIC, pnl_percent NUMERIC, total_holdings INTEGER, priced_holdings INTEGER,
    coverage_complete BOOLEAN, usd_inr NUMERIC, exclusions JSONB, quote_sources JSONB
  )
  ON CONFLICT (user_id, valuation_date, currency) DO UPDATE SET
    captured_at = EXCLUDED.captured_at,
    holdings_observed_at = EXCLUDED.holdings_observed_at,
    invested_value = EXCLUDED.invested_value,
    current_value = EXCLUDED.current_value,
    pnl_percent = EXCLUDED.pnl_percent,
    total_holdings = EXCLUDED.total_holdings,
    priced_holdings = EXCLUDED.priced_holdings,
    coverage_complete = EXCLUDED.coverage_complete,
    usd_inr = EXCLUDED.usd_inr,
    exclusions = EXCLUDED.exclusions,
    quote_sources = EXCLUDED.quote_sources
  WHERE EXCLUDED.captured_at >= portfolio_valuation_snapshots.captured_at
  RETURNING * INTO saved;
  IF saved.id IS NULL THEN
    SELECT * INTO saved FROM public.portfolio_valuation_snapshots
    WHERE user_id = (p_snapshot->>'user_id')::UUID
      AND valuation_date = (p_snapshot->>'valuation_date')::DATE
      AND currency = p_snapshot->>'currency';
  END IF;
  RETURN saved;
END;
$$;

REVOKE ALL ON FUNCTION public.save_portfolio_valuation_snapshot(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_portfolio_valuation_snapshot(JSONB) TO service_role;
