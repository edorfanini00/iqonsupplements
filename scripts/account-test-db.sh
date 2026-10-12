#!/usr/bin/env bash
# Runs a command against a fresh, owned, loopback-only PostgreSQL cluster with the
# customer-account session migration applied, then stops the cluster and removes only its
# own directory. Ambient libpq settings are ignored so nothing can point it elsewhere.
#   scripts/account-test-db.sh node --import tsx --test tests/customer-account/*.test.ts
# Exports ACCOUNT_TEST_DATABASE_URL and ACCOUNT_TEST_PSQL to the command.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
migrations=("${root}/prisma/migrations/20261011010000_customer_account_sessions/migration.sql")
for tool in initdb pg_ctl psql createdb; do command -v "$tool" >/dev/null || { echo "account-test-db: $tool not found" >&2; exit 69; }; done
[[ $# -gt 0 ]] || { echo "usage: $0 <command...>" >&2; exit 64; }

# Ignore ambient libpq configuration so no tool can be redirected elsewhere.
for name in $(env | sed -n 's/^\(PG[A-Z_]*\)=.*/\1/p'); do unset "$name"; done

work="$(mktemp -d "${TMPDIR:-/tmp}/iqon-account-pg.XXXXXX")"
owned_cluster=0
cleanup() {
  local status=$?
  if [[ $owned_cluster == 1 ]]; then pg_ctl -D "$work/data" -m fast -w stop >/dev/null 2>&1 || true; fi
  [[ -f "$work/data/postmaster.pid" ]] && echo "account-test-db: cluster still running in $work" >&2 || rm -rf "$work"
  exit $status
}
trap cleanup EXIT INT TERM

mkdir -p "$work/home" "$work/tmp" "$work/socket"
: >"$work/empty.pgpass" && chmod 600 "$work/empty.pgpass"
export PGPASSFILE="$work/empty.pgpass" PGSERVICEFILE="$work/empty.pgpass"
port=$(( 20000 + RANDOM % 20000 ))
user=account_test
database="account_sessions_$(date +%s)_$RANDOM"
HOME="$work/home" TMPDIR="$work/tmp" initdb -D "$work/data" -U "$user" --auth=trust -E UTF8 --locale=C >"$work/initdb.log" 2>&1
HOME="$work/home" TMPDIR="$work/tmp" pg_ctl -D "$work/data" -l "$work/server.log" -w \
  -o "-c listen_addresses=127.0.0.1 -p $port -k $work/socket -c fsync=off" start >/dev/null
owned_cluster=1
pin=(-h 127.0.0.1 -p "$port" -U "$user")
createdb "${pin[@]}" "$database"
for migration in "${migrations[@]}"; do psql "${pin[@]}" -d "$database" -v ON_ERROR_STOP=1 -q -f "$migration"; done

export ACCOUNT_TEST_DATABASE_URL="postgresql://${user}@127.0.0.1:${port}/${database}?connection_limit=10"
export ACCOUNT_TEST_PSQL="psql -h 127.0.0.1 -p $port -U $user -d $database"
echo "account-test-db: owned cluster on 127.0.0.1:$port database $database" >&2
set +e
"$@"
status=$?
set -e
exit $status
