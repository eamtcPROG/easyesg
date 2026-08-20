import { DataSource, QueryRunner } from 'typeorm';

/**
 * NFR-33 and DR-6: audit records are append-only, enforced **at database privilege level**, with
 * the stated verification that attempted mutation fails at the store and not in application code.
 *
 * There are three layers here and they deny in a definite order, which is worth knowing because
 * only one of them is visible in any given test:
 *
 *  1. **Privilege** — `esg_app` and `esg_worker` hold `INSERT, SELECT` and nothing else, so an
 *     UPDATE never reaches a policy or a trigger. This is the layer that protects against the
 *     application, which is the one that matters day to day.
 *  2. **RLS** — the table has no UPDATE or DELETE policy, so even the owning role matches zero
 *     rows. `UPDATE 0` rather than an error, which is why the trigger below looks untested until
 *     you go looking.
 *  3. **The triggers** — the last line, and the only one that fires if somebody grants UPDATE and
 *     adds a permissive policy. That is not hypothetical: §7.7 names "an ORM bootstrap script
 *     having issued GRANT ALL" as the realistic failure. The final tests here lift layers 1 and 2
 *     inside a rolled-back transaction to prove the trigger is live rather than merely present.
 *
 * TRUNCATE is the exception to that ordering: no policy can restrict it, so the statement-level
 * trigger is the only defence against a role that holds the privilege — §7.7's "fastest way to
 * lose a ledger".
 */

const ORGANIZATION = '01920000-0000-7000-8000-00000000000a';
const PARENT = 'audit.system_audit_log';
const PARTITION = 'audit.system_audit_log_2026';

const required = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not set. Run via \`pnpm test:e2e\` with the stack up.`);
  return value;
};

const connect = async (userKey: string, passwordKey: string, applicationName: string) => {
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

const bind = (runner: QueryRunner, organizationId: string) =>
  runner.query('SELECT set_config($1, $2, true)', ['app.current_org', organizationId]);

const insertOne = (runner: QueryRunner) =>
  runner.query(
    `INSERT INTO ${PARENT} (organization_id, occurred_at, action)
     VALUES ($1, '2026-06-01 00:00:00+00', 'report.created')`,
    [ORGANIZATION],
  );

describe('append-only audit substrate (DR-6, NFR-33)', () => {
  let app: DataSource;
  let owner: DataSource;

  beforeAll(async () => {
    app = await connect('DB_USER', 'DB_PASSWORD', 'easyesg-append-only-app');
    owner = await connect('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-append-only-owner');
  }, 30_000);

  afterAll(async () => {
    if (app?.isInitialized) await app.destroy();
    if (owner?.isInitialized) await owner.destroy();
  });

  /** Every case runs in a transaction that is always rolled back, so nothing is left behind. */
  const inTransaction = async (
    dataSource: DataSource,
    fn: (runner: QueryRunner) => Promise<void>,
  ) => {
    const runner = dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await fn(runner);
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  };

  describe('layer 1 — privilege, which is what protects against the application', () => {
    it('lets the application append, which is the whole point of the substrate', async () => {
      await inTransaction(app, async (runner) => {
        await bind(runner, ORGANIZATION);
        await insertOne(runner);
        const rows = (await runner.query(`SELECT action FROM ${PARENT}`)) as { action: string }[];
        expect(rows.map((r) => r.action)).toEqual(['report.created']);
      });
    });

    it.each([
      ['UPDATE', `UPDATE ${PARENT} SET action = 'rewritten'`],
      ['DELETE', `DELETE FROM ${PARENT}`],
      ['TRUNCATE', `TRUNCATE ${PARENT}`],
      // Partitioning reopens what §7.7 closed: neither the TRUNCATE trigger nor RLS propagates to
      // a partition, so a direct grant on one would be a way round both. The application is
      // granted on the parent only, which is why these are refused.
      ['TRUNCATE of a partition', `TRUNCATE ${PARTITION}`],
      ['SELECT of a partition', `SELECT count(*) FROM ${PARTITION}`],
    ])('refuses %s outright', async (_label, sql) => {
      await inTransaction(app, async (runner) => {
        await bind(runner, ORGANIZATION);
        await expect(runner.query(sql)).rejects.toThrow(/permission denied/i);
      });
    });
  });

  describe('layer 3 — the triggers, which are all that stands between the owner and history', () => {
    // The owner holds every privilege on its own tables, so layer 1 does not apply to it. TRUNCATE
    // cannot be restricted by a policy either, which leaves the statement trigger alone.
    it.each([
      ['the parent', `TRUNCATE ${PARENT}`],
      ['a partition directly', `TRUNCATE ${PARTITION}`],
    ])('stops the owning role truncating %s', async (_label, sql) => {
      await inTransaction(owner, async (runner) => {
        await expect(runner.query(sql)).rejects.toThrow(/append-only/i);
      });
    });

    /**
     * Proves the row trigger is live rather than merely present.
     *
     * Without lifting the policy layer this cannot be observed at all: with no UPDATE policy the
     * owner matches zero rows and PostgreSQL reports `UPDATE 0`, which is indistinguishable from a
     * trigger that was never created. Adding a permissive policy inside a rolled-back transaction
     * reproduces exactly the state §7.7 warns about — a grant that should not exist — and shows
     * the trigger refusing anyway.
     */
    it.each([
      ['UPDATE', 'FOR UPDATE USING (true) WITH CHECK (true)', `UPDATE ${PARENT} SET action = 'x'`],
      ['DELETE', 'FOR DELETE USING (true)', `DELETE FROM ${PARENT}`],
    ])('stops %s even when a permissive policy would allow it', async (label, policy, sql) => {
      await inTransaction(owner, async (runner) => {
        await bind(runner, ORGANIZATION);
        await insertOne(runner);
        await runner.query(`CREATE POLICY probe_${label.toLowerCase()} ON ${PARENT} ${policy}`);
        await expect(runner.query(sql)).rejects.toThrow(/append-only/i);
      });
    });
  });

  describe('the partitioning plan §15 requires', () => {
    // §12.5.7 gives system audit 24-month retention while DELETE is denied, so pruning can only be
    // DETACH + DROP — which triggers do not block, by design. This is the mechanism that makes the
    // retention policy executable at all; without it, expiring a row would mean disabling the very
    // guard the substrate exists for.
    it('allows a partition to be detached and dropped, which is how retention runs', async () => {
      await inTransaction(owner, async (runner) => {
        await runner.query(`ALTER TABLE ${PARENT} DETACH PARTITION ${PARTITION}`);
        await runner.query(`DROP TABLE ${PARTITION}`);
        const rows = (await runner.query(
          `SELECT count(*)::text AS count FROM pg_inherits WHERE inhparent = $1::regclass`,
          [PARENT],
        )) as { count: string }[];
        // 2027, 2028 and the default remain.
        expect(rows[0].count).toBe('3');
      });
    });

    it('keeps a default partition, so an audit write can never fail for want of one', async () => {
      const rows = (await owner.query<{ count: string }[]>(
        `SELECT count(*)::text AS count FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'audit' AND c.relname = 'system_audit_log_default'`,
      )) as { count: string }[];
      expect(rows[0].count).toBe('1');
    });
  });
});
