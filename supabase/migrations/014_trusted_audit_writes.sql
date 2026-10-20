-- Public Data API clients must not bypass the authenticated Next.js audit
-- route's actor binding, payload validation and rate limit. The original
-- "System" policy actually allowed every role to append rows for any user.
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_log;
REVOKE INSERT ON public.audit_log FROM PUBLIC, anon, authenticated;

-- Backend writes use this role only after verifying the caller. Existing
-- SECURITY DEFINER signup/portfolio/watchlist triggers run as their owner.
GRANT INSERT ON public.audit_log TO service_role;

-- Keep existing SELECT RLS and immutable UPDATE/DELETE triggers unchanged.
