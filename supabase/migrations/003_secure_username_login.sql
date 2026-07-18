REVOKE SELECT ON public.users FROM anon;
GRANT SELECT (id, username) ON public.users TO anon;

CREATE POLICY "Anonymous can read usernames"
  ON public.users
  FOR SELECT
  TO anon
  USING (true);
