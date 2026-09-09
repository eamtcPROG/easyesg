import { DataSource } from 'typeorm';

/**
 * A connection as one of §7.6's roles, for e2e suites that need to see or seed what a request
 * cannot reach through the API.
 *
 * Extracted with task 28.1, when a third suite needed the same twelve lines. Which role matters and
 * is never incidental: `esg_worker` is the only one that may SELECT `audit.outbox_event` — `esg_app`
 * holds INSERT and nothing else, which is what makes the outbox unreadable from the tier that
 * writes it — and `esg_migrator` is the only one that can create a schema object or watch a policy
 * collapse when `FORCE` is dropped.
 */
export const required = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `${key} is not set. Copy apps/api/.env.example to apps/api/.env and run via ` +
        '`pnpm test:e2e` with the Compose stack up.',
    );
  }
  return value;
};

export const connectAs = async (
  userKey: string,
  passwordKey: string,
  applicationName: string,
): Promise<DataSource> => {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number.parseInt(process.env.DB_PORT ?? '5432', 10),
    database: process.env.DB_NAME ?? 'esg',
    username: required(userKey),
    password: required(passwordKey),
    synchronize: false,
    entities: [],
    applicationName,
  });
  await dataSource.initialize();
  return dataSource;
};

/**
 * Runs work in one transaction with a tenant bound, committing on success.
 *
 * Seeding and cleaning tenant rows both need this and neither is obvious: `set_config(..., true)` is
 * transaction-local, so without a transaction the binding does not survive to the next statement —
 * and a `DELETE` with no organization bound matches the RLS policy zero times and **removes nothing
 * without failing**, which presents two tests later as a duplicate key.
 */
export const asOrganization = async <T>(
  dataSource: DataSource,
  organizationId: string | null,
  work: (run: (sql: string, parameters?: unknown[]) => Promise<unknown>) => Promise<T>,
): Promise<T> => {
  const runner = dataSource.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  try {
    await runner.query('SELECT set_config($1, $2, true)', ['app.current_org', organizationId ?? '']);
    const result = await work((sql, parameters) => runner.query(sql, parameters));
    await runner.commitTransaction();
    return result;
  } catch (error) {
    if (runner.isTransactionActive) await runner.rollbackTransaction();
    throw error;
  } finally {
    await runner.release();
  }
};

/**
 * The **database's** clock, for a lower bound on a column the database wrote.
 *
 * **A `new Date()` bound is a cross-clock comparison and it is not sound** (9 Sep 2026, diagnosed
 * from an intermittent failure in `members.e2e-spec.ts`). Every audit and outbox column in this
 * schema defaults to `now()`, which is PostgreSQL's **transaction start time** on the *container's*
 * clock; a test process bounding it with `Date.now()` reads the *host's*. Those are two clocks, and
 * on this stack they disagree — measured at **7–8 ms, with the container behind**, which is
 * ordinary for a Docker VM and not a misconfiguration.
 *
 * So `occurred_at >= new Date()` can exclude a row written *after* that line ran, whenever the
 * request completes faster than the skew. That is why the failure was intermittent and why it
 * favoured the **full** run: a warm process answers a `DELETE` in a millisecond or two, well inside
 * the 8 ms window, where the same suite run alone is cold enough to take longer and pass.
 *
 * Taking the bound from the same clock the column is written on removes the comparison entirely.
 * `now()` is this statement's own transaction start, so it is strictly before any transaction the
 * test opens afterwards — which is exactly what a lower bound needs to mean.
 */
export const databaseNow = async (connection: DataSource): Promise<Date> => {
  const rows: { at: Date }[] = await connection.query('SELECT now() AS at');
  return rows[0].at;
};
