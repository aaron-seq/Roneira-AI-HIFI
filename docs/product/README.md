# Product plan

Decision record dated **2026-10-20**. These documents define the product and its acceptance gates; proposed work is not a claim that it is already available.

Roneira helps a person understand a stock portfolio and helps an analyst inspect a forecast's evidence. The first experience should answer: what is my portfolio worth, which positions are gaining or losing, and how has its recorded value changed? The analyst experience should explain what a model used, what horizon it estimates, and how often its forecasts were available or useful against a baseline.

The initial software is free and open source under [MIT](../../LICENSE). There is no payment or license-fee flow. Private accounts and portfolios do not become public data. Provider quotes, news and derived artifacts have rights independent of the code license.

## Documents

| Document | Decision it supports |
|---|---|
| [Portfolio PRD](portfolio-prd.md) | Current valuation, recorded history, and the later ledger required for realized P&L and investment returns |
| [Analyst research PRD](analyst-research-prd.md) | Honest model methods, reproducible training, evaluation and prospective outcomes |
| [Market-data PRD](market-data-prd.md) | A governed data project covering rights, provenance, quality and reproducibility |
| [Open-source and hosting PRD](open-source-hosting-prd.md) | Contribution, free initial access and evidence required before considering paid hosting |
| [Delivery plan](delivery-plan.md) | Priorities, dependencies, metrics, risks and the issue-to-release workflow |

The repository [README](../../README.md) is the setup and capability entry point. [Model behavior](../../ml/MODELS.md), [real-market research](../../ml/research/README.md), [architecture](../../ARCHITECTURE.md) and [data-story calculations](../data-stories-2026-10-13.md) carry technical detail.

## Current position

| Capability | Status at this decision |
|---|---|
| Holdings, currency-aware current valuation, unrealized P&L and exposure stories | Implemented; totals disclose missing quotes/FX and exclude unusable inputs |
| Private daily portfolio captures, exact history table and chart | Implemented in the current change; history begins with observed captures, with one entry per UTC day/currency |
| Transaction-aware accounting, realized gains, cash-flow-adjusted returns | Planned; existing transaction tables do not establish a reconciled ledger |
| Real-market model training and assessment | Executed for 7/30/90/180 observed sessions on six selected Indian/US stocks; research candidates remain separate from serving |
| Released sequence artifacts | Existing 30-session XGBoost-backed `LSTM`/`GAN` compatibility slots; no new candidate promoted |
| Calibrated probabilities, validated trading profitability or 90% accuracy | Not established |
| Paid access or public-data redistribution entitlement | Not introduced; provider rights require separate evidence |

The [2026-10-19 research report](../../ml/research/results-2026-10-19.md) records mixed results. Both sequence candidates have negative pooled skill at every assessed horizon. The 180-session refitted ensemble's pooled gain does not survive its final temporal fold. Historical selected-stock replay does not establish a prospective trading edge.

## Product principles

- Explain value and limitations in the main workflow, using currency, source session and coverage beside the figure.
- Preserve unknowns. Missing quotes are not zero value; an unavailable model is not a successful no-change forecast.
- Separate portfolio value changes, investment returns, forecast error, directional hit rate and strategy profit.
- Keep a measurable decision trail: requirements, issue, implementation, review, validation and release evidence.
- Publish reproducible code and permitted aggregate research; keep private data and restricted downloads out of contributions.
- Let evidence decide model promotion. A training run, green test suite or attractive score alone does not establish forecasting quality.

There are no delivery-date promises in this plan. Work advances through the gates in the delivery plan, and issue status remains the execution source of truth.

## Pick up work

Start with the [live delivery tracker](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/189), [milestones](https://github.com/aaron-seq/Roneira-AI-HIFI/milestones) and the five ready issues in the [delivery plan](delivery-plan.md#live-project-tracking). The [data project](../../data/README.md) includes concrete validation commands and reproducible fictional fixtures for contributors. GitHub issue state remains current; this dated PRD pack is the requirements and decision record.
