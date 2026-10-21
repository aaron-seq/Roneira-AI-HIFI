# ADR 0013: Keep account isolation and distinguish audit claims from observed operations

- **Status:** Proposed — human review requested, 2026-10-21.
- **Review record:** [#198](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/198); no approval inferred from existing code or merges.
- **Related issues:** [#16](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/16) · [#22](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/22) · [#23](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/23) · [#125](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/125) · [#126](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/126) · [#127](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/127) · [#132](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/132) · [#170](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/170) · [#176](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/176) · [#193](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/193) · [#194](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/194) · [#200](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/200) · [#201](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/201) · [#202](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/202) · [#204](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/204)

## Context

Private queries/mutations, server credentials, request quotas and audit writes cross trust boundaries. Direct anonymous/cross-user writes were repaired, but authenticated client claims still share audit vocabulary with database-observed operations. Historical source credential removal lacks public revocation evidence.

## Decision proposed

Record implemented identity-scoped private cache/reset, stale-response guards, server-only privileged writes and validated distributed-limit responses. Preserve append-only audit fields and ADR0002 unlink-only lifecycle. Propose #200 to distinguish or retire client claims without inventing historical provenance. Track sanitized operator verification for #201; never publish or probe an old credential.

## Alternatives

Authentication alone does not prove a claimed operation. A session flag or broad service-role bypass can enable tampering. Source cleanup alone is not proof of credential revocation.

## Consequences and current limits

Current rate-limit network/Redis errors fall back to process-local enforcement; validating successful Redis shapes does not make that allowance shared across instances. DDL-capable administrators remain trusted. Global immediate JWT invalidation is not implemented by account deletion.

## Validation and delivery

Cover account switch/logout and in-flight reads/writes, unauthorized audit insertion, owner-client fabricated claims, immutable updates/deletes, distributed-limit payload failures and disposable lifecycle regression. Credential review records only sanitized status, not sensitive logs.

## Decisions still required

#200 must choose allowed event classes, origin/trust semantics and historical unknown handling before schema changes. Rate-limit outage behavior and credential incident outcome require explicit evidence, not inferred assurances. Retention policy belongs to #196/ADR0016.

## Sources

- [docs/reviews/2026-10-20-reliability.md](../../docs/reviews/2026-10-20-reliability.md)
- [src/app/api/audit-log/route.ts](../../src/app/api/audit-log/route.ts)
- [supabase/migrations/014_trusted_audit_writes.sql](../../supabase/migrations/014_trusted_audit_writes.sql)

## Newly verified authorization gap

[#202](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/202) tracks prediction_history INSERT/UPDATE policies that still use unrestricted true checks. A read-only plan in the disposable stack showed an unfiltered authenticated UPDATE; no hosted exposure was assessed. Existing audit-write repairs do not cover this table. Restrict writes and prove role/grant/RLS behavior before describing issued/outcome data as trustworthy. [#204](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/204) separately corrects capture quotas keyed by account plus IP.
