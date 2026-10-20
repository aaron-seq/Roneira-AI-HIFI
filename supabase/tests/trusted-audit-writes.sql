-- Run as database owner after migrations001–014 on a disposable database.
-- No hosted state or real accounts are needed; every fixture is rolled back.
BEGIN;

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('a7444444-4444-4444-4444-444444444444', 'audit-owner@example.test', '{"username":"audit_owner_test"}'),
  ('b7444444-4444-4444-4444-444444444444', 'audit-other@example.test', '{"username":"audit_other_test"}');

SET LOCAL ROLE anon;
DO $$
DECLARE target UUID; denied BOOLEAN;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'a7444444-4444-4444-4444-444444444444'::uuid,
    'b7444444-4444-4444-4444-444444444444'::uuid
  ] LOOP
    denied := false;
    BEGIN
      INSERT INTO public.audit_log (user_id, action_type, entity_type)
        VALUES (target, 'LOGIN', 'auth');
    EXCEPTION WHEN insufficient_privilege THEN denied := true;
    END;
    ASSERT denied, 'anonymous clients must not forge audit events for either account';
  END LOOP;
  ASSERT (SELECT count(*) FROM public.audit_log) = 0,
    'anonymous clients must still have no audit read access';
END;
$$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'a7444444-4444-4444-4444-444444444444', true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE target UUID; denied BOOLEAN;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'a7444444-4444-4444-4444-444444444444'::uuid,
    'b7444444-4444-4444-4444-444444444444'::uuid
  ] LOOP
    denied := false;
    BEGIN
      INSERT INTO public.audit_log (user_id, action_type, entity_type)
        VALUES (target, 'LOGIN', 'auth');
    EXCEPTION WHEN insufficient_privilege THEN denied := true;
    END;
    ASSERT denied, 'authenticated clients must use the validated route for own and cross-user events';
  END LOOP;
END;
$$;

-- User operations must continue to emit genuine database-generated audit rows.
INSERT INTO public.portfolio_holdings
  (id, user_id, ticker, company_name, exchange, quantity, avg_buy_price)
VALUES ('c7444444-4444-4444-4444-444444444444', 'a7444444-4444-4444-4444-444444444444',
  'TEST.NS', 'Synthetic audit test', 'NSE', 1, 100);
INSERT INTO public.watchlist (id, user_id, ticker, exchange)
VALUES ('d7444444-4444-4444-4444-444444444444', 'a7444444-4444-4444-4444-444444444444', 'TEST.NS', 'NSE');
DELETE FROM public.portfolio_holdings WHERE id = 'c7444444-4444-4444-4444-444444444444';
DELETE FROM public.watchlist WHERE id = 'd7444444-4444-4444-4444-444444444444';
DO $$
BEGIN
  ASSERT (SELECT count(*) FROM public.audit_log) = 5,
    'the user must see signup and four trigger-generated own activity records';
  ASSERT NOT EXISTS (SELECT 1 FROM public.audit_log WHERE user_id = 'b7444444-4444-4444-4444-444444444444'),
    'the existing audit SELECT policy must retain account isolation';
  ASSERT EXISTS (SELECT 1 FROM public.audit_log WHERE action_type = 'ADD_STOCK')
     AND EXISTS (SELECT 1 FROM public.audit_log WHERE action_type = 'DELETE_HOLDING')
     AND EXISTS (SELECT 1 FROM public.audit_log WHERE action_type = 'ADD_WATCHLIST')
     AND EXISTS (SELECT 1 FROM public.audit_log WHERE action_type = 'REMOVE_WATCHLIST'),
    'revoking public INSERT must not suppress SECURITY DEFINER activity triggers';
END;
$$;

RESET ROLE;
SET LOCAL ROLE service_role;
INSERT INTO public.audit_log (id, user_id, action_type, entity_type, new_values)
VALUES ('e7444444-4444-4444-4444-444444444444', 'b7444444-4444-4444-4444-444444444444',
  'LOGIN', 'auth', '{"source":"trusted-test-writer"}');
DO $$
DECLARE denied BOOLEAN := false;
BEGIN
  BEGIN
    UPDATE public.audit_log SET new_values = '{}'::jsonb
      WHERE id = 'e7444444-4444-4444-4444-444444444444';
  EXCEPTION WHEN raise_exception THEN
    denied := SQLERRM = 'audit_log is append-only: UPDATE is not permitted';
  END;
  ASSERT denied, 'service-role INSERT must not weaken hard UPDATE immutability';
  denied := false;
  BEGIN
    DELETE FROM public.audit_log WHERE id = 'e7444444-4444-4444-4444-444444444444';
  EXCEPTION WHEN raise_exception THEN
    denied := SQLERRM = 'audit_log is append-only: DELETE is not permitted';
  END;
  ASSERT denied, 'service-role INSERT must not weaken hard DELETE immutability';
  ASSERT (SELECT new_values FROM public.audit_log WHERE id = 'e7444444-4444-4444-4444-444444444444')
    = '{"source":"trusted-test-writer"}'::jsonb, 'trusted audit payload must remain intact';
END;
$$;
RESET ROLE;
ROLLBACK;
