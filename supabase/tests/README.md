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
that a business operation occurred. Event UPDATE/DELETE protections remain.

`account-deletion.sql` requires migration 015. It verifies parent-first and
child-first deletion, unchanged historical event fields, cascade audit writers,
surviving accounts, email/username reuse, caller RLS and temporary-schema attacks,
and service-role/owner tamper denial. Its temporary attack policies, triggers and
fixtures roll back. It does not define personal-data erasure; see
[ADR 0002](../../docs/adr/0002-audit-retention-on-account-deletion.md).

Every regression uses a transaction and rolls its fixtures back. CI runs the
bootstrap, filename-ordered migrations and these SQL files on disposable
PostgreSQL 17; real Supabase Auth HTTP behavior requires separate local-stack
validation.

## Real GoTrue hard-delete regression

With Docker running and Python 3.11, from the repository root:

```sh
python supabase/tests/run-gotrue-deletion.py --pull
```

The standard-library runner creates its own disposable PostgreSQL 17 and GoTrue
v2.197.0 containers from pinned official digests. It accepts no external URL or
credentials. Password/JWT material is generated in memory; the database has no
published port and Auth binds only a random loopback port. Owned containers and
network are removed on completion or handled interruption. Omit `--pull` when
the exact images are already cached; pull failures do not disable verification.

It applies all migrations and uses real signup/admin DELETE endpoints for two
synthetic accounts: signup-only and active holdings/watchlist/related data. It
checks retained audit fields/cascade events, removal of operational rows, existing
unlinked prediction-history retention, denied anonymous/non-admin deletes,
GoTrue user/refresh/password rejection after deletion, and an unaffected survivor.
It does not test a complete Supabase stack, global JWT revocation or hosted data.
CI runs this command separately from the SQL-only job.

To reproduce the old failure on a separate disposable stack:

```sh
python supabase/tests/run-gotrue-deletion.py --through-migration 14
# Expected: exit 1, admin DELETE reports HTTP 500 rather than 200.
```

With migration 015 the expected result is exit 0 and a JSON summary containing
`status: passed` and `hard_deleted_accounts: 2`. Never run the SQL bootstrap or
owner-level fixtures on a hosted project. The runner deliberately provides no
hosted-target override.
