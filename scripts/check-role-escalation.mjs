// Regression check for the admin-escalation holes closed by
// supabase/migrations/010_lock_user_role.sql. Runs against the LOCAL stack
// only (`supabase start`), using nothing but the public anon key -- exactly
// what an attacker has.
//
//   node scripts/check-role-escalation.mjs <api-url> <anon-key>
//
// Exits non-zero if either path still produces an admin, or if the profile
// fields the settings page edits stop being editable.
import { createClient } from "@supabase/supabase-js";

const [url, anonKey] = process.argv.slice(2);
if (!url || !anonKey) {
  console.error("usage: node scripts/check-role-escalation.mjs <api-url> <anon-key>");
  process.exit(2);
}
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
  console.error("Refusing to run against a non-local URL.");
  process.exit(2);
}

async function signUp(metadata) {
  const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
  const tag = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const { data, error } = await supabase.auth.signUp({
    email: `escalate-${tag}@roneira.test`,
    password: "escalation-test-123",
    options: { data: { username: `esc${tag}`, ...metadata } },
  });
  if (error || !data.user) throw error ?? new Error("signup returned no user");
  return { supabase, id: data.user.id };
}

async function roleOf({ supabase, id }) {
  const { data } = await supabase.from("users").select("role").eq("id", id).single();
  return data?.role;
}

let failed = false;
function report(label, vulnerable) {
  console.log(`${vulnerable ? "VULNERABLE" : "ok        "}  ${label}`);
  failed ||= vulnerable;
}

// Path 1: ask for admin in signup metadata.
const viaMetadata = await signUp({ role: "admin" });
report(`signup with metadata role=admin -> role is ${await roleOf(viaMetadata)}`, (await roleOf(viaMetadata)) === "admin");

// Path 2: an ordinary user patches their own row through PostgREST.
const ordinary = await signUp({});
const { error: patchError } = await ordinary.supabase.from("users").update({ role: "admin" }).eq("id", ordinary.id);
const roleAfterPatch = await roleOf(ordinary);
report(
  `self-update role=admin (${patchError ? `rejected: ${patchError.message}` : "accepted"}) -> role is ${roleAfterPatch}`,
  roleAfterPatch === "admin"
);

// The settings page's legitimate update must keep working.
const { error: profileError } = await ordinary.supabase
  .from("users")
  .update({ full_name: "Still Editable", preferences: { theme: "light" } })
  .eq("id", ordinary.id);
report(`self-update full_name/preferences -> ${profileError ? `rejected: ${profileError.message}` : "accepted"}`, Boolean(profileError));

process.exit(failed ? 1 : 0);
