-- Run as database owner after migrations 001-013 on a disposable database.
-- Every fixture is rolled back; no credentials or provider requests are needed.
BEGIN;

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('a2222222-2222-2222-2222-222222222222', 'history-test-one@example.test', '{"username":"history_test_one"}'),
  ('b2222222-2222-2222-2222-222222222222', 'history-test-two@example.test', '{"username":"history_test_two"}');

SET LOCAL ROLE service_role;
INSERT INTO public.portfolio_valuation_snapshots
  (user_id, valuation_date, captured_at, holdings_observed_at, currency, invested_value, current_value, pnl_percent, total_holdings, priced_holdings, coverage_complete)
VALUES
  ('a2222222-2222-2222-2222-222222222222', '2026-10-19', '2026-10-19T01:00:00Z', '2026-10-19T00:00:00Z', 'INR', 100, 120, 20, 1, 1, true),
  ('b2222222-2222-2222-2222-222222222222', '2026-10-19', '2026-10-19T01:00:00Z', '2026-10-19T00:00:00Z', 'INR', 200, 180, -10, 1, 1, true);

DO $$
DECLARE rejected BOOLEAN; saved public.portfolio_valuation_snapshots%ROWTYPE;
BEGIN
  ASSERT (SELECT pnl = 20 FROM public.portfolio_valuation_snapshots WHERE user_id = 'a2222222-2222-2222-2222-222222222222'),
    'the stored profit must be derived from stored numeric value and cost';
  BEGIN
    INSERT INTO public.portfolio_valuation_snapshots
      (user_id, valuation_date, captured_at, holdings_observed_at, currency, invested_value, current_value, total_holdings, priced_holdings, coverage_complete)
    VALUES ('a2222222-2222-2222-2222-222222222222', '2026-10-19', '2026-10-19T02:00:00Z', '2026-10-19T00:00:00Z', 'INR', 100, 130, 1, 1, true);
  EXCEPTION WHEN unique_violation THEN rejected := true;
  END;
  ASSERT rejected, 'a user can have only one capture per UTC day and currency';

  SELECT * INTO saved FROM public.save_portfolio_valuation_snapshot(jsonb_build_object(
    'user_id', 'b2222222-2222-2222-2222-222222222222', 'valuation_date', '2026-10-19',
    'captured_at', '2026-10-19T03:00:00Z', 'holdings_observed_at', '2026-10-19T02:59:00Z',
    'currency', 'INR', 'invested_value', 200, 'current_value', 210, 'pnl_percent', 5,
    'total_holdings', 1, 'priced_holdings', 1, 'coverage_complete', true,
    'usd_inr', NULL, 'exclusions', '[]'::jsonb, 'quote_sources', '[]'::jsonb
  ));
  ASSERT saved.current_value = 210 AND saved.captured_at = '2026-10-19T03:00:00Z',
    'a newer capture must replace that UTC day''s value';
  SELECT * INTO saved FROM public.save_portfolio_valuation_snapshot(jsonb_build_object(
    'user_id', 'b2222222-2222-2222-2222-222222222222', 'valuation_date', '2026-10-19',
    'captured_at', '2026-10-19T02:00:00Z', 'holdings_observed_at', '2026-10-19T01:59:00Z',
    'currency', 'INR', 'invested_value', 200, 'current_value', 190, 'pnl_percent', -5,
    'total_holdings', 1, 'priced_holdings', 1, 'coverage_complete', true,
    'usd_inr', NULL, 'exclusions', '[]'::jsonb, 'quote_sources', '[]'::jsonb
  ));
  ASSERT saved.current_value = 210 AND saved.captured_at = '2026-10-19T03:00:00Z',
    'a delayed older write must return the latest row without overwriting it';
  ASSERT (SELECT current_value = 210 FROM public.portfolio_valuation_snapshots
    WHERE user_id = 'b2222222-2222-2222-2222-222222222222'),
    'the ordering guarantee must hold in persisted history, not only the RPC response';

  INSERT INTO public.portfolio_valuation_snapshots
    (user_id, valuation_date, captured_at, holdings_observed_at, currency, invested_value, current_value, total_holdings, priced_holdings, coverage_complete)
  VALUES ('a2222222-2222-2222-2222-222222222222', '2026-10-19', '2026-10-19T02:00:00Z', '2026-10-19T00:00:00Z', 'USD', 0, 25, 1, 1, true)
  ON CONFLICT (user_id, valuation_date, currency) DO UPDATE SET current_value = EXCLUDED.current_value;
  ASSERT (SELECT pnl_percent IS NULL AND pnl = 25 FROM public.portfolio_valuation_snapshots
    WHERE user_id = 'a2222222-2222-2222-2222-222222222222' AND currency = 'USD'),
    'zero basis must preserve a monetary gain with no percentage';

  INSERT INTO public.portfolio_valuation_snapshots
    (user_id, valuation_date, captured_at, holdings_observed_at, currency, total_holdings, priced_holdings, coverage_complete, exclusions)
  VALUES ('a2222222-2222-2222-2222-222222222222', '2026-10-18', '2026-10-18T02:00:00Z', '2026-10-18T00:00:00Z', 'INR', 1, 0, false,
    '[{"ticker":"MISSING.NS","reason":"no-quote"}]');
  ASSERT (SELECT current_value IS NULL AND pnl IS NULL FROM public.portfolio_valuation_snapshots
    WHERE user_id = 'a2222222-2222-2222-2222-222222222222' AND valuation_date = '2026-10-18'),
    'an unpriced book must have unknown value, not a fabricated zero';

  rejected := false;
  BEGIN
    UPDATE public.portfolio_valuation_snapshots SET current_value = 'NaN'::numeric
      WHERE user_id = 'b2222222-2222-2222-2222-222222222222';
  EXCEPTION WHEN check_violation THEN rejected := true;
  END;
  ASSERT rejected, 'NaN must not be persisted as a financial value';
  rejected := false;
  BEGIN
    UPDATE public.portfolio_valuation_snapshots SET current_value = 'Infinity'::numeric
      WHERE user_id = 'b2222222-2222-2222-2222-222222222222';
  EXCEPTION WHEN check_violation THEN rejected := true;
  END;
  ASSERT rejected, 'infinity must not be persisted as a financial value';
  rejected := false;
  BEGIN
    UPDATE public.portfolio_valuation_snapshots SET priced_holdings = 2
      WHERE user_id = 'b2222222-2222-2222-2222-222222222222';
  EXCEPTION WHEN check_violation THEN rejected := true;
  END;
  ASSERT rejected, 'coverage cannot exceed the captured book';
END;
$$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'b2222222-2222-2222-2222-222222222222', true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE denied BOOLEAN := false;
BEGIN
  ASSERT (SELECT count(*) FROM public.portfolio_valuation_snapshots) = 1,
    'a session must see only its own captured history';
  ASSERT NOT EXISTS (SELECT 1 FROM public.portfolio_valuation_snapshots WHERE user_id = 'a2222222-2222-2222-2222-222222222222'),
    'an explicit owner filter must not bypass history RLS';
  BEGIN
    UPDATE public.portfolio_valuation_snapshots SET current_value = 999999;
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  ASSERT denied, 'even an owner must not forge history by updating totals';
  denied := false;
  BEGIN
    DELETE FROM public.portfolio_valuation_snapshots;
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  ASSERT denied, 'owners must not delete captured evidence directly';
  denied := false;
  BEGIN
    INSERT INTO public.portfolio_valuation_snapshots
      (user_id, valuation_date, captured_at, holdings_observed_at, currency, invested_value, current_value, total_holdings, priced_holdings, coverage_complete)
    VALUES ('b2222222-2222-2222-2222-222222222222', '2026-10-17', '2026-10-17T01:00:00Z', '2026-10-17T00:00:00Z', 'USD', 0, 999999, 1, 1, true);
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  ASSERT denied, 'owners must request server valuations rather than submitting invented totals';
  denied := false;
  BEGIN
    PERFORM public.save_portfolio_valuation_snapshot('{}'::jsonb);
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  ASSERT denied, 'authenticated clients must not invoke the server valuation persistence capability';
END;
$$;

RESET ROLE;
SET LOCAL ROLE anon;
DO $$
DECLARE denied BOOLEAN := false;
BEGIN
  BEGIN
    PERFORM * FROM public.portfolio_valuation_snapshots;
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  ASSERT denied, 'anonymous requests must not read captured history';
  denied := false;
  BEGIN
    PERFORM public.save_portfolio_valuation_snapshot('{}'::jsonb);
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  ASSERT denied, 'anonymous clients must not invoke the valuation persistence capability';
END;
$$;
RESET ROLE;
ROLLBACK;
