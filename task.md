# Roneira AI HIFI task guardrails

Work in the canonical `src/`, `ml/`, `supabase/` and supporting `data/` paths.
See [Architecture](ARCHITECTURE.md#canonical-surfaces) for runtime boundaries,
the [README](README.md#training-and-testing) for checks, and the
[delivery tracker](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/189)
for current priorities and acceptance criteria. Legacy services are recoverable
from Git history, not supported development entrypoints.

## Guardrails

- Treat `audit_log` as append-only; preserve the narrow account-unlink contract.
- Do not store volatile market prices in Supabase.
- Keep browser ML calls behind Next.js routes and enforce the private service token.
- Use Twelve Data first where supported, with yfinance fallback through `ml/`.
- Keep launch authentication on Supabase email/password, with username resolution
  in the existing login route.
