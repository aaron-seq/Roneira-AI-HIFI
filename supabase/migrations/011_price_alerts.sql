-- Price alerts that actually fire (#148, docs/adr/0001-alerts-on-vercel-cron.md).
--
-- watchlist.alert_price has existed since 001 and the UI lets users set it, but
-- nothing evaluated it. /api/cron/alerts now does, once per market close.

-- One-shot alerts: set when the alert fires, cleared when the user re-arms it
-- by setting a level again. The cron only considers rows where this is NULL,
-- and marks them with a conditional UPDATE, so a re-run cannot fire twice.
ALTER TABLE public.watchlist
  ADD COLUMN IF NOT EXISTS alert_triggered_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS watchlist_armed_alerts_idx
  ON public.watchlist (ticker)
  WHERE alert_price IS NOT NULL AND alert_triggered_at IS NULL;

-- In-app notifications, read by the header bell. Written only by the service
-- role (the cron route); users can read theirs and mark them read, nothing else.
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('PRICE_ALERT')),
  ticker TEXT,
  title TEXT NOT NULL,
  body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can mark own notifications read"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Column-level, same reasoning as 010: a row policy alone would let a user
-- rewrite the title/body of their own notifications.
REVOKE INSERT, UPDATE, DELETE ON public.notifications FROM anon, authenticated;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;
