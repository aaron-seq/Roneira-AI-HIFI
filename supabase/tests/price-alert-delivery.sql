-- Run as the database owner on a disposable database after migrations 001-012.
-- Real SQL assertions cover rollback, RLS grants, one-shot behavior and revisions.
-- Every fixture and failure-injection trigger is rolled back at the end.
BEGIN;

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('a1111111-1111-1111-1111-111111111111', 'alert-test-one@example.test', '{"username":"alert_test_one"}'),
  ('b1111111-1111-1111-1111-111111111111', 'alert-test-two@example.test', '{"username":"alert_test_two"}');

INSERT INTO public.watchlist (id, user_id, ticker, exchange, alert_price) VALUES
  ('11111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'TCS.NS', 'NSE', 3500),
  ('22222222-2222-2222-2222-222222222222', 'a1111111-1111-1111-1111-111111111111', 'FAIL.NS', 'NSE', 3500),
  ('33333333-3333-3333-3333-333333333333', 'a1111111-1111-1111-1111-111111111111', 'REVISION.NS', 'NSE', 3500),
  ('44444444-4444-4444-4444-444444444444', 'a1111111-1111-1111-1111-111111111111', 'DISABLED.NS', 'NSE', 3500),
  ('55555555-5555-5555-5555-555555555555', 'b1111111-1111-1111-1111-111111111111', 'STALE.NS', 'NSE', 3500);

CREATE FUNCTION public.reject_test_notification() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.ticker = 'FAIL.NS' THEN
    RAISE EXCEPTION 'injected notification insert failure' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER reject_test_notification BEFORE INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.reject_test_notification();

SET LOCAL ROLE service_role;
DO $$
DECLARE
  session_date DATE := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  failed BOOLEAN := false;
BEGIN
  ASSERT public.deliver_price_alert('11111111-1111-1111-1111-111111111111', 3500, 0, session_date),
    'armed alert should deliver';
  ASSERT NOT public.deliver_price_alert('11111111-1111-1111-1111-111111111111', 3500, 0, session_date),
    'repeated delivery must not duplicate a notification';
  ASSERT (SELECT count(*) FROM public.notifications WHERE ticker = 'TCS.NS') = 1,
    'one-shot alert should insert exactly one notification';

  BEGIN
    PERFORM public.deliver_price_alert('22222222-2222-2222-2222-222222222222', 3500, 0, session_date);
  EXCEPTION WHEN check_violation THEN
    failed := true;
  END;
  ASSERT failed, 'the injected INSERT error must propagate';
  ASSERT (SELECT alert_triggered_at IS NULL FROM public.watchlist WHERE ticker = 'FAIL.NS'),
    'failed notification INSERT must roll back the alert claim';
  ASSERT NOT EXISTS (SELECT 1 FROM public.notifications WHERE ticker = 'FAIL.NS'),
    'failed notification must not persist';

  UPDATE public.watchlist SET alert_price = 3510 WHERE ticker = 'REVISION.NS';
  UPDATE public.watchlist SET alert_price = 3500 WHERE ticker = 'REVISION.NS';
  UPDATE public.watchlist SET alert_revision = 999 WHERE ticker = 'REVISION.NS';
  UPDATE public.watchlist SET alert_armed_at = '2000-01-01' WHERE ticker = 'REVISION.NS';
  ASSERT (SELECT alert_revision FROM public.watchlist WHERE ticker = 'REVISION.NS') = 2,
    'revision must track changes and cannot be directly overwritten';
  ASSERT (SELECT alert_armed_at > now() - interval '1 minute' FROM public.watchlist WHERE ticker = 'REVISION.NS'),
    'clients must not backdate the server-owned arm time';
  ASSERT NOT public.deliver_price_alert('33333333-3333-3333-3333-333333333333', 3500, 0, session_date),
    'a stale snapshot must not claim a changed-and-restored level';
  ASSERT public.deliver_price_alert('33333333-3333-3333-3333-333333333333', 3500, 2, session_date),
    'the current revision should deliver';
  UPDATE public.watchlist SET alert_triggered_at = NULL WHERE ticker = 'REVISION.NS';
  ASSERT (SELECT alert_revision FROM public.watchlist WHERE ticker = 'REVISION.NS') = 3,
    're-arming the same level must advance the revision';
  ASSERT NOT public.deliver_price_alert('33333333-3333-3333-3333-333333333333', 3500, 2, session_date),
    'a pre-re-arm snapshot must not consume the new alert';
  UPDATE public.watchlist SET alert_price = 3500, alert_triggered_at = NULL WHERE ticker = 'REVISION.NS';
  ASSERT (SELECT alert_revision FROM public.watchlist WHERE ticker = 'REVISION.NS') = 4,
    'explicit same-level re-arm must advance even when already armed';

  UPDATE public.users SET preferences = '{"notifications":{"priceAlerts":false}}'
    WHERE id = 'a1111111-1111-1111-1111-111111111111';
  ASSERT NOT public.deliver_price_alert('44444444-4444-4444-4444-444444444444', 3500, 0, session_date),
    'delivery must re-check notification preferences in the transaction';
  ASSERT (SELECT alert_triggered_at IS NULL FROM public.watchlist WHERE ticker = 'DISABLED.NS'),
    'disabled notification preferences must leave the alert armed';
  ASSERT NOT public.deliver_price_alert('55555555-5555-5555-5555-555555555555', 3500, 0, session_date - 1),
    'a stale session date must not claim an alert';
END;
$$;

RESET ROLE;
DROP TRIGGER reject_test_notification ON public.notifications;
SET LOCAL ROLE service_role;
DO $$
BEGIN
  UPDATE public.users SET preferences = '{}'::jsonb WHERE id = 'a1111111-1111-1111-1111-111111111111';
  ASSERT public.deliver_price_alert('22222222-2222-2222-2222-222222222222', 3500, 0,
    (now() AT TIME ZONE 'Asia/Kolkata')::date), 'failed delivery should remain retryable';
  ASSERT public.deliver_price_alert('55555555-5555-5555-5555-555555555555', 3500, 0,
    (now() AT TIME ZONE 'Asia/Kolkata')::date), 'a current session may deliver for the second user';
END;
$$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'b1111111-1111-1111-1111-111111111111', true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE denied BOOLEAN := false; changed INTEGER;
BEGIN
  ASSERT (SELECT count(*) FROM public.notifications) = 1,
    'notification SELECT must expose only the authenticated user''s rows';
  UPDATE public.notifications SET read_at = now() WHERE ticker = 'TCS.NS';
  GET DIAGNOSTICS changed = ROW_COUNT;
  ASSERT changed = 0, 'a user must not mark another user''s notification read';
  UPDATE public.notifications SET read_at = now() WHERE ticker = 'STALE.NS';
  GET DIAGNOSTICS changed = ROW_COUNT;
  ASSERT changed = 1, 'users must be able to mark their own notification read';
  BEGIN
    UPDATE public.notifications SET title = 'rewritten';
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  ASSERT denied, 'authenticated users must not rewrite notification contents';
  denied := false;
  BEGIN
    PERFORM public.deliver_price_alert('55555555-5555-5555-5555-555555555555', 3500, 0,
      (now() AT TIME ZONE 'Asia/Kolkata')::date);
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  ASSERT denied, 'authenticated users must not invoke the delivery capability';
END;
$$;

RESET ROLE;
SET LOCAL ROLE anon;
DO $$
DECLARE denied BOOLEAN := false;
BEGIN
  BEGIN
    PERFORM public.deliver_price_alert('55555555-5555-5555-5555-555555555555', 3500, 0,
      (now() AT TIME ZONE 'Asia/Kolkata')::date);
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  ASSERT denied, 'anonymous users must not invoke the delivery capability';
END;
$$;

RESET ROLE;
ROLLBACK;
