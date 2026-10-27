# Contributing to Roneira AI HIFI

Start with the [README](README.md), [product plan](docs/product/README.md) and
[live delivery tracker](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/189).
Search existing issues and PRs before starting work. An issue marked ready may
still require a product or architecture decision; read its acceptance criteria.

## Quick Start

Fork the repository if needed, create a focused branch from the intended base,
and link the actual issue number, for example `fix/123-short-description`.
Use the [README quickstart](README.md#getting-started) for installation,
configuration and the two development servers. The maintained surfaces are
`src/`, `ml/`, `supabase/` and the supporting `data/` project; see
[Architecture](ARCHITECTURE.md#canonical-surfaces).

## Development Setup

Use Node >=22.12, npm >=9 and Python 3.11. The ML requirements are declared in
[ml/requirements.txt](ml/requirements.txt); use the committed npm lockfile with
`npm ci`. Keep the same private `ML_SERVICE_TOKEN` in the web and ML environments.

On Windows, create the environment with `py -3.11 -m venv .venv` and activate it
with `.venv\Scripts\Activate.ps1`. Other setup steps are in the README.

Local Supabase needs Docker. `npx supabase start` applies local migrations and
[synthetic seed accounts](supabase/seed.sql); Studio is at
http://127.0.0.1:54323. Copy the local URL/keys privately using
`npx supabase status`. Use `npx supabase stop` to stop the stack.
`npx supabase db reset` destroys and rebuilds that local database: preserve any
valuable local data before using it.

For a hosted development project, follow [Supabase deployment](DEPLOYMENT.md#1-supabase)
and verify the target before applying pending migrations. Never run the local
seed, test bootstrap or disposable regression fixtures against a hosted project.
Docker runs the local database and integration tests; the web/ML development
servers run directly. The removed legacy Compose stack is not a supported setup.

If Docker Desktop on Windows fails with “The file cannot be accessed by the
system”, stale sockets may remain under `%LOCALAPPDATA%\Docker\run` or
`%LOCALAPPDATA%\docker-secrets-engine`. Quit Docker Desktop before renaming the
affected folder for inspection; it is recreated on startup. Preserve the old
folder until resolved. Factory reset deletes images and volumes.

## Branching Model

Keep one issue or cohesive outcome per branch and PR. Existing `main` and
`develop` workflow triggers do not establish a required Git Flow or prove branch
protection. Follow the repository's actual review/check requirements; do not
rewrite shared history or mix unrelated cleanup into a fix.

## Commit Guidelines

Use descriptive Conventional Commit subjects such as
`fix(api): handle an unavailable quote`. Reference issues in the PR or footer.
Use `Closes #N` only when the entire issue is satisfied; use `Refs #N` for partial work.

`npm ci` runs the `prepare` script, which installs the native Git hook through
`core.hooksPath=.husky`. Activate the Python environment before committing ML
changes. The hook runs web lint/types/tests, plus ML or data checks when those
paths are staged. To invoke it directly, use `sh .husky/pre-commit`.
Do not bypass failed checks to manufacture a successful delivery.

## Code Style Guidelines

Follow nearby code and the checked-in TypeScript, ESLint and pytest configuration.
Prefer cohesive functions, explicit types at interfaces and actionable errors.
Keep financial calculations separate from presentation. Document important
invariants and reasons; avoid wrappers, examples or dependencies without a user.

Do not commit credentials, private portfolios or restricted provider downloads.
Keep fixtures synthetic and logs redacted. MIT licensing for code does not grant
third-party data or model redistribution rights; see the
[data project](data/README.md) and [hosting requirements](docs/product/open-source-hosting-prd.md).
Do not publish unpatched vulnerability or secret details in public issues/PRs.
Use a verified private reporting channel; if unavailable, keep a restricted draft
and ask the repository owner for the appropriate private route.

## Contributing a Machine Learning Model

Follow [the model contribution contract](ml/MODELS.md#contributing-a-model)
and [frozen research protocol](ml/research/README.md).

- Implement the documented prediction/readiness interface and wire supported
  selections into the API. Explain the actual algorithm behind compatibility names.
- Keep heavy training offline and candidates separate from deployed bundles.
  Random Forest's documented per-request fit is the existing exception.
- Version feature/window/horizon metadata and reject incompatible artifacts.
  Missing methods return disclosed unavailable states and are excluded from blends.
- Validate on chronological, label-resolution-purged periods; report baselines,
  coverage and limitations. Test insufficient history, invalid inputs and fallback.
- Do not present a heuristic score as probability, hide hard outcomes, tune on
  the final assessment period or promote an artifact merely because tests pass.

## Fixing a Reported Issue

Reproduce the failure before fixing its cause. Add a meaningful failing regression
where practical, preserve legitimate and negative cases, then verify the actual
entry point. A proposed fix in an issue is a starting point, not a requirement
to repeat an obsolete implementation.

## Testing Requirements

The [README validation commands](README.md#training-and-testing) cover lint,
types, web/ML tests, data validation and production build. Useful examples include
[cache behavior](src/lib/server/cache.test.ts),
[alert delivery](src/app/api/cron/alerts/route.test.ts), and the
[real FastAPI entrypoint](ml/tests/test_app_entrypoint.py).

Server tests use Vitest's Node environment. Add `// @vitest-environment jsdom`
only to component tests that need a DOM. Mock metered providers and use controlled
clocks/data; test observable behavior rather than private helper exports.

[Database testing](supabase/tests/README.md) covers disposable PostgreSQL/RLS and
real GoTrue deletion. Never use production credentials or destructive hosted
fixtures. CI runs web/build, ML, data, database, GoTrue and Trivy jobs; inspect the
[workflow](.github/workflows/ci.yml) and actual run for scope/results. Hosted
provider access, availability, browser usability and model quality need separate
evidence. No coverage percentage or additional scanner is promised by this guide.

## Pull Request Workflow

Open a focused PR using the [existing template](.github/PULL_REQUEST_TEMPLATE.md).
Describe the problem, resulting behavior, issue/PRD links, actual validation,
remaining gaps and rollout/rollback. Include user-visible captures when useful.
Keep secrets, restricted data and sensitive findings out of public metadata.

## Review Process

Review correctness, authorization, financial invariants, failure behavior and test
strength. Respond to feedback with evidence and keep the PR description aligned
with its final scope. The existing contribution policy calls for one maintainer
on bug/dependency changes, two on features, all maintainers on breaking changes,
and security review on security fixes. Actual branch enforcement is a separate
repository setting; agent reviews do not substitute for required human approval.

## Release Process

A merged PR is not proof of deployment or safe public operation. Follow
[Deployment](DEPLOYMENT.md), record the actual target and verification, and keep
[release evidence](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/188) separate
from CI. Confirm authorization before publishing, changing hosted resources or
promoting models. This repository does not document an automatic version-bump
or commercial-launch process.

## Community Guidelines

Follow the [Code of Conduct](CODE_OF_CONDUCT.md). Keep reviews constructive,
respect private data and licensing, and avoid promises of investment performance.

## Getting Help

Use [GitHub issues](https://github.com/aaron-seq/Roneira-AI-HIFI/issues) for
non-sensitive questions, bugs and proposals. Include reproducible steps, runtime
versions and redacted errors. Contribution, deployment and research links above
are the maintained guides; no office-hours, mentorship or support SLA is promised.
