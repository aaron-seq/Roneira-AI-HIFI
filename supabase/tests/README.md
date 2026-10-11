# Alert database regressions

Use an empty disposable PostgreSQL 17 database. `bootstrap.sql` provides the
minimal Auth schema and roles needed to apply the real application migrations;
it does not reproduce Supabase Auth HTTP behavior. Do not run the bootstrap or
these owner-level fixtures against a hosted or production database.

For an existing disposable Docker container named `roneira-pr165-postgres`, run
from the repository root:

```sh
docker exec --user postgres roneira-pr165-postgres createdb roneira_alert_tests
docker exec -i --user postgres roneira-pr165-postgres psql -v ON_ERROR_STOP=1 -d roneira_alert_tests < supabase/tests/bootstrap.sql
for migration in supabase/migrations/*.sql; do
  docker exec -i --user postgres roneira-pr165-postgres psql -v ON_ERROR_STOP=1 -d roneira_alert_tests < "$migration"
done
docker exec -i --user postgres roneira-pr165-postgres psql -v ON_ERROR_STOP=1 -d roneira_alert_tests < supabase/tests/price-alert-delivery.sql
```

The regression transaction checks one-shot delivery, insert-error rollback and
retry, stale revisions, same-level re-arming, notification preferences, stale
sessions, notification row/column permissions, and denial of the delivery RPC to
`anon` and `authenticated`. It rolls
back its fixtures. The cron must be deployed with migration 012 applied; without
the RPC, delivery fails with a retryable HTTP 503 rather than consuming alerts.
