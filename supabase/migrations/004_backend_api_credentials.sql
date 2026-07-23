-- ==============================================
-- Roneira AI HIFI — Backend API credentials
-- Supports the Express backend's own JWT-based
-- authentication (distinct from Supabase Auth,
-- which the frontend uses directly via supabase-js).
-- ==============================================

CREATE TABLE IF NOT EXISTS public.api_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT UNIQUE NOT NULL CHECK (char_length(username) BETWEEN 3 AND 32),
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_credentials_username ON public.api_credentials(username);

CREATE TRIGGER update_api_credentials_updated_at
  BEFORE UPDATE ON public.api_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Accessed exclusively via the backend's direct Postgres connection
-- (DATABASE_URL), never through PostgREST/anon/authenticated roles.
ALTER TABLE public.api_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.api_credentials FROM anon, authenticated;
