#!/usr/bin/env bash
# Runs a command against a fresh, owned, loopback-only PostgreSQL cluster with the privacy
# ledger migration applied, then stops the cluster and removes only its own directory.
#   scripts/privacy-test-db.sh node --test tests/privacy-ledger.test.mjs
# Exports PRIVACY_TEST_DATABASE_URL to the command. Never touches any other database.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
migration="${root}/prisma/migrations/20261011000000_storefront_privacy_consents/migration.sql"
for tool in initdb pg_ctl psql createdb; do command -v "$tool" >/dev/null || { echo "privacy-test-db: $tool not found" >&2; exit 69; }; done
[[ $# -gt 0 ]] || { echo "usage: $0 <command...>" >&2; exit 64; }

# Ignore ambient libpq configuration so no tool can be redirected elsewhere.
for name in $(env | sed -n 's/^\(PG[A-Z_]*\)=.*/\1/p'); do unset "$name"; done

work="$(mktemp -d "${TMPDIR:-/tmp}/iqon-privacy-pg.XXXXXX")"
owned_cluster=0
cleanup() {
  local status=$?
  if [[ $owned_cluster == 1 ]]; then pg_ctl -D "$work/data" -m fast -w stop >/dev/null 2>&1 || true; fi
  [[ -f "$work/data/postmaster.pid" ]] && echo "privacy-test-db: cluster still running in $work" >&2 || rm -rf "$work"
  exit $status
}
trap cleanup EXIT INT TERM

mkdir -p "$work/home" "$work/tmp" "$work/socket"
: >"$work/empty.pgpass" && chmod 600 "$work/empty.pgpass"
export PGPASSFILE="$work/empty.pgpass" PGSERVICEFILE="$work/empty.pgpass"
port=$(( 20000 + RANDOM % 20000 ))
user=privacy_test
database="privacy_ledger_$(date +%s)_$RANDOM"
HOME="$work/home" TMPDIR="$work/tmp" initdb -D "$work/data" -U "$user" --auth=trust -E UTF8 --locale=C >"$work/initdb.log" 2>&1
HOME="$work/home" TMPDIR="$work/tmp" pg_ctl -D "$work/data" -l "$work/server.log" -w \
  -o "-c listen_addresses=127.0.0.1 -p $port -k $work/socket -c fsync=off" start >/dev/null
owned_cluster=1
pin=(-h 127.0.0.1 -p "$port" -U "$user")
createdb "${pin[@]}" "$database"
psql "${pin[@]}" -d "$database" -v ON_ERROR_STOP=1 -q -f "$migration"

export PRIVACY_TEST_DATABASE_URL="postgresql://${user}@127.0.0.1:${port}/${database}?connection_limit=10"
export PRIVACY_TEST_PSQL="psql -h 127.0.0.1 -p $port -U $user -d $database"
echo "privacy-test-db: owned cluster on 127.0.0.1:$port database $database" >&2
set +e
"$@"
status=$?
set -e
exit $status
