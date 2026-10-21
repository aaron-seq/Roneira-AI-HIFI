# ADR 0017: Maintain one evidence-linked delivery and review dashboard

- **Status:** Proposed — human review requested, 2026-10-21.
- **Review record:** [#198](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/198); no approval inferred from existing code or merges.
- **Related issues:** [#189](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/189) · [#198](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/198)

## Context

Issues, PRs, ADRs and comments have accumulated stale status claims. Closed/merged state, agent review and passing CI do not prove named human approval. The integration cannot list/create GitHub Projects.

## Decision proposed

Propose #189 as the live supported dashboard with milestones, priorities, native sub-issues where available, dependencies and separate ADR/PR review queues. Keep a dated complete audit ledger in the repository. Use existing priority:P1 for high-priority foundation/release work, P0 only for a confirmed immediate incident, P2 for dependent improvements. Record named review disposition before changing proposed ADR status.

## Alternatives

Duplicating every issue into a new tracker fragments ownership. Inferring approval from merge state erases review debt. Inventing assignees/deadlines or marking all old review threads addressed is rejected.

## Consequences and current limits

New ADRs remain Proposed, including retrospective descriptions, until explicit review. Existing Accepted ADR labels are preserved as historical author-declared status with human approval unverified. An unresolved thread on a closed PR is review debt, not an open PR. Merging the catalog does not authorize future product policy.

## Validation and delivery

Check every issue/PR has a disposition, every original issue maps to a topic, all ADR/issue links exist, and counts match the dated snapshot. Reconcile live issue states rather than treating old prose checkboxes as current work.

## Decisions still required

GitHub Projects requires integration permission not available here. Named decision owners/reviewers and cadence are not assigned. Keep the issue dashboard usable now and migrate/link it only when an actual Projects board can be created.

## Sources

- [docs/product/delivery-plan.md](../../docs/product/delivery-plan.md)
- [.github/PULL_REQUEST_TEMPLATE.md](../../.github/PULL_REQUEST_TEMPLATE.md)
