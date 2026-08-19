#!/bin/sh
# Cluster bootstrap: the three login roles architecture.md §7.6 names, and nothing else.
#
# WHY THIS FILE EXISTS AT ALL, given TypeORM migrations can run any DDL:
# a migration cannot create the role it connects as. apps/api authenticates to PostgreSQL as
# esg_app, so that role has to exist before any connection succeeds, let alone any migration.
# CREATE ROLE is also a cluster-level object, outside any single database, which puts it
# outside a migration's remit by definition.
#
# Everything that is a *database* object therefore belongs in the first migration, not here —
# the five schemas of §7.1, btree_gist for §12.3's temporal constraints, and every table,
# grant, RLS policy and audit trigger. §7.6 says it directly: "the CREATE POLICY statements
# are a migration."
#
# It is a .sh and not a .sql because the entrypoint runs .sql files through plain `psql -f`,
# with no shell expansion and no -v bindings — so a role password held in an environment
# variable cannot reach one.
#
# TWO WAYS THIS RUNS, and the second is the one an existing checkout needs. PostgreSQL
# executes /docker-entrypoint-initdb.d only against a *fresh* data directory, so an easyesg
# pgdata volume that already holds data will never see this. It is therefore idempotent and
# runnable by hand:
#
#     docker compose exec postgres /docker-entrypoint-initdb.d/init.sh
#
# That is the documented repair. Deliberately NOT `docker compose down -v`, which destroys the
# data the repair exists to preserve.
set -e

PSQL="psql -v ON_ERROR_STOP=1 --username $POSTGRES_USER --dbname $POSTGRES_DB"

# CREATE and ALTER take the same attribute syntax, so one helper covers both paths and the
# second run of this script is a no-op that also re-asserts the password.
ensure_role() {
    role="$1"
    password="$2"
    attrs="$3"

    if [ "$($PSQL -tAc "SELECT 1 FROM pg_roles WHERE rolname = '$role'")" = "1" ]; then
        echo "init: role '$role' exists — re-asserting attributes and password."
        verb="ALTER"
    else
        echo "init: creating role '$role'."
        verb="CREATE"
    fi

    $PSQL -c "$verb ROLE $role WITH LOGIN PASSWORD '$password' $attrs"
}

# NOBYPASSRLS is the load-bearing word here, not a formality. AD-2 makes PostgreSQL RLS the
# entire tenancy boundary; a role that bypasses it makes every future cross-tenant probe pass
# for the wrong reason, which is worse than no probe at all. Same for NOSUPERUSER — a
# superuser bypasses RLS whatever this says.
ensure_role esg_app       "$ESG_APP_PASSWORD"       "NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS"
ensure_role esg_worker    "$ESG_WORKER_PASSWORD"    "NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS"

# The one role that may see across tenants: cross-tenant rollups, migration runs and the admin
# API (§7.6). Read-only, and every acquisition is logged.
ensure_role esg_admin_ro  "$ESG_ADMIN_RO_PASSWORD"  "NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS"

$PSQL <<-EOSQL
	GRANT CONNECT ON DATABASE $POSTGRES_DB TO esg_app, esg_worker, esg_admin_ro;

	-- Nobody creates objects in public: the five schemas of §7.1 own everything. USAGE stays,
	-- because extensions installed into public (btree_gist) must remain resolvable to the
	-- application roles or an index built on their operator classes becomes unusable.
	REVOKE CREATE ON SCHEMA public FROM PUBLIC;
	GRANT USAGE ON SCHEMA public TO esg_app, esg_worker, esg_admin_ro;
EOSQL

echo "init: done — 3 roles. Schemas, extensions and tables belong to the first migration."
