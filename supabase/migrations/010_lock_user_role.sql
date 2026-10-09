-- Close two paths by which any signed-up user could make themselves admin.
--
-- Admins can read every user's profile (including email), holdings,
-- transactions and audit log (see 007_fix_admin_policy_recursion.sql), so
-- `role` is a privilege boundary and must only ever be set by the database
-- owner or the service role (scripts/seed-admin.mjs does exactly that).
--
-- 1. handle_new_user copied `role` out of raw_user_meta_data. That field is
--    whatever the client passes to supabase.auth.signUp({ options: { data } }),
--    and the anon key that call needs ships in every client bundle, so
--    `data: { role: "admin" }` produced an admin.
--
-- 2. "Users can update own profile" restricts rows, not columns, so a user
--    could PATCH their own row with {"role": "admin"} through PostgREST.
--    Column privileges close it: authenticated may update only the profile
--    fields the app edits (settings page: username, full_name, preferences;
--    plus avatar_url). `email` is excluded too -- it is the login lookup key
--    and is UNIQUE, so claiming someone else's address ahead of their signup
--    would make their signup fail.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, username, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    'user'
  );

  INSERT INTO public.news_preferences (user_id)
  VALUES (NEW.id);

  INSERT INTO public.audit_log (user_id, action_type, entity_type, new_values)
  VALUES (
    NEW.id,
    'SIGNUP',
    'auth',
    jsonb_build_object('email', NEW.email, 'username', COALESCE(NEW.raw_user_meta_data->>'username', ''))
  );

  RETURN NEW;
END;
$$;

REVOKE UPDATE ON public.users FROM anon, authenticated;
GRANT UPDATE (username, full_name, avatar_url, preferences) ON public.users TO authenticated;
