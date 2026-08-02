-- ==============================================
-- Roneira AI HIFI — make audit_log append-only at the DB level
--
-- Prior state: audit_log had no DELETE (or UPDATE) policy for anon/
-- authenticated, which blocks those roles through PostgREST/the Supabase
-- client. That is an RLS guarantee, not a hard one: RLS is bypassed entirely
-- by the service_role connection and by a superuser/table-owner session (e.g.
-- this SQL editor, running as postgres). Nothing in src/ currently deletes or
-- updates audit_log rows, but "append-only" as a guardrail (task.md) should
-- hold even if a future service_role-authenticated code path tries it, not
-- just for the roles RLS restricts.
--
-- Fix: a BEFORE DELETE/UPDATE trigger. Triggers fire regardless of RLS/role
-- (RLS bypass only skips *policies*, not triggers), so this closes the gap
-- RLS leaves open.
-- ==============================================

CREATE OR REPLACE FUNCTION public.reject_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only: % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_no_delete ON public.audit_log;
CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.reject_audit_log_mutation();

DROP TRIGGER IF EXISTS audit_log_no_update ON public.audit_log;
CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.reject_audit_log_mutation();

-- ---- verification (safe to run; changes nothing) ----
-- Expect two rows: audit_log_no_delete (DELETE), audit_log_no_update (UPDATE)
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'public' AND event_object_table = 'audit_log'
ORDER BY trigger_name;
