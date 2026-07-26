-- ==============================================
-- Roneira AI HIFI — fix infinite recursion in admin RLS policies
-- "Admins can read all X" policies queried public.users from within
-- a policy ON public.users (and were evaluated for every SELECT,
-- including anon username lookups, since Postgres OR's all permissive
-- policies together). Route the admin check through a SECURITY DEFINER
-- function so it bypasses RLS instead of re-triggering it.
-- ==============================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin');
$$;

DROP POLICY IF EXISTS "Admins can read all profiles" ON public.users;
CREATE POLICY "Admins can read all profiles"
  ON public.users FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can read all holdings" ON public.portfolio_holdings;
CREATE POLICY "Admins can read all holdings"
  ON public.portfolio_holdings FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can read all transactions" ON public.portfolio_transactions;
CREATE POLICY "Admins can read all transactions"
  ON public.portfolio_transactions FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can read all audit logs" ON public.audit_log;
CREATE POLICY "Admins can read all audit logs"
  ON public.audit_log FOR SELECT
  USING (public.is_admin());
