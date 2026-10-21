# ADR 0005: Reconcile an append-only ledger before reporting investment returns

- **Status:** Proposed — human review requested, 2026-10-21.
- **Review record:** [#198](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/198); no approval inferred from existing code or merges.
- **Related issues:** [#147](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/147) · [#163](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/163) · [#182](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/182)

## Context

Editable holdings and existing transaction-shaped tables are not a reconciled trade/cash ledger. Normal users need defensible realized gains and performance, including deposits and withdrawals.

## Decision proposed

Propose idempotent immutable economic events with explicit correction/reversal references, source identity, quantities, cash, fees, currency and opening balances. Derive and reconcile holdings/cash before #147 journal and performance work. Keep event timestamps and valuation observations distinct. This document does not create a ledger or select a tax method.

## Alternatives

Inferring trades from snapshots or audit payloads loses cash and execution semantics. Mutable transactions lose correction provenance. A general event-sourcing framework adds scope beyond a focused financial ledger.

## Consequences and current limits

Imports need stable identities and discrepancy states. Reversals preserve evidence; they must not silently rewrite a previously reported period. Manual risk planning can remain separate from ledger-backed executed positions.

## Validation and delivery

Review buy/partial sell/re-entry, fees, dividends, splits, cash flows, opening balances, duplicate import, corrections, FX and per-user isolation fixtures. Reconciliation must precede published returns.

## Decisions still required

Product/financial decisions required: FIFO versus average/other basis, supported instruments/markets, settlement/FX policy, tax scope, opening-balance proof, and TWR/MWR/benchmark definitions. No choice is inferred from the existing PRD.

## Sources

- [docs/product/portfolio-prd.md](../../docs/product/portfolio-prd.md)
- [docs/product/delivery-plan.md](../../docs/product/delivery-plan.md)
