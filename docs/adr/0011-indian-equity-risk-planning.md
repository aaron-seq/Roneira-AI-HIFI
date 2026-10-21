# ADR 0011: Keep swing risk planning explicit and separate from execution

- **Status:** Proposed — human review requested, 2026-10-21.
- **Review record:** [#198](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/198); no approval inferred from existing code or merges.
- **Related issues:** [#147](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/147) · [#163](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/163) · [#182](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/182) · [#186](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/186)

## Context

Indian equity swing planning is one requested persona alongside diversified portfolio owners and analysts. Users need understandable rupee risk, position size and aggregate open risk, not unproven automated recommendations.

## Decision proposed

Propose an initial user-entered long-trade planner with capital, entry, stop and risk budget; show assumptions, instrument rounding and portfolio heat. Keep planned trades distinct from executed ledger events. Treat prospective paper-strategy evaluation as a separate frozen protocol under #186; no broker orders.

## Alternatives

Inferring recommended sizing from heuristic confidence gives false precision. Calling a historical return forecast a net-profit strategy ignores costs, execution and liquidity.

## Consequences and current limits

A deterministic manual calculator need not wait for calibrated ML, but requires reviewed financial arithmetic. Journal-backed open risk depends on reconciled ledger quantities; model-suggested actions require separate evidence.

## Validation and delivery

Use synthetic INR risk examples, zero/negative/invalid stop distance, lot/tick rounding, fees, concentration and cash constraints. Paper assessment must include net costs, slippage, liquidity, drawdown, coverage and baselines.

## Decisions still required

Supported instruments, lot/tick/fee sources, allowed risk budgets and gap/stop assumptions need product review. Paper protocol #186 remains blocked on #183/#184/#185; no profitability or execution promise is made.

## Sources

- [docs/product/portfolio-prd.md](../../docs/product/portfolio-prd.md)
- [docs/product/analyst-research-prd.md](../../docs/product/analyst-research-prd.md)
