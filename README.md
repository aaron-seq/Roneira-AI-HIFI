# Roneira AI HIFI

An open-source workspace for understanding a personal stock portfolio and researching stock forecasts across different trading-session horizons.

For portfolio owners, the goal is to make three questions clear: **What is my portfolio worth? Which holdings are gaining or losing? How has its recorded value changed?** Analysts can inspect model estimates, underlying methods and measured limitations alongside market data.

**Free to use and contribute to. No subscription or license-fee flow is implemented.** The software uses the [MIT license](LICENSE). Market-data permissions and private account data are separate from the software license.

[Architecture](ARCHITECTURE.md) · [Decision records and review queue](docs/adr/README.md) · [Model guide](ml/MODELS.md) · [Contributing](CONTRIBUTING.md) · [Deployment](DEPLOYMENT.md) · [Issues](https://github.com/aaron-seq/Roneira-AI-HIFI/issues) · [Product plan and PRDs](docs/product/README.md) · [Data project](data/README.md)

## What you can do

| Workflow | Available behavior | What the figures mean |
|---|---|---|
| Maintain holdings | Add, edit and remove Indian and US stock positions | Tracking only; no broker orders are placed |
| Understand current value | Per-position and total marked value, cost basis, unrealized profit/loss, allocation and concentration | Totals cover the priced, convertible book; missing quotes, invalid inputs and unavailable FX are disclosed |
| Follow portfolio history | Save server-calculated daily value/cost/P&L captures and inspect a history chart and exact values | Actual recorded observations, starting with the first capture; changes in value are not cash-flow-adjusted investment returns |
| Understand markets | Regional-index movement, stock movers and market/portfolio insight stories | A configured sample, with provider and exchange-session provenance; overlapping indices do not establish whole-market breadth |
| Research a stock | Compare a selected method and session horizon, features, compatible members and unavailable results | Forecasts are research estimates, not probabilities or assured trading outcomes |
| Monitor and review | Watchlists, in-app price alerts, saved prediction records and account audit events | Alerts require the configured cron workflow; quote freshness depends on the source |

### Portfolio history

The server records private, currency-specific observations of the current book,
starting with the first capture. There is one entry per UTC day/currency; a new
save replaces that day's observation. Opening the portfolio attempts a missing
capture, and explicit refresh is available. Days without a capture stay missing;
there is no unattended daily capture schedule.

Totals disclose missing prices/FX and reflect current cost basis. Unrealized P&L
excludes realized gains, cash flows, fees, taxes, dividends and historical FX
performance. Editing holdings can change the series without an investment gain.
The app does not reconstruct historical holdings or calculate cash-flow-adjusted
returns. See the [calculation/API contract](docs/portfolio-history.md) and
[ledger work #147](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/147).

## How the models work

The six API identifiers are compatibility names. The actual algorithms matter more than their labels.

| UI method / API identifier | Implementation | Training and horizon | Main limit |
|---|---|---|---|
| Random forest / `RANDOM_FOREST` | Bagged decision-tree regression on engineered return, volume and technical features | Fits the current ticker prefix for the requested session count; purged chronological validation | Per-request fitting has latency; young listings and long horizons may lack resolved labels |
| Sequence artifact / `LSTM` | XGBoost regressor over 60 ordered feature rows, flattened into one vector | Offline; the shipped bundle is trained for **30 sessions** | This is **not a recurrent LSTM network**; another horizon returns a disclosed unavailable reference |
| Price/range artifact / `GAN` | XGBoost regressor over 30 rows of return/range/volume features | Offline; the shipped bundle is trained for **30 sessions** | This is **not a generative adversarial network**, scenario simulator or probability distribution |
| Technical rules / `TECHNICAL` | Indicator votes including RSI, MACD, trend, volatility and volume context | No fitted model | Votes and projected prices are heuristics |
| Momentum rules / `PVD_MOMENTUM` | Price/volume momentum and derivative-style rules | No fitted model | No validated execution, stop-loss or position-sizing strategy |
| Equal-weight blend / `ENSEMBLE` | Available Random Forest, Technical, PVD and sequence-artifact estimates | Compatible members receive equal, renormalized weights | Fallback/unsupported members are excluded; agreement does not add confidence or establish accuracy |

Both sequence slots currently use gradient-boosted point regressors. TensorFlow training is disabled until its causal preprocessing and validation pipeline is reviewed. `GAN` is not an ensemble member. Only trusted, reviewed model artifacts should be loaded; serialized Python model files can execute code when loaded.

### Short and longer horizons

The API accepts legacy aliases `tomorrow`, `1week`, `1month`, `3month`, `6month`, `1year` and `1year_plus`. They mean **1, 7, 30, 90, 180, 365 and 400 observed trading sessions**, respectively. They are not exchange-calendar conversions: 365 sessions is longer than one calendar year.

Select each horizon separately and check the actual method, data session, trained horizon and fallback state. The bundled sequence artifacts support only 30 sessions; a research model trained for another horizon is not automatically deployed. The legacy persisted calendar `target_date` remains tracked in [#157](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/157) and must not be used as a verified exchange-session outcome date.

### What “accuracy” means here

A model score on the results screen is a **heuristic**, not the probability that a stock will rise or that a trade will be profitable. There is no supported claim of 90% accuracy.

The shipped 30-session artifacts' recorded held-out assessment is:

| Artifact slot | Return MAE | No-change return MAE | Signed skill versus no change |
|---|---:|---:|---:|
| Sequence (`LSTM`) | 0.06968 | 0.06257 | −0.114 |
| Price/range (`GAN`) | 0.06847 | 0.06263 | −0.093 |

Returns are fractions: 0.06968 means roughly 6.97 percentage points of absolute return error. Skill is `1 − model_MAE / baseline_MAE`; negative values mean the model did worse than predicting no change. These figures describe the metadata's assessment period, not future performance or a trading strategy. Source histories extend beyond the fitted training-label cutoff; see the artifact metadata for both training and validation dates.

The real-market research workflow trains and evaluates separate horizons on frozen provider histories, with exact label-resolution purging and chronological test periods. It reports errors, direction counts and base rates, unavailable coverage, folds and data hashes. Historical replay on selected surviving stocks is not a point-in-time or prospective investment record. Research results do not overwrite a deployed artifact automatically.

### Measured real-market study

The [2026-10-19 study](ml/research/results-2026-10-19.md) evaluated frozen
7/30/90/180-session candidates on six selected Indian/US stocks. Both sequence
candidates underperformed no change at every studied horizon. The refitted
ensemble's pooled 180-session gain reversed in its final temporal fold; **no
candidate was promoted**. Selected-stock historical replay does not establish
an unseen-instrument, prospective or net trading edge.

The [full report](ml/research/results-2026-10-19.md),
[aggregate results](ml/research/results-2026-10-19.json) and
[model guide](ml/MODELS.md) retain the sample/coverage, per-horizon metrics,
baselines, cutoffs, hashes and limitations. The
[frozen protocol](ml/research/README.md) explains reproduction.

## Free, open source and data rights

The initial product has no payment or license-fee gate. Code, schemas, tests and
permitted research are open under MIT; private accounts/portfolios stay private.
Third-party quotes, news, raw histories and derived artifacts have independent
rights. An API key or free access does not grant public-display, redistribution
or commercial permission. Keep restricted downloads out of Git.

The [market-data PRD](docs/product/market-data-prd.md) records provider-term
sources and the permission-review gate. A future paid hosted proposal would
need licensed data, user value, reliable operations and reviewed evidence/terms;
a headline “90%” metric cannot trigger fees. See the
[hosting PRD](docs/product/open-source-hosting-prd.md).

## Product and data project

[PRDs and delivery plan](docs/product/README.md), the
[live tracker](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/189) and
[milestones](https://github.com/aaron-seq/Roneira-AI-HIFI/milestones) separate
implemented behavior from proposals and release gates. The
[ADR catalog](docs/adr/README.md) identifies decisions needing human review;
the [dated delivery audit](docs/product/delivery-audit-2026-10-21.md) retains
historical issue/PR/review dispositions.

The [data project](data/README.md) provides registry/hash metadata, synthetic
fixtures and validators. Dataset hashes establish byte identity, not permissions
or forecasting quality. Raw provider data remains in local ignored caches.

## Architecture & technology stack

Next.js 16/React 19 serves the web app and API routes on Vercel. FastAPI,
scikit-learn and XGBoost run in `ml/`, with Railway/Render deployment recipes.
Supabase provides Auth and private PostgreSQL data under RLS. TanStack Query
handles server data; Zustand handles UI state. See
[Architecture](ARCHITECTURE.md) for flows and trust boundaries and
[Deployment](DEPLOYMENT.md) for actual host URL/token binding and cold-start limits.

### Repository layout

| Path | Purpose |
|---|---|
| `src/app/` | Dashboard routes and Next.js API handlers |
| `src/components/` | UI, accessible controls, analysis and portfolio views |
| `src/lib/` | Account hooks, market normalization, financial calculations and server helpers |
| `ml/app/` | Model inference, contracts and data endpoints |
| `ml/train_models.py`, `ml/backtest.py` | Offline fitting and historical walk-forward evaluation |
| `ml/artifacts/generated/` | Reviewed shipped model bundles and metadata |
| `supabase/migrations/`, `supabase/tests/` | Database schema, RLS and SQL regressions |
| `data/` | Dataset registry, contracts, synthetic fixtures and data validation |
| `docs/` | Product PRDs, delivery plan, design decisions, validation reports and captured screens |

## Getting started

Use Node **22.12 or newer**, npm and **Python 3.11**. Python 3.11 matches the tested ML runtime. Docker is needed for local Supabase; a deliberately configured hosted development project is an alternative.

```bash
npm ci
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install -r ml/requirements.txt
cp .env.example .env.local
cp ml/.env.example ml/.env
```

Start a local database:

```bash
npx supabase start
npx supabase status
```

Use its local URL/keys in `.env.local`. The committed seed contains synthetic local test accounts and holdings; see [supabase/seed.sql](supabase/seed.sql). Apply all migrations in filename order through `015_audit_account_deletion.sql`; `004` is absent. Migration 014 blocks direct client audit insertion; deploy the trusted server-writing routes before or with it. Migration 015 enables administrator-authorized Auth hard-delete while retaining audit events and clearing their live profile links. This does not erase retained personal data; see [ADR 0002](docs/adr/0002-audit-retention-on-account-deletion.md). Never seed a hosted project with local fixture accounts. Review [CONTRIBUTING.md](CONTRIBUTING.md) for the hosted-development alternative.

### Configuration

| Variables | Use |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser/server access to the selected Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only operations including trusted snapshot writes; never expose it to the browser |
| `NEXT_PUBLIC_APP_URL` | Application URL |
| `ML_BACKEND_URL`, `ML_SERVICE_TOKEN` | Server-to-server ML URL and shared token |
| `ML_MODEL_DIR` | Model artifact directory, relative to `ml/` unless absolute |
| `TWELVE_DATA_API_KEY`, `ALPHA_VANTAGE_API_KEY`, `FINNHUB_API_KEY`, `NEWS_API_KEY` | Optional provider access, subject to plan permissions |
| `UPSTASH_REDIS_URL`, `UPSTASH_REDIS_TOKEN` | Shared rate limits; the fallback is per process |
| `CRON_SECRET` | Authenticated scheduled price-alert evaluation |
| `ADMIN_*` | Explicit admin maintenance, not ordinary startup |

Generate your own `ML_SERVICE_TOKEN` and configure the **same value** in the web and ML environments. The ML service returns 503 on protected endpoints when unset and 401 for a mismatched token. Provider keys can remain absent for supported personal-research fallback workflows. `HUGGING_FACE_API_KEY` is not currently used by the forecasting models. Keep secrets out of Git; use secure deployment/environment settings.

Run the two services from the repository root:

```bash
# Terminal 1
npm run dev

# Terminal 2
source .venv/bin/activate
npm run ml:dev
```

The ML health endpoint is `/health`; its OpenAPI interface is `/docs` on the running ML service. A healthy process alone does not establish provider access, fresh quotes, valid hosted auth or model accuracy.

## Training and testing

Offline fitting is separate from application startup. Train candidate artifacts into an isolated output directory so experimenting with another horizon cannot overwrite the shipped 30-session bundle:

```bash
(
  cd ml
  ML_MODEL_DIR=.cache/candidates/h30 ../.venv/bin/python train_models.py \
    --backend gradient-boost --models all --period 10y --horizon 30
)
```

A successful fit is not a deployment approval. Inspect held-out errors, baseline skill, coverage and data provenance, then evaluate the served method on untouched periods. Keep raw downloads out of commits and retain only rights-compatible code/configs/results. See [ml/MODELS.md](ml/MODELS.md) for reproducible evaluation commands and the current research protocol.

Run validation from the repository root:

```bash
npm run lint
npm run type-check
npm run test:web
npm run build
source .venv/bin/activate
OMP_NUM_THREADS=2 OPENBLAS_NUM_THREADS=2 MKL_NUM_THREADS=2 python -m pytest ml/tests -q
npm run test:data
```

SQL regression instructions are in [supabase/tests/README.md](supabase/tests/README.md). Model tests use controlled fixtures; real-provider research runs and disposable Auth/RLS/browser integration are separate checks. The native Git pre-commit hook runs web checks and, when ML files are staged, the ML suite; activate `.venv` before committing.

## Contributing and known limits

Start with [CONTRIBUTING.md](CONTRIBUTING.md) and the [issue tracker](https://github.com/aaron-seq/Roneira-AI-HIFI/issues). Changes should include focused financial/security regressions and reproducible evidence. Never submit credentials, private portfolios or provider data without redistribution rights. Do not improve reported accuracy by excluding hard outcomes, shuffling temporal splits or tuning on the final test period.

Current follow-ups include transaction-aware accounting/attribution [#147](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/147), forecast date contracts [#157](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/157), account erasure/retention policy [#196](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/196), and dependency/deprecation follow-up [#149](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/149). The [reliability review](docs/reviews/2026-10-20-reliability.md) records the public-query recovery, rule-failure, Redis and audit-write refinements. Risk budgeting, calibrated probabilities, reliable prediction intervals and automated portfolio management are not implemented.

[Architecture](ARCHITECTURE.md), [deployment guidance](DEPLOYMENT.md), [model behavior](ml/MODELS.md), [data-story calculations](docs/data-stories-2026-10-13.md) and [ADRs](docs/adr) provide deeper context. Published screenshots and research numbers describe their recorded dates, rather than a live service guarantee.
