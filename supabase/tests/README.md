# Database regressions

Use an empty disposable PostgreSQL 17 database. `bootstrap.sql` provides the
minimal Auth schema and roles needed to apply the real application migrations;
it does not reproduce Supabase Auth HTTP behavior. Do not run the bootstrap or
these owner-level fixtures against a hosted or production database.

For an existing disposable Docker container named `roneira-tests-postgres`, run
from the repository root:

```sh
docker exec --user postgres roneira-tests-postgres createdb roneira_regression_tests
docker exec -i --user postgres roneira-tests-postgres psql -v ON_ERROR_STOP=1 -d roneira_regression_tests < supabase/tests/bootstrap.sql
for migration in supabase/migrations/*.sql; do
  docker exec -i --user postgres roneira-tests-postgres psql -v ON_ERROR_STOP=1 -d roneira_regression_tests < "$migration"
done
for regression in supabase/tests/*.sql; do
  case "$regression" in */bootstrap.sql) continue ;; esac
  docker exec -i --user postgres roneira-tests-postgres psql -v ON_ERROR_STOP=1 -d roneira_regression_tests < "$regression"
done
```

`price-alert-delivery.sql` checks one-shot delivery, insert-error rollback and
retry, stale revisions, same-level re-arming, notification preferences, stale
sessions, notification row/column permissions, and denial of the delivery RPC to
`anon` and `authenticated`. It rolls
back its fixtures. The cron must be deployed with migration 012 applied; without
the RPC, delivery fails with a retryable HTTP 503 rather than consuming alerts.

`portfolio-history.sql` checks server-calculated captures, one capture per UTC
day/currency, ordered writes, numeric/count constraints, private SELECT RLS and
denial of direct client writes/RPC access. It requires migration 013.

`trusted-audit-writes.sql` checks that both anonymous and authenticated callers
cannot directly append own/cross-user audit rows. It also verifies account-local
read access, signup/portfolio/watchlist trigger-generated records, trusted
service-role insertion and continued hard UPDATE/DELETE rejection. It requires
migration 014. The authenticated Next audit endpoint remains the supported path
for bounded, actor-bound client-reported activity; such reports do not establish
that a business operation occurred. Audit UPDATE/DELETE rules and the known
account-deletion conflict in issue #174 are unchanged.

Every regression uses a transaction and rolls its fixtures back. CI runs the
bootstrap, filename-ordered migrations and these SQL files on disposable
PostgreSQL 17; real Supabase Auth HTTP behavior requires separate local-stack
validation.
