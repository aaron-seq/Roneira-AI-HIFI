-- ==============================================
-- Roneira AI HIFI — restore anon username lookup
--
-- Symptom: GET /api/auth/username always answered {"available": true}, and
-- username+password login returned 401 for valid credentials. Both routes look
-- up public.users through the anon client; anon was seeing zero rows, so every
-- username looked free and every login looked like a bad password.
--
-- Cause: the "Anonymous can read usernames" policy from 003 is not in effect
-- (RLS filters all rows -- the request returns 200 with an empty array rather
-- than a permission error, which is the signature of a missing policy rather
-- than a missing grant).
--
-- Only id + username are exposed, via the column grant below -- email, role,
-- and preferences stay unreadable to anon.
-- ==============================================

-- Column-level grant: anon may read ONLY these two columns.
GRANT SELECT (id, username) ON public.users TO anon;

DROP POLICY IF EXISTS "Anonymous can read usernames" ON public.users;
CREATE POLICY "Anonymous can read usernames"
  ON public.users
  FOR SELECT
  TO anon
  USING (true);

-- ---- verification (safe to run; returns diagnostics, changes nothing) ----
-- Expect one row: schemaname=public, tablename=users,
-- policyname='Anonymous can read usernames', roles={anon}, cmd=SELECT
SELECT schemaname, tablename, policyname, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'users'
ORDER BY policyname;
