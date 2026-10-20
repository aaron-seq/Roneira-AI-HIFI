# PRD: governed real-market data project

**Date:** 2026-10-20 · **Status:** provider normalization and a frozen research manifest exist; the broader governance project is proposed.

## Problem, users and boundaries

Developers and analysts need repeatable, interpretable market inputs. Portfolio owners need a clear distinction between a fresh quote, an older exchange session and missing data. Maintainers need to know what may legally be downloaded, displayed, retained or published before expanding access.

Goals are an auditable rights matrix, stable instrument/session/adjustment definitions, quality reports and reproducible research manifests. Non-goals are unrestricted open redistribution, a guaranteed real-time exchange feed, publishing private portfolios, or silently replacing missing observations with generated prices.

The open project includes schemas, ingestion/validation code, synthetic fixtures, documentation and permitted aggregate evidence. Raw third-party downloads, news and derived artifacts require their own rights decisions. This is distinct from MIT software permission.

## User journeys and requirements

1. **Contributor onboarding.** Inspect an instrument/data dictionary and run validators on synthetic fixtures without provider credentials. Use personal credentials only in secure local/server settings, never commits.
2. **Acquire an authorized dataset.** Record provider, plan/entitlement evidence, allowed purpose, geography/audience, display/redistribution/derivation terms, retention, attribution and review date. Absence of fees does not establish production rights. Unverified usage stays restricted.
3. **Freeze research input.** Record canonical instrument and provider symbol, exchange/timezone, currency, interval, requested range, actual sessions, retrieval time, adjustment settings, source/byte hash and validator version. Identical date ranges do not guarantee identical revised adjusted prices.
4. **Validate and explain quality.** Check unique sorted sessions; finite consistent OHLC and volume; exact request-range boundaries; positive quote prices; compatible currency/FX; observed versus absent comparison values; and timestamp/session meaning. Report corrections, suspensions, delistings, missing bars and corporate actions separately. Never delete difficult outcomes solely to improve reported accuracy.
5. **Use in product.** Show provider/session/freshness and priced coverage. Cache age and receipt time must not masquerade as a provider quote timestamp. Failures expose explicit unavailable/retry states. Public feed/exports respect the selected provider's rights.
6. **Reproduce or revise.** Verify manifest hashes before reuse; fail on unexpected changes. An explicit refresh creates a newly identified dataset/report. Retain provenance of differences without rewriting an older experiment's claim.

## Privacy and rights requirements

Keep account/holding/transaction data out of market datasets and public manifests. Aggregate research must not leak private trades or credentials. Data/model deletion/export retention follows applicable permissions; immutable audit protections and account erasure need a compatible documented contract.

Provider guidance already identified: [yfinance](https://github.com/ranaroussi/yfinance#readme) warns about personal use; [Finnhub](https://finnhub.io/terms-of-service) restricts sharing, including derived results; [Alpha Vantage](https://www.alphavantage.co/terms_of_service/) has personal/noncommercial defaults; [NewsAPI](https://newsapi.org/terms) restricts Developer-plan use to development/testing. Twelve Data and exchange-specific display/redistribution entitlements still require contract-specific review. These links are inputs to review, not a blanket legal approval.

## Acceptance gates

| Gate | Measurable acceptance |
|---|---|
| D1 — rights inventory | Every enabled public display/export/provider path maps to current recorded permission or is disabled for that use; attribution/retention requirements are testable |
| D2 — manifest/reproduction | Fixture and authorized real-data runs emit required request/adjustment/session/hash fields; altered bytes fail reuse; explicit refresh produces distinguishable provenance |
| D3 — quality reporting | Duplicate/unsorted/invalid-price/mismatched-currency/missing-session/corporate-action fixtures produce documented results; no silent invalid-row deletion or synthesized market observation |
| D4 — product semantics | Browser/provider-contract tests distinguish source/session/receipt times and missing/flat changes; freshness thresholds are defined per feed and stale data is visibly identified |
| D5 — open contribution | A credential-free synthetic dataset and dictionary exercise validation, while secret/private/restricted-data contribution checks reject unsafe submissions |

Freshness thresholds and business service levels are not yet measured; propose and validate them before advertising availability or “real-time” behavior. Record provider outages and missingness rather than promising 100% coverage.

## Dependencies, risks and delivery

Depends on provider permission, instrument mappings, exchange calendars and model/portfolio consumers. Revised adjusted histories and survivor-only universes can bias research; longer-term work needs delisted instruments and point-in-time references where licensed. Rate limits, entitlement changes and schema revisions can break coverage.

Roll out synthetic validators and a reviewed rights inventory before adding public feeds or exports. Validate one approved provider/use case, then expand instrument coverage. Roll back by disabling affected delivery/export and retaining allowed provenance; do not silently switch to a provider whose rights or data semantics differ. Avoid storing raw restricted content in Git during either rollout or rollback.

## Backlog mapping

[#168](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/168) covers existing public market-pipeline contracts; [#157](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/157) session outcome semantics; [#179](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/179) the current research manifest. Proposed **#184** is the provider entitlement inventory/public-feed enforcement. Proposed **#185** adds schema/versioned quality and corporate-action validation. Proposed **#190** defines source freshness/currency/coverage contracts shared by quotes, history, portfolio captures and forecasts.
