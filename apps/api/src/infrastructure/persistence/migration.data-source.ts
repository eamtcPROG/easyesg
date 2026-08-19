import { DataSource } from 'typeorm';
import { migrations } from './migrations';

/**
 * The migration runner's connection. Third DataSource, and the only one that runs DDL.
 *
 * It is separate from `data-source.ts`'s two rather than being one of them, because it
 * connects as a different role. §7.6 gives schema migrations to the **migration owner** —
 * NOSUPERUSER, owner of every object the migrations create, and used by nothing else.
 * `esg_app` and `esg_worker` own nothing and hold no DDL privilege, and `esg_admin_ro` is
 * read-only (its "migration runs" cell in §7.6 means §11.5's *taxonomy* migration runs, which
 * are worker jobs over report data, not schema changes). So there is no runtime DataSource
 * this could have been folded into.
 *
 * That separation is not organisational tidiness — §7.7 makes NFR-33's append-only guarantee
 * depend on it. A table's owner can `ALTER TABLE ... DISABLE TRIGGER` or drop the trigger
 * outright, so "attempted mutation fails at the store" holds only while the owning credential
 * is unavailable to any runtime process or operator session.
 *
 * **This file reads process.env directly, and it is the one place in apps/api that may.** The
 * house rule is ConfigService and never process.env — but this module is loaded by the TypeORM
 * CLI, outside Nest, where no ConfigService exists. Routing the owner's credentials through
 * `config/configuration.ts` to satisfy the rule would put them on the runtime configuration
 * surface, which is precisely what §7.7 says must not happen. The rule yields to the
 * requirement it exists to serve.
 */

/**
 * Fails with the variable's name rather than connecting as undefined. `pg` coerces a missing
 * username to the OS user and a missing password to none, so without this the failure arrives
 * as a PostgreSQL authentication error naming whoever is logged in — which sends the reader
 * looking at roles and pg_hba.conf instead of at their environment.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. The migration runner connects as the migration owner (§7.6); ` +
        'copy apps/api/.env.example to apps/api/.env for a local run.',
    );
  }
  return value;
}

export const migrationDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'postgres',
  port: Number.parseInt(process.env.DB_PORT ?? '5432', 10),
  database: process.env.DB_NAME ?? 'esg',
  username: required('DB_MIGRATOR_USER'),
  password: required('DB_MIGRATOR_PASSWORD'),

  // Puts the ledger at migration.migrations. A sixth schema, outside §7.1's five, because
  // those five are domain storage and this is bookkeeping — and because no runtime role holds
  // USAGE on it, so the record of what has been applied is unreadable and unforgeable from
  // the application tier by construction rather than by table grants someone must remember
  // not to write.
  //
  // The schema itself is created by infra/postgres/init/init.sh, not by the baseline, and
  // that is forced rather than chosen: TypeORM's MigrationExecutor calls
  // createMigrationsTableIfNotExist() before executing anything, and that path calls
  // createTable() without ever calling createSchema(). A ledger schema created by a migration
  // could therefore never be created at all.
  schema: 'migration',

  // Explicit rather than inherited. Every constraint in AD-14 is permanent, and a default
  // that happens to be correct today reads as an oversight to the next person.
  synchronize: false,
  dropSchema: false,
  entities: [],
  migrations,

  // TypeORM's default, stated because it is a real choice. `all` wraps the whole run in one
  // transaction, so a failing migration leaves the database exactly as it was — including the
  // ledger row, which never records a migration that did not complete. PostgreSQL makes DDL
  // transactional, so this costs nothing here.
  //
  // The one statement that will force this open is CREATE INDEX CONCURRENTLY, which cannot run
  // inside a transaction block and which expand→migrate→contract (§7.9) will eventually want
  // on a populated table. When that arrives it is `each` plus a migration written to be
  // re-runnable — not a quiet flip to `none` for the whole set.
  migrationsTransactionMode: 'all',

  applicationName: 'easyesg-migration',
});

// One export, and only one. CommandUtils.loadDataSource() walks every export of this module
// and refuses when more than one is a DataSource — so adding `export default
// migrationDataSource` alongside the named export fails with "must contain only one export of
// DataSource instance", naming the same object twice.
