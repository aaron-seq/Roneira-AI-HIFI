# ADR 0003: Keep one web, ML and database runtime

- **Status:** Proposed — human review requested, 2026-10-21.
- **Review record:** [#198](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/198); no approval inferred from existing code or merges.
- **Related issues:** [#3](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/3) · [#4](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/4) · [#5](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/5) · [#6](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/6) · [#7](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/7) · [#11](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/11) · [#18](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/18) · [#126](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/126) · [#130](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/130) · [#131](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/131) · [#140](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/140) · [#150](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/150) · [#164](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/164) · [#188](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/188) · [#199](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/199)

## Context

The repository previously contained several disconnected application trees. The maintained surfaces are Next.js in src/, FastAPI in ml/ and Supabase migrations. Free hosting can sleep and inference has CPU/latency costs.

## Decision proposed

Record the implemented boundaries: browser requests use Next.js routes; private ML calls use the server-side service token; Supabase owns authentication and RLS-backed records. Keep canonical configuration and generated disposable local credentials separate from hosted configuration. Do not introduce another backend, worker or orchestration layer without a measured need.

## Alternatives

Reviving legacy services would multiply untested paths. Direct browser-to-ML access would bypass the application authorization boundary. A new queue may be justified later by measured inference or scheduling demand.

## Consequences and current limits

The ML service must be network-reachable by its caller; token authentication, not CORS, enforces access. Local containers used for integration tests are not a restored legacy Docker deployment. Health and model loading do not establish forecast skill; uptime defect #199 remains open.

## Validation and delivery

Use documented web/ML startup, authenticated proxy failures, actual DB/Auth integration, bounded request failures and owned-service cleanup. Validate a hosted target separately before making availability claims.

## Decisions still required

Hosting budget, operational owner, service objectives and any queue/workload split are not specified. #188 owns operational evidence; #149 owns supported runtime updates.

## Sources

- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [DEPLOYMENT.md](../../DEPLOYMENT.md)
- [ml/app/main.py](../../ml/app/main.py)
