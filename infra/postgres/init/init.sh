#!/bin/sh
# Cluster bootstrap: the four login roles architecture.md §7.6 names, and the one schema the
# migration runner cannot create for itself.
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
# ONE EXCEPTION, and it is forced rather than chosen: the `migration` schema below. TypeORM's
# MigrationExecutor calls createMigrationsTableIfNotExist() BEFORE it executes anything, and
# that path calls queryRunner.createTable() without ever calling createSchema(). So a ledger
# living in its own schema is a chicken-and-egg: the first `migration:run` fails on a missing
# schema before it can run the migration that would have created it. Same shape as the roles,
# same resolution — bootstrap it here. Nothing else about §7.1 moves.
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

# The one role that may see across tenants: cross-tenant rollups, taxonomy migration runs
# (§11.5) and the admin API (§7.6). Read-only, and every acquisition is logged. It is NOT the
# role that runs schema migrations — it cannot, being read-only; that is esg_migrator below.
ensure_role esg_admin_ro  "$ESG_ADMIN_RO_PASSWORD"  "NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS"

# §7.6's fourth row, "migration owner": schema migrations only, credentials never available to
# a runtime process. It owns every schema, table, policy and trigger the migrations create,
# and NFR-33's "append-only fails at the store" rests on that ownership being held by a role
# neither esg_app, esg_worker nor esg_admin_ro can reach — an owner can ALTER TABLE ... DISABLE
# TRIGGER or simply drop it (§7.7).
#
# NOSUPERUSER for the same reason, and NOBYPASSRLS is not the protection people assume it is:
# a table's OWNER is exempt from its own RLS policies regardless of rolbypassrls. That is why
# task 12's policies must be written with FORCE ROW LEVEL SECURITY — without it, the exemption
# is invisible until someone runs a probe as the owner and it passes.
ensure_role esg_migrator  "$ESG_MIGRATOR_PASSWORD"  "NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS"

$PSQL <<-EOSQL
	GRANT CONNECT ON DATABASE $POSTGRES_DB TO esg_app, esg_worker, esg_admin_ro, esg_migrator;

	-- Only the migration owner may add schemas to this database. The three runtime roles get
	-- CONNECT and nothing structural.
	GRANT CREATE ON DATABASE $POSTGRES_DB TO esg_migrator;

	-- Nobody creates objects in public: the five schemas of §7.1 own everything. USAGE stays,
	-- because extensions installed into public (btree_gist) must remain resolvable to the
	-- application roles or an index built on their operator classes becomes unusable.
	REVOKE CREATE ON SCHEMA public FROM PUBLIC;
	GRANT USAGE ON SCHEMA public TO esg_app, esg_worker, esg_admin_ro;

	-- The single exception to the line above, and it is what makes that line affordable:
	-- btree_gist is a TRUSTED extension, so the baseline migration can install it as a
	-- non-superuser — but only into a schema it holds CREATE on, and public is where the
	-- comment above says extensions live. Granting it here rather than widening the REVOKE
	-- keeps "no application role creates anything in public" exactly true.
	GRANT CREATE ON SCHEMA public TO esg_migrator;

	-- The ledger's home (see the header). Infrastructure bookkeeping, not a §7.1 domain
	-- schema: no runtime role is granted USAGE, so migration.migrations is unreadable and
	-- unforgeable from the application tier by construction rather than by table grants
	-- someone has to remember not to write.
	CREATE SCHEMA IF NOT EXISTS migration AUTHORIZATION esg_migrator;
EOSQL

echo "init: done — 4 roles + the migration ledger schema. Everything else is the first migration."
