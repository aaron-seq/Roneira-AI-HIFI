# Reliability and trust-boundary review — 2026-10-20

Baseline: `6caf247` (PR191). This increment keeps the existing Next.js, Supabase
and FastAPI architecture. It adds no application dependency or trained model.

## Review decisions before implementation

| Finding / issue | Evidence and root cause | Chosen refinement |
|---|---|---|
| Public queries stay loading after profile failure [#176](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/176) | Eight integrated regressions fail when `QueryClient.clear()` removes a pending query while the selected identity stays null. Stock search also lacks an identity-dependent key. | Advance one epoch in the existing store after each auth cache clear; public market/news/search keys observe it. Retain cache erasure and private account guards. |
| Rule failures look like forecasts [#192](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/192) | A one-session PVD input and missing-Volume rule input enter catch branches returning positive confidence without failure flags. API, blend and evaluator accept the no-change value. Six consumer regressions fail before repair. | Return explicit `inference_failed`, zero confidence and neutral signals; reuse existing consumer exclusion/availability behavior. |
| Invalid Redis responses bypass the fallback [#193](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/193) | Eleven fault-injection regressions fail: numeric coercion accepts null/false/empty or invalid counts; the expiration result is ignored. | Require both successful pipeline results and a positive safe-integer count; reuse the local counter for failures. |
| Direct audit writes bypass the server [#194](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/194) | Transaction-only PostgreSQL reproduction proves anonymous and cross-user inserts under the PUBLIC `WITH CHECK(true)` policy. Endpoint-only checks cannot protect the database API. | Remove client INSERT privileges/policy; validated, actor-bound server writes use the existing trusted admin client. Preserve database audit triggers and immutable event guards. |

**Known facts:** the failures above reproduce on committed code with synthetic
inputs or disposable databases. Portfolio-history review passed all 76 focused
tests without a new defect. No hosted incident or frequency is established.

**Unknowns and assumptions:** production occurrence, provider entitlements and
managed database state remain unmeasured. Public endpoint responses remain
public; private portfolios and sessions must remain isolated. No clarification
or new credential is required to repair these internal contracts.

**Success criteria:** recover pending public observers without accepting stale
responses; distinguish failed calculations from forecasts throughout consumers;
enforce the local quota when Redis evidence is unusable; deny untrusted direct
audit insertion while preserving legitimate server/database writers.

**Five-whys synthesis:** downstream consumers show a valid-looking result because
failure/cache boundaries were incomplete. Those boundaries had evolved while
legacy callers retained old assumptions. Endpoint-only or happy-path tests missed
the mismatches. The repairs therefore live at the owning boundaries, with tests
through their real consumers rather than duplicate implementations.

**Architecture and alternatives:** retain the existing stores, result dictionaries
and server clients. Skipping auth cache clears risks privacy; creating another
query store adds needless coordination. Catching rule errors only in HTTP leaves
research callers wrong. Failing closed on every Redis outage changes availability
policy. Restricting only the Next audit endpoint leaves direct database access
open. No queue, model replacement, paid service or framework rewrite is needed.

**Security review:** private cache removal and stale-hydration guards remain;
internal exception text stays server-side. Audit actor IDs come from verified
sessions. Migration 014 removes direct client insertion without widening read or
mutation permissions. Same-account client-reported audit actions remain reports,
not independently verified proof that an operation occurred.

**Performance and scalability:** auth advances the epoch only at existing cache
clear sites; no polling or profile retry loop is added. Failed-model metadata and
Redis response checks are bounded constant work, with no extra provider request.
The local limiter remains per process and cannot reconstruct earlier successful
Redis counts during backend flapping. No new latency/load benchmark or production
capacity claim is made.

**Maintainability and dependencies:** preserve existing assertions and reuse the
established fallbacks. No application dependency or lockfile changes are needed.
A disposable PostgreSQL 17 CI job now applies actual migrations and runs the SQL
regressions; it uses the same pinned official image validated locally. Its test
password is a public disposable fixture, never a hosted credential.

**Testing strategy:** reproduce before repair, then test auth observers and stale
responses, rule API/ensemble/evaluator behavior, invalid Redis command results,
and real database privileges, reads and trusted writers. Run lint, types, web/ML/
data suites, production build and independent review. PostgreSQL bootstrap is
for an empty disposable database only; it does not emulate GoTrue HTTP.

**Risk and rollback:** query keys gain a final epoch member while prefix matching
continues to work. Some previously successful-looking forecasts correctly become
unavailable; this is not an accuracy improvement. Migration 014 must be applied
to the intended database; deploy the trusted audit-writing code before or with
it to avoid legacy writers being denied. Retain the restrictive migration during
application rollback, and retain the corrected audit-writing routes if rolling
back other application changes. Do not restore the permissive policy as a
rollback shortcut. Auth/rule/Redis changes have no persistent data migration.

## Verified follow-up work

- [#174](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/174) has a second
  reproduced blocker: after a transaction-only trial permits narrowly scoped FK
  nulling, account deletion still fails because cascade audit writers insert the
  removed profile's ID. A guard-only patch is insufficient. Preserve immutable
  fields and test complete signup/holding/watchlist/GoTrue deletion before fixing.
- [#157](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/157) still covers
  exchange-session versus calendar target dates. Its obsolete one-year-history
  claim was corrected: serving already fetches five or ten years.
- [#181](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/181) remains the separate
  nonpositive Technical projection case; [#180](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/180)
  tracks heuristic score semantics. Historical study evidence is unchanged;
  corrected exception handling may change availability in future reruns.
- Existing [#149](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/149) retains
  development dependency advisories and action/Starlette deprecation warnings.
- A suspected private-query round-trip defect did not reproduce with the actual
  AuthSync/QueryClient integration. No speculative issue was created.

## Source checks

Upstash's official REST documentation specifies one pipeline result per command,
including per-command errors; HTTP 200 alone is insufficient. The docs hostname
was inaccessible, so its upstream source was read:
[Upstash REST API](https://github.com/upstash/docs/blob/main/redis/features/restapi.mdx).
PostgreSQL documents that referential actions fire normal table triggers:
[PostgreSQL 17 trigger behavior](https://github.com/postgres/postgres/blob/REL_17_STABLE/doc/src/sgml/trigger.sgml).
The auth reproduction uses the installed TanStack Query observer and actual
AuthSync; this is observed library behavior rather than a guessed API contract.

## Validation evidence

- 434 web tests across 38 files and 230 ML tests passed. The ML suite retains
  one known Starlette TestClient deprecation, tracked in #149.
- 18 offline data tests, metadata/synthetic validation, lint, types and production
  build passed. Historical research files and deployed artifacts are unchanged.
- An empty disposable PostgreSQL 17 database applied all 13 application migrations
  (001–014, no 004) and passed all three committed SQL regression files. The audit
  regression fails on the old permissive policy and passes with migration 014.
- A fresh local real-GoTrue stack passed 14 startup/Auth/RLS/SQL checks, separately
  reporting the known #174 account-deletion defect. No assertion was disabled to
  obtain those passes.
- Five real local browser/request flows passed: anonymous audit denial, username
  login, authenticated actor-bound audit write, invalid-event rejection and a
  successful real-provider prediction. SQL assertions confirmed the actor and
  prediction audit row. Public committed synthetic accounts were used; no private
  portfolio or hosted database was involved. No page errors were observed.
- Separate agents reviewed auth/ML/Redis changes and the audit trust boundary;
  existing assertions were preserved and no blocking finding remained.

Hosted migration state, provider rights, production capacity and predictive edge
remain unverified. No coverage percentage, performance gain or production-ready
claim is inferred from these passing checks.
