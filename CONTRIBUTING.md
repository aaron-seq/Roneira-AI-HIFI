# Contributing to Roneira AI HIFI

We welcome contributions that improve correctness, performance, and developer experience. This guide describes our workflow, commit rules, semantic versioning policy, and review expectations.

## Branching Model
- `main`: protected; release-ready code only
- `develop`: integration branch for the next release
- `feature/<scope>`: short‑lived branches for single, focused changes

## Conventional Commits (Commit Lint Rules)
Format: `type(scope): short summary`

Types:
- `feat`: new user‑facing feature
- `fix`: bug fix
- `docs`: documentation only
- `style`: formatting; no code behavior change
- `refactor`: code change that neither fixes a bug nor adds a feature
- `perf`: performance improvement
- `test`: tests only
- `build`: build system or external dependencies
- `ci`: CI workflow changes
- `chore`: maintenance (no src or test changes)
- `revert`: revert a previous commit

Examples:
- `feat(ml): add vectorized RSI computation pipeline`
- `fix(api): normalize ML error payloads for frontend handling`
- `perf(db): tune pool size and enable prepared statements`
- `refactor(ui): extract prediction panel into reusable component`

Body (recommended):
- Explain the motivation, approach, tradeoffs, and risks.

Footer (optional):
- Reference issues: `Fixes #123`, `Refs #456`
- Breaking changes: `BREAKING CHANGE: rename /api/predict response fields`

## Semantic Versioning (SemVer 2.0.0)
- `MAJOR`: incompatible API changes (breaking)
- `MINOR`: backward‑compatible functionality
- `PATCH`: backward‑compatible bug fixes and internal improvements

Release notes:
- Summarize features, fixes, migrations, and known issues.
- Include upgrade instructions when breaking changes occur.

## Pull Request Workflow
- Keep scope focused; one logical change per PR.
- Include:
  - Problem statement and motivation
  - Approach and alternatives considered
  - Test plan (unit/integration) and results
  - Rollback plan
- Ensure:
  - [ ] Lint and type checks pass
  - [ ] Tests added/updated; all tests pass
  - [ ] Docs/README updated if behavior/config changes
  - [ ] API contracts validated (Zod/pydantic)
  - [ ] Performance impact reviewed (if applicable)
  - [ ] Security review done for sensitive areas

## Required Reviewers
- Default: at least one senior reviewer for non‑trivial changes
- Critical areas require domain reviewers:
  - ML service: ML reviewer
  - Security‑sensitive code: Security reviewer
  - Database schema and migrations: DB reviewer

To strictly enforce code owners, we use CODEOWNERS and GitHub Branch Protection (see below). Please provide reviewer handles to finalize CODEOWNERS.

## Code Style

### TypeScript (Frontend/Backend)
- Enable `strict` mode and use explicit types at module boundaries.
- Use descriptive, domain‑relevant names (`priceVelocity`, `portfolioSnapshot`).
- Prefer pure functions; isolate side effects.
- Return typed error objects with actionable context.

### Python (ML Service)
- Follow PEP 8 with Black formatting.
- Use type hints for inputs/outputs.
- Optimize for vectorized pandas/numpy operations.
- Provide clear exceptions and structured logs.

### General
- Small, composable, testable functions.
- Validate inputs at boundaries (Zod/pydantic styles).
- Meaningful commit messages in imperative mood.

## Tests
- Frontend: Vitest + RTL
- Backend: Jest + Supertest
- ML: pytest + coverage

## CI & Commit Lint
- CI validates PR title follows Conventional Commits.
- Status checks (lint, type, tests) must pass before merge.

## CODEOWNERS & Branch Protection
- CODEOWNERS assigns required reviewers by path. Example:
```
# Example (fill with real handles)
/ml-service/*       @ml-reviewers
/backend/src/db/*   @db-reviewers
/backend/src/sec/*  @security-reviewers
```
- Enable in GitHub: Branch Protection → Require review from Code Owners.

## Reporting Security Issues
Please do not file public issues. Email the maintainers or use a private channel to disclose responsibly.
