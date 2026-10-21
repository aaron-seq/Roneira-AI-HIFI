# Delivery plan, measures and risk register

**Decision date:** 2026-10-20. Priorities are ordered by dependency and evidence, not promised delivery dates. GitHub issue/PR state is the execution record; this document does not close issues or claim a deployment.

## Evidence-based roadmap

| Order | User outcome | Gate and dependency | Backlog |
|---|---|---|---|
| 1 | Trust current portfolio values and recorded history | Portfolio P1–P3; actual Auth/RLS and browser recovery evidence | #178; related #174/#176 |
| 2 | Trust session dates, source freshness and access rights | Data D1/D3/D4; resolves outcome-date and provider entitlement ambiguity | #157/#168; #184, #190 |
| 3 | Reproduce real-market research without changing serving accidentally | Analyst M1–M3 and data D2/D5; retained negative evidence and candidate isolation | #179/#172/#180; #185 |
| 4 | Account for trades and cash before reporting performance | Portfolio P4, then P5; documented cost basis and reconciled imports | #147; #182 |
| 5 | Evaluate genuinely future outcomes and review stronger models | Analyst M4/M5 after #157 and rights/quality gates | #145; #183, #188 |
| 6 | Compare horizons and plan portfolio risk clearly | Independent availability/latency per horizon, validated instrument/rupee risk math | #146/#163 |
| 7 | Reconsider an optional hosted commercial offering | Open-source O2–O4; explicit future product decision, not a metric-triggered launch | No billing implementation scheduled |

Current history and research implementations are available in this change; completion/release requires the PR's final evidence. Historical issue descriptions can contain superseded numbers or implementation assumptions: use the current PRD, code and linked dated report when refining acceptance criteria.

## Measurement dictionary

These are proposed product/operational measures unless a dated report explicitly records them. Do not invent current usage, conversion or service-level numbers.

| Measure | Definition and interpretation | Gate |
|---|---|---|
| Complete valuation rate | Complete captures / all attempted captures, with transport, provider and invalid-book reasons separate | P1/D4 |
| Quote/FX coverage | Included holdings / total holdings per capture; separately report missing quotes, currency mismatch and FX exclusions | P1/D3 |
| Capture reliability | Confirmed successful server responses / capture attempts; unknown-write outcomes tracked separately and resolved by refresh | P2/P3 |
| Time to useful portfolio view | Measured page navigation to an actionable priced view; report device/network and percentile before setting a target | P3 |
| Account isolation failures | Confirmed cross-account exposure or unauthorized mutation attempts accepted; **release-blocking target: zero** in defined checks/incidents | P2/O2 |
| History continuity | Observed complete/partial/missing days over eligible UTC days since first capture; missing visits are not service outages or invented zero points | P3 |
| Ledger reconciliation | Quantity/cash/basis discrepancies between imported events and derived holdings, with unresolved count and amount | P4/P5 |
| Forecast MAE and skill | MAE of forward returns; signed 1−MAE/no-change MAE on exactly the same scored outcomes | M2 |
| Direction and signal quality | Correct/nonzero forecasts, BUY/SELL counts/precision and realized up/down/flat base rates, by horizon/fold/instrument | M2 |
| Forecast coverage | Valid/total predeclared origins plus unavailable reasons and degraded ensemble counts | M2 |
| Prospective resolution coverage | Resolved eligible issued forecasts / forecasts whose actual session horizon has elapsed; unresolved/correction reasons remain explicit | M4 |
| Provider rights coverage | Enabled public display/export paths with verified current entitlement / all enabled paths | D1/O2 |

The 2026-10-19 study is historical evidence, not these future product KPIs. Its final temporal refitted-ensemble skills are approximately −0.038/−0.086/+0.141/−0.109 at 7/30/90/180 sessions, on 24/24/24/12 correlated origins. No candidate promotion or accuracy guarantee follows.

## Risk register

| Risk | Current exposure | Control and decision owner role |
|---|---|---|
| Misleading portfolio returns | Editable holdings/current FX and incomplete cash ledger | Portfolio owner: show unrealized P&L/value captures; require P4/P5 before returns/attribution |
| Account privacy/lifecycle | Retained audit/forecast data requires an explicit erasure policy; asynchronous identity changes | Backend/security reviewer: preserve stale-response guards and [ADR 0002](../adr/0002-audit-retention-on-account-deletion.md)'s #174 repair. Product owner must resolve #196 before promising erasure or self-service deletion. |
| Data entitlement failure | Personal/development plans may not permit public/derived commercial display | Data steward/product owner: complete #184 before expanding feeds/audience |
| False forecasting confidence | Heuristic scores, historical labels and poor candidate skill | ML reviewer: disclose actual methods, address #180, preserve negative metrics and use M4/M5 |
| Leakage/selection/data revision | Revised adjusted histories, surviving large caps, correlated regimes | Research owner: freeze protocol/hashes, exact purging, unseen data and documented limitations |
| Stale or incompatible market input | Provider delays, FX currency errors, missing comparisons | Data/API owner: D3/D4 tests, visible provenance/coverage and bounded retries |
| Accidental candidate release | Compatible-looking file names/horizons in isolated research output | ML/runtime reviewer: research-only readiness rejection, artifact hashes and explicit promotion PR |
| Operational/dependency failure | Rate limits, CPU fits, runtime/library advisories | Maintainer: bounded resources, measured limits, #149, rollback and actual integration checks |
| Premature commercialization | Undefined “90%” and unmeasured user/service economics | Product owner: no paywall now; O2–O4 plus new authorization before any billing scope |

Roles denote responsibilities, not staffed positions or assigned people. Assign a named issue owner during triage.

## Backlog refinement and delivery workflow

1. **Discover.** Attach a concrete user problem, current behavior, source evidence and governing PRD/gate. Search existing issues before creating a new one.
2. **Refine.** State scope/non-goals, input/data/privacy contract, acceptance fixtures, dependencies, rollout and rollback. Mark uncertain rights, metrics or design choices explicitly.
3. **Implement.** Use a focused branch/PR and synthetic financial/security regressions. Run real authorized providers separately; keep credentials, private data and restricted raw datasets untracked.
4. **Review independently.** Recompute meaningful financial/model quantities; inspect Auth/RLS and failure recovery. Green unit tests alone do not establish provider freshness, production readiness or forecast skill.
5. **Validate and release.** Record exact tested commit, required CI, local SQL/Auth/browser evidence, dataset/config/artifact hashes where relevant, remaining issues and release limitations. Merge reviewed work within the user's authorization; deployment is a separate target-aware decision.
6. **Observe.** Measure the defined operational/product outcomes, resolve incidents and add regressions. A changed dataset/protocol gets a new identity. Do not relabel an old result to imply improvement.

A reproducible defect or financial/security invariant failure blocks its affected release. Roll back the affected feature/model/feed while preserving private history, evidence and permission boundaries. Additive database changes should not be undone by deleting user records.

## Linked contributor work

These work items are live GitHub issues. Their acceptance criteria describe remaining work, not implemented features. The initial registry/validator/synthetic data foundation is implemented in `data/`; corporate-action and revision checks remain separate.

| Issue | Actionable title | Acceptance/dependencies |
|---|---|---|
| #182 | Add transaction/cash-flow ledger and reconcile portfolio balances | Idempotent events/corrections; buys/partial sells/re-entry/dividends/splits/fees and opening balances; document basis; reconcile before returns. Child/dependency of #147. |
| #183 | Record forward predictions and resolve outcomes by actual sessions | Immutable issuance/input/model evidence, correct #157 semantics, delayed/suspended sessions, revision policy, coverage/base-rate reports; private reads. Extends #145. |
| #184 | Audit provider entitlements and enforce permitted public feed/export use | Provider/plan/use/retention/attribution evidence for every enabled path; reject or disable unverified public use; no raw/private-data commits. |
| #185 | Version dataset manifests and validate corporate-action/session quality | Canonical schema, symbols/currencies/timezones/adjustments, hash/range validation, duplicate/missing/split/dividend fixtures; explicit revised datasets. Builds on #179/#168. |
| #190 | Define quote freshness, currency and coverage contracts | Per-provider observed-source versus receipt time, stale/unknown states, wrong-currency FX/quotes, displayed exclusion reasons; measured thresholds before service claims. |
| #188 | Define independent research artifact and forecast-claim promotion gates | Predeclared criteria, unseen/prospective evidence, data rights, trusted hashes/horizon compatibility, resource budget and previous-bundle rollback; retain research-only rejection. Extends #145/#180. |

## Live project tracking

[Delivery tracker #189](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/189) links the workstreams. GitHub Projects list/create returned `Resource not accessible by integration` in this session; no board was created. Repository milestones and labels provide the supported live management view:

| Milestone | Evidence gate |
|---|---|
| [M1 — Trustworthy portfolio foundation](https://github.com/aaron-seq/Roneira-AI-HIFI/milestone/1) | Private, correct valuation/history and account/date contracts |
| [M2 — Governed data and honest ML](https://github.com/aaron-seq/Roneira-AI-HIFI/milestone/2) | Rights, quality, reproducibility and measured forecast evidence |
| [M3 — Transaction-aware performance](https://github.com/aaron-seq/Roneira-AI-HIFI/milestone/3) | Reconciled events/cash/basis before returns and attribution |
| [M4 — Evidence-gated public pilot](https://github.com/aaron-seq/Roneira-AI-HIFI/milestone/4) | Reliability, provider permissions, usability and release evidence |

After the #174 compatibility repair, ready items include #157 (forecast session dates), #182 (ledger), #184 (provider entitlement enforcement) and #168 (public pipeline regressions, labelled good first issue). Policy decision #196 remains blocked on product ownership. Choose an item, volunteer as its named owner and link its focused PR; no individual is assigned or delivery date promised here.

Labels are `area:portfolio/ml/data/platform/product`, `priority:P0/P1/P2` and `status:ready/blocked/backlog/in-progress`. P0 is reserved for immediate security/data-integrity incidents, P1 for foundations/release blockers and P2 for important dependent improvements. Closed GitHub state records completion. Keep implementation work in progress small and re-triage dependencies before starting.

Additional linked tasks cover the actual invalid Technical projection #181, net-of-cost paper study #186, consented usability pilot #187, release/promotion automation #188 and source freshness/currency contracts #190. New code/model proposals use the repository issue forms and PR template.
