# Ideas beyond the current roadmap

These are uncommitted proposals, not implemented features, delivery dates or
investment recommendations. Use the [product plan](docs/product/README.md) and
[live tracker](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/189) for accepted
scope. Search existing issues before proposing work.

## Tracked topics

| Topic | Existing work |
|---|---|
| Compare multiple horizons | [#146](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/146) |
| Trade journal, reconciled accounting and attribution | [#147](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/147) |
| Portfolio/trade risk planning | [#163](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/163) |
| Evidence-based ensemble choices | [#145](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/145) |
| Prospective forecast assessment | [#183](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/183) |

Technical indicators, in-app price alerts and historical walk-forward research
already have implementations. Read [model behavior](ml/MODELS.md),
[alert scheduling](docs/adr/0001-alerts-on-vercel-cron.md) and the
[research protocol](ml/research/README.md) before duplicating them. Historical
research is not a validated execution strategy.

## Ideas needing their own evidence and scope

| Area | Distinct proposals | Main prerequisites |
|---|---|---|
| Momentum | Jerk/third derivatives, intraday decay and cross-asset confirmation | Causal definitions, licensed history and comparison with current rules |
| Candidate models | Recurrent/transformer models or reinforcement learning for regimes and sizing | A demonstrated gap, frozen evaluation and resource budget; current LSTM/GAN slots are XGBoost |
| Market structure | Volume/market profiles, harmonic patterns, Wyckoff or Elliott-wave analysis | Reviewed swing/pivot definitions; order-flow imbalance additionally needs tick/L2 data |
| Risk allocation | Risk parity, mean-variance, Black–Litterman and hierarchical risk parity | Reconciled holdings, correlation/FX contracts and explicit risk assumptions |
| Position planning | Volatility/Kelly sizing, hedges, partial exits, pyramiding and drawdown responses | Validated instrument/currency math and risk limits; no automatic broker orders implied |
| Sector analysis | Sector rotation, correlation matrices and portfolio heat maps | Consistent cross-ticker history, classifications and coverage reporting |
| Event and alternative data | Earnings/corporate actions, social sentiment, SEC/13F filings, patents, supply chains or satellite signals | Fresh provider/rights/privacy review and measurable incremental value |
| Additional markets and views | Crypto/forex momentum research, fundamental/value filters and third-party chart widgets | Instrument-specific models, permitted feeds and reviewed integration/privacy costs |
| Intraday feeds | WebSockets, order books, options flow and institutional/algo activity hypotheses | Licensed feeds, deployment/cost design and validation; old Socket.IO code is not a supported runtime |
| Strategy simulation | Monte Carlo, transaction costs, slippage, market impact and regime comparisons | Point-in-time inputs and execution assumptions; historical model replay alone is insufficient |
| Simulation reporting | Sharpe/Sortino/Calmar, drawdown duration, regime hit rates, profit factor and recovery factor | Clearly defined net-of-cost strategy returns and uncertainty |
| User experience | Customizable layouts, mobile/PWA flows and push notifications | User research, accessible interactions and notification consent/operations |

Institutional reporting, white-label offerings and paid access need a separate
product decision, audience and operating/permission review. No provider shortlist
or quarter-based delivery commitment is maintained here. Proposals should state
the user problem, alternatives, data rights, acceptance tests and expected cost
before becoming implementation work.
