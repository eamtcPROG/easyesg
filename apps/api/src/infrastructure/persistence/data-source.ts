import type { DataSourceOptions } from 'typeorm';
import type { AppConfig } from '@api/config/configuration';

/**
 * Runtime connection options — AD-14, constraint 3: two DataSources, not one.
 *
 * They are two because a cross-context entity relation must be impossible to *declare*, not
 * merely forbidden by review (DR-1). It also makes NFR-1's "disable the billing context" test
 * a matter of not registering the second one, rather than a flag threaded through call sites.
 *
 * These are options, not DataSources. Nothing here opens a connection: `TypeOrmModule` is
 * wired in task 11, where the request's QueryRunner first has work to do. Registering it
 * earlier would make `pnpm openapi:check` — which boots the whole AppModule to emit the spec —
 * require a running PostgreSQL, turning a gate that runs anywhere into one that needs Docker
 * two tasks before anything needs a connection.
 */

/** Connection names, which are also the injection tokens `@InjectDataSource` resolves against. */
export const CORE_DATA_SOURCE = 'core';
export const BILLING_DATA_SOURCE = 'billing';

/**
 * `DataSourceOptions` plus the `name` TypeORM 1.1 removed from it — and it has to come back,
 * because `@nestjs/typeorm` 11.0.3 is inconsistent about where it reads the name from.
 *
 * `forRootAsync({ name: 'core', useFactory })` takes the name from its **module** options in two
 * places and from the **factory result** in a third:
 *
 *  - the provider token is `getDataSourceToken(moduleOptions)` → `'coreDataSource'`, correct;
 *  - creation spreads `{ ...factoryResult, name: moduleOptions.name }`, also correct;
 *  - but `onApplicationShutdown` calls `getDataSourceToken(TYPEORM_MODULE_OPTIONS)` — the factory
 *    result. With no `name` on it that resolves the **default** token, which does not exist when
 *    every data source is named, and the hook throws before it can destroy anything.
 *
 * That is a real production failure and not a test artefact: `main.http.ts` calls
 * `enableShutdownHooks()`, so a SIGTERM would fail the graceful path and leave pooled connections
 * to be reset by the server. Carrying `name` on the options makes all three agree.
 *
 * architecture.md §12 flagged this pairing as warranting a smoke test and recorded the check as
 * discharged on 18 Aug 2026 — but that verified *resolution*, that 11.0.3 accepts TypeORM 1.1 with
 * no peer warning. This is the same seam failing at runtime instead, found on 19 Aug 2026 by
 * task 11's first `app.close()`.
 */
export type NamedDataSourceOptions = DataSourceOptions & { name: string };

/**
 * Shared by both, and every line of it is a decision rather than a default.
 *
 * `synchronize: false` is AD-14 constraint 1 and is permanent. TypeORM's schema generation
 * cannot express RLS policies, FORCE ROW LEVEL SECURITY, the GRANT/REVOKE model, WITHOUT
 * OVERLAPS primary keys, uuidv7() defaults, statement-level triggers or expression indexes —
 * and the failure mode is worse than "unsupported": generated DDL reads those objects as
 * drift and tries to revert them.
 *
 * `migrations: []` and `migrationsRun: false` are the same decision seen from the runtime
 * side. These connect as esg_app / esg_worker, which own nothing and hold no DDL privilege
 * (§7.6), so a migration could not run here even if one were registered. Leaving the arrays
 * empty means `migrationsRun: true` is never one config flip away from an application
 * container attempting to mutate its own schema at boot.
 *
 * Not configured, deliberately: no `cache`. TypeORM's query-result cache is the single place
 * it reaches for ioredis, and pnpm-workspace.yaml's peer exception documents that this design
 * never enables it — AD-4 invalidates by version poll, AD-5's entitlement cache is in-process,
 * and Redis is never a system of record (AD-10).
 */
const base = (config: AppConfig) => ({
  // `as const` on this property alone, not on the whole literal. DataSourceOptions is a union
  // discriminated by `type`, so widening it to `string` loses the postgres branch — but
  // `as const` over the object would make `migrations: []` a `readonly []`, which the mutable
  // MixedList option rejects.
  type: 'postgres' as const,
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  username: config.database.user,
  password: config.database.password,
  synchronize: false,
  migrations: [],
  migrationsRun: false,
  dropSchema: false,
  entities: [],

  // §12.5, set with task 11. Every request holds a QueryRunner for its lifetime (AD-2's binding is
  // transaction-local), so this is what bounds concurrency until PgBouncer arrives — §16 defers it
  // on the grounds that ~150 peak concurrent sessions do not need a pooler. Four pools exist at
  // peak, core + billing on each of api and worker, so 40 of PostgreSQL's default max_connections
  // of 100, leaving room for the migration job, esg_admin_ro, monitoring and an operator's psql.
  poolSize: 10,
});

/**
 * `applicationName` shows up in pg_stat_activity and in PostgreSQL's own logs. It is worth the
 * line because AD-2's failure mode is a query that returns zero rows rather than one that
 * errors: when a tenant reports missing data, "which connection ran this, in which mode" is
 * the first question, and without this every backend is indistinguishably "node".
 */
export const coreDataSourceOptions = (config: AppConfig): NamedDataSourceOptions => ({
  ...base(config),
  name: CORE_DATA_SOURCE,
  schema: 'core',
  applicationName: `easyesg-${config.mode}-core`,
});

/**
 * Registered only when billing is enabled. With BILLING_ENABLED=false the compliance core must
 * still pass UC-17…48 end to end (DR-1, NFR-1), and the honest way to test that is for the
 * connection not to exist — not for it to exist and be unused.
 */
export const billingDataSourceOptions = (config: AppConfig): NamedDataSourceOptions => ({
  ...base(config),
  name: BILLING_DATA_SOURCE,
  schema: 'billing',
  applicationName: `easyesg-${config.mode}-billing`,
});
