-- Keep immutable event evidence while honoring001's nullable live-profile link.
-- See docs/adr/0002-audit-retention-on-account-deletion.md. This is not erasure.
CREATE OR REPLACE FUNCTION public.reject_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND pg_catalog.pg_trigger_depth() > 1
    AND OLD.user_id IS NOT NULL AND NEW.user_id IS NULL
    AND (pg_catalog.to_jsonb(NEW) - 'user_id') IS NOT DISTINCT FROM (pg_catalog.to_jsonb(OLD) - 'user_id')
    AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = OLD.user_id)
  THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'audit_log is append-only: % is not permitted', TG_OP;
END;
$$;

-- During a parent cascade the profile is already absent. Normal child deletes
-- lock and retain the live actor; never use lock failures as missing identity.
CREATE OR REPLACE FUNCTION public.log_portfolio_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE live_user_id pg_catalog.uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (user_id, action_type, entity_type, entity_id, new_values)
    VALUES (NEW.user_id, 'ADD_STOCK', 'portfolio', NEW.id, pg_catalog.to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (user_id, action_type, entity_type, entity_id, old_values, new_values)
    VALUES (NEW.user_id, 'EDIT_HOLDING', 'portfolio', NEW.id, pg_catalog.to_jsonb(OLD), pg_catalog.to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    SELECT id INTO live_user_id FROM public.users WHERE id = OLD.user_id FOR KEY SHARE;
    INSERT INTO public.audit_log (user_id, action_type, entity_type, entity_id, old_values)
    VALUES (live_user_id, 'DELETE_HOLDING', 'portfolio', OLD.id, pg_catalog.to_jsonb(OLD));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.log_watchlist_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE live_user_id pg_catalog.uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (user_id, action_type, entity_type, entity_id, new_values)
    VALUES (NEW.user_id, 'ADD_WATCHLIST', 'watchlist', NEW.id, pg_catalog.to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    SELECT id INTO live_user_id FROM public.users WHERE id = OLD.user_id FOR KEY SHARE;
    INSERT INTO public.audit_log (user_id, action_type, entity_type, entity_id, old_values)
    VALUES (live_user_id, 'REMOVE_WATCHLIST', 'watchlist', OLD.id, pg_catalog.to_jsonb(OLD));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Existing bound triggers continue to execute; these are not callable RPCs.
REVOKE EXECUTE ON FUNCTION public.reject_audit_log_mutation(), public.log_portfolio_change(), public.log_watchlist_change()
  FROM PUBLIC, anon, authenticated, service_role;
