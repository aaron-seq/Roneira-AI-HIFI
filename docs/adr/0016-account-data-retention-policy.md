# ADR 0016: Decide retained personal data before promising erasure

- **Status:** Proposed — human review requested, 2026-10-21.
- **Review record:** [#198](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/198); no approval inferred from existing code or merges.
- **Related issues:** [#174](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/174) · [#187](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/187) · [#196](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/196) · [#200](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/200)

## Context

ADR0002 repaired administrator hard-delete without weakening immutable event fields: the live profile link clears while historical JSON and other event fields remain. JSON, forecast history and GoTrue logs may contain identifying data. Account removal is not anonymization or erasure.

## Decision proposed

Propose keeping the implemented compatibility contract while #196 obtains an explicit product/security retention decision. Compare purpose-limited retained evidence, separately governed tombstone/actor registry and authorized erasure/redaction lifecycle designs. Do not mutate/delete historical events, grant self-service deletion or announce a duration from this documentation.

## Alternatives

Nulling user_id alone cannot erase embedded identity. Broad UPDATE exceptions or unverified caller bypass flags enable tampering. Cascade-deleting history silently changes the stated immutable-evidence requirement. A new actor registry adds schema and retained identifiers without itself resolving privacy.

## Consequences and current limits

Existing administrator boundaries/read RLS stay in force. New accounts cannot recover nulled rows through that link. Existing JWTs can remain cryptographically valid at other services until expiry; GoTrue endpoint denial is narrower than global revocation.

## Validation and delivery

Any chosen implementation must preserve tamper denial and survivor isolation, cover both deletion orders and real GoTrue HTTP, and test exact retained/minimized fields, backups and access lifecycle. Rollback must preserve evidence and cannot reconstruct links from arbitrary JSON.

## Decisions still required

Cannot infer: retained fields/purpose/access/duration, jurisdiction/legal basis, lawful erasure exceptions, backup/export/GoTrue treatment, approving owner, re-authentication/confirmation and user-facing wording. #196 is blocked on these product choices; human review is requested now.

## Sources

- [0002-audit-retention-on-account-deletion.md](0002-audit-retention-on-account-deletion.md)
- [supabase/migrations/015_audit_account_deletion.sql](../../supabase/migrations/015_audit_account_deletion.sql)
- [docs/product/open-source-hosting-prd.md](../../docs/product/open-source-hosting-prd.md)
