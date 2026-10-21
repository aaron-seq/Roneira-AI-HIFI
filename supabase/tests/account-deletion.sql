-- Disposable database only. All fixtures, including attack triggers, roll back.
BEGIN;
-- These names/types must never shadow trusted function lookups.
CREATE TEMP TABLE users(id pg_catalog.uuid);
CREATE TEMP TABLE audit_log(id pg_catalog.uuid);
CREATE DOMAIN pg_temp.uuid AS text CHECK (VALUE = 'unusable shadow type');
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
 ('a1750000-0000-0000-0000-000000000001', 'delete-a@example.test', '{"username":"delete_a"}'),
 ('a1750000-0000-0000-0000-000000000002', 'delete-b@example.test', '{"username":"delete_b"}'),
 ('a1750000-0000-0000-0000-000000000003', 'delete-c@example.test', '{"username":"delete_c"}');
INSERT INTO public.portfolio_holdings (id,user_id,ticker,company_name,exchange,quantity,avg_buy_price) VALUES
 ('a1750000-0000-0000-0000-000000000011','a1750000-0000-0000-0000-000000000001','SYNTH.NS','Synthetic','NSE',2,100),
 ('a1750000-0000-0000-0000-000000000012','a1750000-0000-0000-0000-000000000002','SYNTH.NS','Synthetic','NSE',3,100),
 ('a1750000-0000-0000-0000-000000000013','a1750000-0000-0000-0000-000000000003','SYNTH.NS','Synthetic','NSE',4,100);
INSERT INTO public.watchlist (id,user_id,ticker,exchange,notes) VALUES
 ('a1750000-0000-0000-0000-000000000021','a1750000-0000-0000-0000-000000000001','SYNTH.NS','NSE','retain event evidence'),
 ('a1750000-0000-0000-0000-000000000022','a1750000-0000-0000-0000-000000000002','SYNTH.NS','NSE','survivor'),
 ('a1750000-0000-0000-0000-000000000023','a1750000-0000-0000-0000-000000000003','SYNTH.NS','NSE','serial child deletion');
UPDATE public.portfolio_holdings SET quantity=3 WHERE id='a1750000-0000-0000-0000-000000000011';
DO $$ BEGIN
 ASSERT EXISTS(SELECT 1 FROM public.audit_log WHERE action_type='EDIT_HOLDING'
  AND entity_id='a1750000-0000-0000-0000-000000000011'
  AND old_values->>'quantity'='2' AND new_values->>'quantity'='3'),
  'ordinary holding edits must retain their original audit contract';
END $$;
CREATE TEMP TABLE original_events AS SELECT * FROM public.audit_log;

-- Red on014: real parent deletion invokes the immutable UPDATE guard.
DELETE FROM auth.users WHERE id='a1750000-0000-0000-0000-000000000001';
DO $$ BEGIN
 ASSERT NOT EXISTS(SELECT 1 FROM public.users WHERE id='a1750000-0000-0000-0000-000000000001');
 ASSERT NOT EXISTS(SELECT 1 FROM public.portfolio_holdings WHERE user_id='a1750000-0000-0000-0000-000000000001');
 ASSERT NOT EXISTS(SELECT 1 FROM public.watchlist WHERE user_id='a1750000-0000-0000-0000-000000000001');
 ASSERT NOT EXISTS(SELECT 1 FROM public.news_preferences WHERE user_id='a1750000-0000-0000-0000-000000000001');
 ASSERT NOT EXISTS(SELECT 1 FROM original_events o LEFT JOIN public.audit_log a USING(id)
   WHERE a.id IS NULL OR (pg_catalog.to_jsonb(a)-'user_id') IS DISTINCT FROM (pg_catalog.to_jsonb(o)-'user_id')),
   'all preexisting immutable event fields must survive account deletion';
 ASSERT NOT EXISTS(SELECT 1 FROM public.audit_log WHERE user_id='a1750000-0000-0000-0000-000000000001');
 ASSERT (SELECT count(*) FROM public.audit_log WHERE user_id IS NULL AND old_values->>'user_id'='a1750000-0000-0000-0000-000000000001'
   AND action_type IN ('DELETE_HOLDING','REMOVE_WATCHLIST'))=2, 'cascade writers must append both retained OLD payloads';
 ASSERT EXISTS(SELECT 1 FROM public.audit_log WHERE user_id IS NULL AND new_values->>'email'='delete-a@example.test'),
   'retained signup payload must not be misrepresented as erased';
 ASSERT EXISTS(SELECT 1 FROM public.portfolio_holdings WHERE user_id='a1750000-0000-0000-0000-000000000002');
END $$;

-- Opposite serial order: normal child deletion retains live actor attribution.
DELETE FROM public.portfolio_holdings WHERE user_id='a1750000-0000-0000-0000-000000000003';
DELETE FROM public.watchlist WHERE user_id='a1750000-0000-0000-0000-000000000003';
DO $$ BEGIN
 ASSERT (SELECT count(*) FROM public.audit_log WHERE user_id='a1750000-0000-0000-0000-000000000003'
   AND action_type IN ('DELETE_HOLDING','REMOVE_WATCHLIST'))=2;
END $$;
DELETE FROM auth.users WHERE id='a1750000-0000-0000-0000-000000000003';
-- The Auth fixture's separate auth.uid() function uses its caller's path.
-- Limit the type-shadow attack to the three functions under review.
DROP DOMAIN pg_temp.uuid;

-- A nested caller does not suffice: the actual live parent must be absent.
CREATE FUNCTION pg_temp.attempt_audit_rewrite() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 UPDATE public.audit_log SET user_id=NULL WHERE user_id=NEW.id;
 RETURN NEW;
END $$;
CREATE TEMP TABLE nesting_probe(id pg_catalog.uuid);
CREATE TRIGGER nested_probe AFTER INSERT ON nesting_probe
 FOR EACH ROW EXECUTE FUNCTION pg_temp.attempt_audit_rewrite();
-- Deliberately expose audit UPDATE/SELECT in this rollback-only probe. The
-- trigger must remain safe even when caller RLS hides the real parent.
CREATE POLICY deletion_probe_read ON public.audit_log FOR SELECT TO authenticated USING(true);
CREATE POLICY deletion_probe_update ON public.audit_log FOR UPDATE TO authenticated USING(true) WITH CHECK(true);
GRANT INSERT ON nesting_probe TO authenticated;
SELECT set_config('request.jwt.claim.sub','a1750000-0000-0000-0000-000000000001',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE denied boolean:=false; BEGIN
 ASSERT NOT EXISTS(SELECT 1 FROM public.users WHERE id='a1750000-0000-0000-0000-000000000002'),
  'the probe caller must not see the real surviving parent through RLS';
 BEGIN INSERT INTO nesting_probe VALUES('a1750000-0000-0000-0000-000000000002');
 EXCEPTION WHEN raise_exception THEN denied:=SQLERRM='audit_log is append-only: UPDATE is not permitted'; END;
 ASSERT denied, 'nested direct nulling of a live parent must fail';
END $$;
RESET ROLE;
DROP POLICY deletion_probe_read ON public.audit_log;
DROP POLICY deletion_probe_update ON public.audit_log;

SET LOCAL ROLE service_role;
DO $$ DECLARE mutation text; denied boolean; BEGIN
 FOREACH mutation IN ARRAY ARRAY[
  'UPDATE public.audit_log SET user_id=NULL WHERE user_id=''a1750000-0000-0000-0000-000000000002''',
  'UPDATE public.audit_log SET user_id=''a1750000-0000-0000-0000-000000000002'' WHERE user_id IS NULL',
  'UPDATE public.audit_log SET action_type=''LOGIN'' WHERE user_id IS NULL',
  'UPDATE public.audit_log SET old_values=''{}''::jsonb WHERE user_id IS NULL',
  'UPDATE public.audit_log SET new_values=''{}''::jsonb WHERE user_id IS NULL',
  'UPDATE public.audit_log SET ip_address=''forged'',user_agent=''forged'',created_at=now() WHERE user_id IS NULL',
  'DELETE FROM public.audit_log WHERE user_id IS NULL'
 ] LOOP
  denied:=false;
  BEGIN EXECUTE mutation;
  EXCEPTION WHEN raise_exception THEN denied:=SQLERRM LIKE 'audit_log is append-only:%'; END;
  ASSERT denied, 'service role must not rewrite retained events or their links';
 END LOOP;
END $$;
RESET ROLE;

INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('a1750000-0000-0000-0000-000000000004','delete-a@example.test','{"username":"delete_a"}');
SELECT set_config('request.jwt.claim.sub','a1750000-0000-0000-0000-000000000004',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 ASSERT (SELECT count(*) FROM public.audit_log)=1,
  'reusing a deleted email/username must not reattach retained events to the new account';
 ASSERT NOT EXISTS(SELECT 1 FROM public.audit_log WHERE user_id IS NULL);
END $$;
RESET ROLE;

-- Even a nested rewrite during actual parent deletion cannot edit event fields.
CREATE FUNCTION pg_temp.tamper_during_delete() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 UPDATE public.audit_log SET user_id=NULL,new_values='{"forged":true}'::jsonb
 WHERE user_id=OLD.id OR new_values->>'email'='delete-b@example.test';
 RETURN OLD;
END $$;
-- Sort before PostgreSQL's RI_ConstraintTrigger_* cleanup, while audit links
-- are still nonnull but the parent is already absent. This tests field equality.
CREATE TRIGGER "00_tamper_probe" AFTER DELETE ON public.users
 FOR EACH ROW EXECUTE FUNCTION pg_temp.tamper_during_delete();
DO $$ DECLARE denied boolean:=false; BEGIN
 BEGIN DELETE FROM auth.users WHERE id='a1750000-0000-0000-0000-000000000002';
 EXCEPTION WHEN raise_exception THEN denied:=SQLERRM LIKE 'audit_log is append-only:%'; END;
 ASSERT denied, 'parent absence must never authorize event tampering';
 ASSERT EXISTS(SELECT 1 FROM public.users WHERE id='a1750000-0000-0000-0000-000000000002'),
  'a failed audit guard must roll back the whole account deletion';
END $$;
DROP TRIGGER "00_tamper_probe" ON public.users;

-- Surviving clients cannot read orphaned history or mutate/append it directly.
SELECT set_config('request.jwt.claim.sub','a1750000-0000-0000-0000-000000000002',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 ASSERT NOT EXISTS(SELECT 1 FROM public.audit_log WHERE user_id IS NULL);
 UPDATE public.audit_log SET user_id=NULL WHERE user_id='a1750000-0000-0000-0000-000000000002';
 ASSERT NOT EXISTS(SELECT 1 FROM public.audit_log WHERE user_id IS NULL);
END $$;
RESET ROLE;

-- Owner DML is also guarded; schema-changing administrators are inherently trusted.
DO $$ DECLARE denied boolean:=false; BEGIN
 BEGIN DELETE FROM public.audit_log WHERE user_id IS NULL;
 EXCEPTION WHEN raise_exception THEN denied:=SQLERRM LIKE 'audit_log is append-only:%'; END;
 ASSERT denied;
 denied:=false;
 BEGIN UPDATE public.audit_log SET entity_type='settings' WHERE user_id IS NULL;
 EXCEPTION WHEN raise_exception THEN denied:=SQLERRM LIKE 'audit_log is append-only:%'; END;
 ASSERT denied, 'owner DML must not rewrite retained event fields';
END $$;
ROLLBACK;
