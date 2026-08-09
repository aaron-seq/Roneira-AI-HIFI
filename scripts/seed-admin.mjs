import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// `next dev`/`next build` load .env.local automatically; a standalone
// `node scripts/seed-admin.mjs` invocation does not, so this previously
// failed with "Missing NEXT_PUBLIC_SUPABASE_URL" unless the shell already
// had these exported. package.json declares Node >=18, so the native
// process.loadEnvFile() (20.6+) isn't safe to rely on here -- this is the
// whole parse in ~10 lines, not worth a dependency for.
function loadEnvLocal() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (!match || match[1].startsWith("#")) continue;
    const value = match[2].replace(/^["']|["']$/g, "");
    if (!(match[1] in process.env)) process.env[match[1]] = value;
  }
}
loadEnvLocal();

const {
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_FULL_NAME = "Admin User",
  ADMIN_USERNAME = "admin",
} = process.env;

if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
}

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error("Missing ADMIN_EMAIL or ADMIN_PASSWORD.");
}

const supabase = createClient(
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
if (listError) {
  throw listError;
}

const existingUser = existingUsers.users.find((user) => user.email === ADMIN_EMAIL);

let userId = existingUser?.id;
if (!userId) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: {
      username: ADMIN_USERNAME,
      full_name: ADMIN_FULL_NAME,
      role: "admin",
    },
  });

  if (error || !data.user) {
    throw error || new Error("Failed to create admin user.");
  }

  userId = data.user.id;
}

const { error: upsertError } = await supabase.from("users").upsert(
  {
    id: userId,
    username: ADMIN_USERNAME,
    full_name: ADMIN_FULL_NAME,
    email: ADMIN_EMAIL,
    role: "admin",
  },
  {
    onConflict: "id",
  }
);

if (upsertError) {
  throw upsertError;
}

console.log(`Admin account ready for ${ADMIN_EMAIL}`);
