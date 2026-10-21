# ADR 0002: Retain audit events and unlink deleted profiles

- Status: Accepted for the compatibility repair, 2026-10-20
- Issue: [#174](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/174)
- Baseline: `7449cb4`; migration 015

## Problem and evidence

Migration 001 declares `audit_log.user_id` nullable with `ON DELETE SET NULL`;
`task.md` requires append-only audit events. Migration 009 rejects every UPDATE,
including the foreign-key cleanup, so GoTrue admin hard-delete returns HTTP 500
for an ordinary signup. Merely relaxing that guard is insufficient: portfolio
and watchlist cascade-delete writers then reference the removed profile and
fail the same foreign key. Both failures were reproduced in disposable tests.
There is no account-deletion UI or custom deletion endpoint to preserve.

Success means the existing administrator-authorized GoTrue hard-delete can
remove Auth/profile/owned operational rows while retaining historical audit
evidence and preventing arbitrary audit edits. Existing prediction history also retains records with a nulled user link under
migration 002; that behavior is unchanged. No new client deletion privilege,
paid service, application dependency or retention scheduler is needed.

## Options

| Option | Benefit | Cost or conflict | Decision |
|---|---|---|---|
| Narrow FK unlink, retained events | Preserves the existing nullable-FK lifecycle and event evidence | Requires a precise UPDATE guard and cascade-writer correction | Selected |
| Remove the FK and retain the old user UUID | No UPDATE exception | Changes the expressed unlink contract, leaves permanent dangling identifiers | Rejected |
| Keep tombstone profiles / separate actor registry | Can separate actor identity from live accounts | Changes profile/auth ownership and identifier-retention semantics; extra schema and lifecycle | Deferred |
| Cascade-delete or redact historical events | Could support a separately defined erasure policy | Violates current immutable-event requirements; legal/product policy is unspecified | Not authorized by this repair |
| Disable guards or use a session bypass flag | Easy to implement | Enables audit tampering by trusted writers or forged context | Rejected |

## Contract and implementation

`user_id` is the live profile link. On actual parent deletion, the database may
clear that link; event ID, action, entity, old/new JSON, IP, user agent and creation
time remain unchanged. The guard permits only a nested nonnull→null link update
with the real parent absent and every other row field equal. Trigger depth alone
is never sufficient. Parent visibility comes from a trusted SECURITY DEFINER
function, not caller RLS. Fixed `pg_catalog, public, pg_temp` search paths,
qualified tables and variable types prevent temporary-schema masking.

Normal holding/watchlist deletion still records the live profile ID. Each delete
writer selects it with `FOR KEY SHARE`; an account cascade sees no parent and
records a null live link while preserving the full OLD payload. INSERT/UPDATE
logging, direct-client INSERT denial from 014, read RLS and hard event UPDATE/
DELETE denial remain. Service-role and ordinary owner DML cannot rewrite events;
a database administrator able to change DDL/disable triggers remains trusted.

Concurrent parent/child deletes may cause a deadlock or serialization failure,
as with the existing FK lock pattern. Abort and retry the entire transaction;
do not suppress audit failure or manufacture null attribution on lock contention.

## Product decisions explicitly unresolved

This is **account removal with retained audit evidence**, not personal-data
erasure or anonymization. JSON can retain email, usernames, original user IDs,
holdings and notes; GoTrue also maintains its own audit entries. Nulling the live
profile link does not remove those facts.

The existing requirements do not establish a retention duration, legal basis,
redaction/erasure exceptions, backup handling, who can authorize erasure, or a
self-service deletion/confirmation flow. This repair does not invent them or
introduce a deadline. Those policies must be decided before claiming erasure or
shipping a user-facing deletion promise. Existing administrator access to retained
rows is unchanged. New accounts cannot recover old rows through the nulled link.
The unresolved policy is tracked in [#196](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/196).
GoTrue rejects the deleted account at its user/refresh/password endpoints. Existing
JWTs can remain cryptographically valid until expiry at other services; this
repair does not implement global immediate token invalidation.

## Validation and rollout

Add transaction/ROLLBACK database regressions for both deletion orders, retained
fields, cascade events, isolated surviving users and direct/nested tamper denial.
Use a real disposable PostgreSQL 17/GoTrue v2.197.0 stack for admin DELETE, related
rows and session invalidation. Demonstrate baseline failure before applying 015.
No hosted account or database is touched by these tests.

Apply migrations in filename order through 015 as the trusted migration owner.
The change replaces three trigger functions and grants no new API privilege.
Apply 015 as one transaction; for manual verified-target execution use
`psql --single-transaction -v ON_ERROR_STOP=1 -f supabase/migrations/015_audit_account_deletion.sql`.
Roll back failed deployment transactionally. After successful deletions, nulled
links cannot be reconstructed safely from arbitrary JSON; no automatic down
migration or identity backfill is provided. Restoring old functions reintroduces
the deletion failure. Preserve retained events; test recovery on a disposable
copy before any operator rollback.

Sources: PostgreSQL 17 [referential trigger behavior](https://github.com/postgres/postgres/blob/REL_17_STABLE/doc/src/sgml/trigger.sgml),
[safe definer search paths](https://github.com/postgres/postgres/blob/REL_17_STABLE/doc/src/sgml/ref/create_function.sgml),
and GoTrue v2.197.0 [admin hard-delete transaction](https://github.com/supabase/auth/blob/v2.197.0/internal/api/admin.go).

## ERB security and delivery notes

Risk level: **🔴 HIGH RISK** — authorization and data deletion. This compatibility
repair preserves the existing administrator boundary. Hosted migrations and
production deletions require a verified target and the responsible operator's
authorization. Retention/erasure policy remains a separate product decision.

| Surface | Mitigation and residual risk |
|---|---|
| Authentication/authorization | Existing GoTrue administrator endpoint only; no new API privilege. Definer lookup must see the real parent independently of caller RLS. |
| Injection/privilege escalation | Qualified relations/types, fixed safe search paths, trigger functions not executable by client/service roles; no bypass setting. DDL-capable administrators remain trusted. |
| PII/data leakage | Full existing audit and forecast retention is explicit; null links do not anonymize JSON. Read RLS remains unchanged. Policy #196 is required before an erasure promise. |
| Secrets/logging/errors | Tests use generated disposable credentials, never supplied keys; no response-body/token dumps. HTTP failures report status and route. |
| Races/replay/cache | Whole-transaction rollback/retry on conflict; no missing-audit success. No immediate global JWT revocation claim or new deletion endpoint. |

Approximate change budget: three existing functions in one migration (~65 lines),
SQL regression (~165), isolated real-Auth runner (~235), CI wiring (~17), and
focused contract/setup references. The runner is needed because the repository's
SQL bootstrap cannot exercise GoTrue HTTP. No application dependency, lockfile,
model, UI or generic deletion abstraction changes.

TDD: SQL and real GoTrue tests reproduce 014's immutable-UPDATE/HTTP 500 failure.
015 passes those tests. Removing definer visibility or the other-fields comparison
independently fails the attack regressions. No refactor phase is needed beyond
the three owning functions. A separate reviewer caught an AFTER-trigger ordering
weakness in the test; the attack now runs before FK cleanup to exercise the exact
field-preservation condition.

## Verified evidence (2026-10-21)

- SQL on the old guard fails with `audit_log is append-only: UPDATE is not permitted`.
  All four SQL regression files pass after applying all 14 migrations (001–015,
  no 004) in a disposable database.
- `python supabase/tests/run-gotrue-deletion.py --through-migration 14` exits 1
  on real admin DELETE HTTP 500. The default command exits 0 on GoTrue v2.197.0:
  two accounts hard-deleted, two unauthorized deletes denied, historical fields
  and cascade events retained, old GoTrue user/refresh/signin access rejected,
  surviving account usable. Its owned containers/network are removed afterward.
- Removing either definer visibility or the field-equality condition makes its
  respective attack regression fail. The unmodified 015 passes both.
- The complete local Auth/Data API/web/ML setup passes 17 checks with 14 application
  migrations and no remaining classified repository defect. This is local
  integration evidence, not a hosted deployment or full Supabase-stack claim.
- 434 web tests, lint, types and production build pass. Model/data source and
  dependency lockfiles are unchanged; no new forecast-performance claim is made.
- A separate agent reviewed the final migration, regressions, runner, CI and
  decision/rollout documentation; no blocking findings remained. Raw local logs
  stay outside the repository.

The real-Auth runner waits for PostgreSQL TCP readiness: the official image's
temporary initialization server can accept Unix-socket connections before the
final server starts. This avoids a reproduced startup race without retrying
failed deletion assertions or suppressing a lifecycle failure.
