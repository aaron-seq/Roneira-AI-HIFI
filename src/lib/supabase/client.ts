import { createBrowserClient } from "@supabase/ssr";

// False on a fresh clone with no .env.local. Every Supabase factory throws
// without these, so the callers that run on public pages check this first
// rather than 500ing the landing page.
export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
