-- Claiming an alert and inserting its notification must commit together.
-- A failed INSERT previously left alert_triggered_at set permanently (#160).

ALTER TABLE public.watchlist
  ADD COLUMN IF NOT EXISTS alert_revision BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS alert_armed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp();

-- Track changes and re-arms, including a change away from and back to the same
-- level while a cron fetches quotes. The trigger owns the revision, so clients
-- cannot bypass the snapshot check by writing an arbitrary revision themselves.
CREATE OR REPLACE FUNCTION public.track_watchlist_alert_revision()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.alert_revision := 0;
    NEW.alert_armed_at := clock_timestamp();
  ELSIF TG_ARGV[0] = 'set_level'
     OR NEW.alert_price IS DISTINCT FROM OLD.alert_price
     OR (NEW.alert_triggered_at IS NULL AND OLD.alert_triggered_at IS NOT NULL) THEN
    NEW.alert_revision := OLD.alert_revision + 1;
    NEW.alert_armed_at := clock_timestamp();
    IF TG_ARGV[0] = 'set_level' THEN
      NEW.alert_triggered_at := NULL;
    END IF;
  ELSE
    NEW.alert_revision := OLD.alert_revision;
    NEW.alert_armed_at := OLD.alert_armed_at;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER track_watchlist_alert_revision
  BEFORE INSERT OR UPDATE ON public.watchlist
  FOR EACH ROW EXECUTE FUNCTION public.track_watchlist_alert_revision();

-- Explicitly setting a level again re-arms it even if the numeric value and
-- triggered marker have not changed. This runs after the guard above (trigger
-- names are ordered alphabetically) and owns both metadata values too.
CREATE TRIGGER watchlist_alert_level_rearmed
  BEFORE UPDATE OF alert_price ON public.watchlist
  FOR EACH ROW EXECUTE FUNCTION public.track_watchlist_alert_revision('set_level');

-- SECURITY INVOKER preserves the caller's existing RLS/table permissions;
-- only the cron's service role can call this write capability. No public or
-- authenticated user may deliver notifications for another user's watchlist.
CREATE OR REPLACE FUNCTION public.deliver_price_alert(
  p_watchlist_id UUID,
  p_expected_price NUMERIC,
  p_expected_revision BIGINT,
  p_session_date DATE
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH claimed AS (
    UPDATE public.watchlist AS w
    SET alert_triggered_at = now()
    WHERE w.id = p_watchlist_id
      AND w.alert_price = p_expected_price
      AND w.alert_price > 0
      AND w.alert_revision = p_expected_revision
      AND w.alert_triggered_at IS NULL
      AND p_session_date = (now() AT TIME ZONE CASE
        WHEN w.exchange IN ('NSE', 'BSE') THEN 'Asia/Kolkata'
        ELSE 'America/New_York'
      END)::date
      AND EXISTS (
        SELECT 1 FROM public.users AS u
        WHERE u.id = w.user_id
          AND u.preferences #>> '{notifications,priceAlerts}' IS DISTINCT FROM 'false'
      )
    RETURNING w.user_id, w.ticker, w.alert_price
  ), delivered AS (
    INSERT INTO public.notifications (user_id, kind, ticker, title, body)
    SELECT user_id, 'PRICE_ALERT', ticker,
      replace(ticker, '.NS', '') || ' reached ' || alert_price::text,
      'The trading range for ' || p_session_date::text || ' touched your alert level. Set a new level on the Watchlist to re-arm it.'
    FROM claimed
    RETURNING id
  )
  SELECT EXISTS (SELECT 1 FROM delivered);
$$;

REVOKE ALL ON FUNCTION public.deliver_price_alert(UUID, NUMERIC, BIGINT, DATE)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deliver_price_alert(UUID, NUMERIC, BIGINT, DATE)
  TO service_role;
