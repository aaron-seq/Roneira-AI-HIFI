"""Real GoTrue hard-delete regression on an owned disposable Docker stack.

Standard library only. No supplied URLs/credentials or hosted-target option.
Pinned images, generated in-memory secrets, private DB and loopback Auth port.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import hmac
import json
import os
from pathlib import Path
import secrets
import signal
import subprocess
import time
import urllib.error
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[2]
IMAGES = {
    "db": "postgres@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24",
    "auth": "ghcr.io/supabase/gotrue@sha256:1736a63078f5922b198c4cbe50f80ab9a2d3b54fe8b7b6cfb2e9dc5dbbc12c6b",
}


def run(pull: bool = False, through_migration: int | None = None) -> dict:
    if through_migration is not None and through_migration < 14:
        raise RuntimeError("This regression requires migrations through at least 014")
    prefix = "roneira-delete-" + secrets.token_hex(5)
    network, containers = prefix + "-network", []
    password, jwt_secret = secrets.token_hex(32), secrets.token_hex(32)
    private_values = [password, jwt_secret]
    network_created = False

    def command(args: list[str], *, sql: str | None = None, env: dict | None = None) -> str:
        result = subprocess.run(args, input=sql, text=True, capture_output=True, env=env)
        if result.returncode:
            error = result.stderr[-2000:]
            for value in private_values:
                error = error.replace(value, "[redacted]")
            raise RuntimeError(error or "Disposable test command failed")
        return result.stdout

    def psql(sql: str) -> str:
        return command(["docker", "exec", "-i", "--user", "postgres", prefix + "-db",
                        "psql", "-qAt", "-v", "ON_ERROR_STOP=1", "-d", "postgres"], sql=sql)

    def start(kind: str, env: dict, extra: list[str]) -> None:
        name = prefix + "-" + kind
        containers.append(name)
        command(["docker", "run", "-d", "--pull", "never", "--name", name,
                 "--label", "roneira.disposable-deletion=" + prefix, "--network", network,
                 *[part for key in env for part in ("-e", key)], *extra, IMAGES[kind]],
                env={**os.environ, **env})

    def wait(check) -> None:
        deadline = time.monotonic() + 45
        while True:
            try:
                check()
                return
            except (RuntimeError, OSError):
                if time.monotonic() >= deadline:
                    raise RuntimeError("Disposable service readiness timed out") from None
                time.sleep(.25)

    def interrupted(_signum, _frame):
        raise KeyboardInterrupt

    previous_handlers = {sig: signal.signal(sig, interrupted) for sig in (signal.SIGTERM, signal.SIGINT)}
    try:
        for image in IMAGES.values():
            if pull:
                command(["docker", "pull", image])
            command(["docker", "image", "inspect", "--format", "{{.Id}}", image])
        command(["docker", "network", "create", "--label", "roneira.disposable-deletion=" + prefix, network])
        network_created = True
        start("db", {"POSTGRES_PASSWORD": password, "POSTGRES_DB": "postgres"},
              ["--network-alias", "db", "--tmpfs", "/var/lib/postgresql/data:rw,noexec,nosuid,size=512m"])
        # The image briefly runs an initialization server on a Unix socket.
        # TCP readiness waits for the final server instead of racing its restart.
        wait(lambda: command(["docker", "exec", prefix + "-db", "pg_isready", "-h", "127.0.0.1", "-U", "postgres"]))
        psql(f"""
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE supabase_auth_admin LOGIN NOINHERIT CREATEROLE PASSWORD '{password}';
CREATE SCHEMA auth AUTHORIZATION supabase_auth_admin;
ALTER ROLE supabase_auth_admin SET search_path TO auth, public;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
""")
        start("auth", {
            "GOTRUE_API_HOST": "0.0.0.0", "GOTRUE_API_PORT": "9999",
            "API_EXTERNAL_URL": "http://127.0.0.1", "GOTRUE_SITE_URL": "http://127.0.0.1",
            "GOTRUE_DB_DRIVER": "postgres",
            "GOTRUE_DB_DATABASE_URL": f"postgres://supabase_auth_admin:{password}@db:5432/postgres",
            "GOTRUE_JWT_SECRET": jwt_secret, "GOTRUE_JWT_ADMIN_ROLES": "service_role",
            "GOTRUE_JWT_AUD": "authenticated", "GOTRUE_JWT_DEFAULT_GROUP_NAME": "authenticated",
            "GOTRUE_JWT_EXP": "3600", "GOTRUE_EXTERNAL_EMAIL_ENABLED": "true",
            "GOTRUE_MAILER_AUTOCONFIRM": "true", "GOTRUE_LOG_LEVEL": "error",
        }, ["--publish", "127.0.0.1::9999"])
        port = command(["docker", "inspect", "--format",
                        '{{(index (index .NetworkSettings.Ports "9999/tcp") 0).HostPort}}', prefix + "-auth"]).strip()
        if not port.isdigit():
            raise RuntimeError("No loopback Auth test port")
        # Ignore caller proxy settings: this runner only contacts its own loopback port.
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

        def request(path: str, *, token: str | None = None, method: str = "GET",
                    body: dict | None = None, expected: int = 200) -> dict:
            headers = {"Content-Type": "application/json"}
            if token:
                headers["Authorization"] = "Bearer " + token
            req = urllib.request.Request(f"http://127.0.0.1:{port}" + path, method=method,
                data=None if body is None else json.dumps(body).encode(), headers=headers)
            try:
                with opener.open(req, timeout=10) as response:
                    status, payload = response.status, response.read()
            except urllib.error.HTTPError as exc:
                status, payload = exc.code, exc.read()
            if status != expected:
                raise RuntimeError(f"{method} {path.split('?')[0]}: HTTP {status}, expected {expected}")
            return json.loads(payload) if payload else {}

        wait(lambda: request("/health"))
        health = request("/health")
        psql("""
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
""")
        migrations = sorted((ROOT / "supabase/migrations").glob("*.sql"))
        if through_migration is not None:
            migrations = [p for p in migrations if int(p.name.split("_", 1)[0]) <= through_migration]
        for migration in migrations:
            psql(migration.read_text())

        def encode(value: dict) -> bytes:
            return base64.urlsafe_b64encode(json.dumps(value, separators=(",", ":")).encode()).rstrip(b"=")
        signed = encode({"alg": "HS256", "typ": "JWT"}) + b"." + encode({
            "role": "service_role", "aud": "authenticated", "iat": int(time.time()), "exp": int(time.time()) + 600,
        })
        admin = (signed + b"." + base64.urlsafe_b64encode(hmac.new(jwt_secret.encode(), signed, hashlib.sha256).digest()).rstrip(b"=")).decode()
        private_values.append(admin)
        accounts = []
        for index in range(3):
            email, account_password = f"{prefix}-{index}@example.test", secrets.token_urlsafe(24)
            session = request("/signup", method="POST", body={"email": email, "password": account_password,
                "data": {"username": f"{prefix}-{index}"}})
            user_id = str(uuid.UUID(session["user"]["id"]))
            private_values.extend([account_password, session["access_token"], session["refresh_token"]])
            accounts.append((user_id, email, account_password, session))
        active = accounts[1][0]
        psql(f"""
INSERT INTO public.portfolio_holdings(id,user_id,ticker,company_name,exchange,quantity,avg_buy_price)
 VALUES('a1750000-0000-0000-0000-000000000099','{active}','SYNTH.NS','Synthetic','NSE',1,100);
INSERT INTO public.watchlist(user_id,ticker,exchange,notes) VALUES('{active}','SYNTH.NS','NSE','synthetic retained evidence');
INSERT INTO public.portfolio_transactions(user_id,holding_id,ticker,transaction_type,quantity,price)
 VALUES('{active}','a1750000-0000-0000-0000-000000000099','SYNTH.NS','BUY',1,100);
INSERT INTO public.notifications(user_id,kind,title) VALUES('{active}','PRICE_ALERT','synthetic');
INSERT INTO public.prediction_history(user_id,ticker,timeframe,model_used,current_price_at_prediction,predicted_price,confidence_score,target_date)
 VALUES('{active}','SYNTH.NS','1month','TECHNICAL',100,101,0,now());
INSERT INTO public.portfolio_valuation_snapshots(user_id,valuation_date,captured_at,holdings_observed_at,currency,invested_value,current_value,total_holdings,priced_holdings,coverage_complete)
 VALUES('{active}',(now() AT TIME ZONE 'UTC')::date,now(),now(),'INR',0,0,0,0,true);
""")
        request(f"/admin/users/{active}", method="DELETE", body={"should_soft_delete": False}, expected=401)
        request(f"/admin/users/{active}", method="DELETE", token=accounts[2][3]["access_token"],
                body={"should_soft_delete": False}, expected=403)
        for user_id, email, account_password, session in accounts[:2]:
            before = json.loads(psql(f"SELECT jsonb_agg(to_jsonb(a)) FROM public.audit_log a WHERE user_id='{user_id}';"))
            assert before, "real signup must create an audit event"
            request(f"/admin/users/{user_id}", method="DELETE", token=admin, body={"should_soft_delete": False})
            ids = ",".join("'" + str(uuid.UUID(row["id"])) + "'" for row in before)
            after = json.loads(psql(f"SELECT jsonb_agg(to_jsonb(a)) FROM public.audit_log a WHERE id IN ({ids});"))
            assert len(after) == len(before), "hard-delete must retain prior audit rows"
            original = {row["id"]: {k: v for k, v in row.items() if k != "user_id"} for row in before}
            assert all(row["user_id"] is None and {k: v for k, v in row.items() if k != "user_id"} == original[row["id"]] for row in after), "only live profile links may change"
            psql(f"""DO $$ BEGIN
 ASSERT NOT EXISTS(SELECT 1 FROM auth.users WHERE id='{user_id}');
 ASSERT NOT EXISTS(SELECT 1 FROM auth.identities WHERE user_id='{user_id}');
 ASSERT NOT EXISTS(SELECT 1 FROM auth.sessions WHERE user_id='{user_id}');
 ASSERT NOT EXISTS(SELECT 1 FROM public.users WHERE id='{user_id}');
 END $$;""")
            request("/user", token=session["access_token"], expected=403)
            request("/token?grant_type=refresh_token", method="POST", body={"refresh_token": session["refresh_token"]}, expected=400)
            request("/token?grant_type=password", method="POST", body={"email": email, "password": account_password}, expected=400)
        for table in ["portfolio_holdings", "watchlist", "portfolio_transactions", "news_preferences", "notifications", "portfolio_valuation_snapshots"]:
            assert psql(f"SELECT count(*) FROM public.{table} WHERE user_id='{active}';").strip() == "0", f"{table} must cascade"
        assert psql(f"SELECT count(*) FROM public.audit_log WHERE user_id IS NULL AND old_values->>'user_id'='{active}' AND action_type IN ('DELETE_HOLDING','REMOVE_WATCHLIST');").strip() == "2", "both cascade delete events must survive"
        assert psql("SELECT count(*) FROM public.prediction_history WHERE user_id IS NULL AND ticker='SYNTH.NS';").strip() == "1", "existing unlinked forecast retention is unchanged"
        survivor = accounts[2][3]
        assert request("/user", token=survivor["access_token"])["id"] == accounts[2][0], "surviving account must stay usable"
        return {"status": "passed", "migrations": len(migrations), "hard_deleted_accounts": 2,
                "gotrue_version": health.get("version"),
                "unauthorized_admin_deletes_denied": 2, "survivor_unchanged": True,
                "prior_audit_fields_retained": True, "cascade_events_retained": True,
                "gotrue_session_refresh_and_signin_rejected_after_deletion": True}
    finally:
        cleanup_failed = False
        for name in reversed(containers):
            removed = subprocess.run(["docker", "rm", "-f", name], capture_output=True)
            if removed.returncode and subprocess.run(["docker", "inspect", name], capture_output=True).returncode == 0:
                cleanup_failed = True
        if network_created:
            if subprocess.run(["docker", "network", "rm", network], capture_output=True).returncode:
                cleanup_failed = True
        for sig, previous in previous_handlers.items():
            signal.signal(sig, previous)
        if cleanup_failed:
            raise RuntimeError("Could not remove an owned disposable test resource")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pull", action="store_true", help="Pull the pinned official image digests before running (CI).")
    parser.add_argument("--through-migration", type=int, help="Optional schema ceiling for reproducing an older failure; default applies all migrations.")
    args = parser.parse_args()
    try:
        print(json.dumps(run(args.pull, args.through_migration)))
    except (AssertionError, RuntimeError, OSError) as exc:
        print(json.dumps({"status": "failed", "error": str(exc)}))
        raise SystemExit(1)
