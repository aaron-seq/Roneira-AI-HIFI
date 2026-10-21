# PRD: free open source and a responsible hosted-service option

**Date:** 2026-10-20 · **Status:** free/open-source direction; no paid launch proposed by the current change.

## Problem, personas and goals

A portfolio owner needs useful initial access without a fee gate. A contributor needs understandable licensing, reproducible work and clear review standards. A future maintainer needs a sustainable hosting option without conflating software permission, data rights and model quality.

The initial product stays free and the software uses [MIT](../../LICENSE). Goals are straightforward contribution, honest capability claims and an explicit evidence path before considering paid hosting. Non-goals are billing, subscription enforcement, withdrawal of existing MIT permissions, selling private portfolio data, guaranteed returns, or automatic commercialization when a score reaches 90%.

## Journeys and requirements

1. **Use now.** Find actual capabilities, limits, setup instructions and private-data boundaries in the README. Initial application paths contain no new payment, entitlement or license-fee check.
2. **Contribute.** Select an issue, read its PRD and acceptance gates, use synthetic fixtures, open a focused PR and supply validation evidence. Keep credentials, user data and restricted provider downloads out of contributions. State software/dependency and artifact provenance.
3. **Review research.** Publish permitted code/configs/aggregate results, including unfavorable results. Identify actual algorithms and research-only candidates. Explain scores and known sample limits in user-facing language.
4. **Consider hosting later.** Review user value, operating cost, reliability, support capacity and data entitlements. Publish an explicit proposal for any paid service; user authorization and a new scoped implementation are required. MIT permits commercial use but does not grant third-party data rights or revoke prior software permissions.

## Data, privacy and operating requirements

No private account data becomes an open-data contribution by default. Product measurements should use explicit events, minimal identifiers and a retention policy; research reuse or public examples require separate permission. Verify account isolation, export/erasure and incident procedures before expanding a hosted audience. [ADR 0002](../adr/0002-audit-retention-on-account-deletion.md) resolves deletion compatibility without weakening immutable event fields; [#196](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/196) remains the product decision for retained personal data and erasure promises.

A data-rights inventory must cover public display, commercial usage, caching, export and derived artifacts. Approved training access is not automatically approved public redistribution. Free access does not make staging/production use lawful under a development-only provider plan.

## Acceptance and commercialization gates

| Gate | Measurable acceptance |
|---|---|
| O1 — open initial release | Canonical MIT notice present; README accurately describes implemented behavior; no payment/enforcement path added; contribution workflow runs without publishing secrets/data |
| O2 — responsible hosted audience | Rights matrix covers enabled feeds; actual account isolation/lifecycle checks pass; operational measurements and recovery/support policies are documented |
| O3 — research claims | Every public claim names target, horizon, sample/coverage, baseline and assessment period; a reviewer can trace it to reproducible evidence |
| O4 — any future paid proposal | Written scope, costs, permissions, user terms/privacy, support and rollback reviewed before billing implementation; forecast claims additionally meet the analyst PRD's promotion gate |

“90%” may describe direction hit rate, BUY precision, price tolerance or interval coverage; these differ and can be misleading without denominators/base rates/interval width. Current evidence supports none as a stable advertised accuracy or fee trigger. Forecast-related commercial claims need genuinely fresh temporal/prospective evidence; trading claims additionally need execution/cost/liquidity/drawdown evaluation. Revenue or trial conversion cannot substitute for those checks.

## Risks, rollout and rollback

Risks include unsupported performance marketing, provider-plan restrictions, operating costs exceeding an unfunded budget, dependency vulnerabilities and loss of user trust after account/data failures. Ownership must be assigned before making service promises.

Roll out documentation/contribution improvements first. Expand a hosted audience only through O2, with a bounded operational cohort and explicit limitations. If a future paid experiment is separately approved, retain the free/open-source repository and define customer export/refund/offboarding before launch. Roll back the hosted experiment by disabling new paid onboarding and following the published offboarding terms; do not delete users' records or imply a license change to existing code.

## Backlog mapping

[#149](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/149) is dependency/security follow-up; #174/#176 cover lifecycle/recovery. [#180](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/180) and [#145](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/145) constrain score/quality claims. Proposed **#184** gates feed expansion; proposed **#188** documents claim/release review. A billing implementation remains out of scope until a future product decision explicitly authorizes it.
