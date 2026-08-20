import { DataSource, QueryRunner } from 'typeorm';

/**
 * AD-2's cross-tenant probe suite, at the database boundary (DR-5, NFR-63).
 *
 * NFR-63's whole point is that isolation be **structural rather than filtered at call sites**, so
 * this deliberately does not go through the API. It opens a connection, sets the tenant the way a
 * request would, and issues bare SQL with no `WHERE organization_id` — the query a careless
 * repository method would write. If the policies are right, that query cannot see another tenant's
 * rows no matter who wrote it.
 *
 * **It runs as two roles, and the second one is the point.** `esg_app` is the runtime role. But a
 * table's owner is exempt from its own policies regardless of `rolbypassrls`, and `esg_migrator`
 * owns every table here — so if the migration had said `ENABLE ROW LEVEL SECURITY` without
 * `FORCE`, every assertion below would still pass as `esg_app` and the owner would quietly see
 * everything. A probe that only ever connects as the application role cannot tell those two worlds
 * apart, which is the failure §7.6 records and AD-2 calls worse than having no probe at all.
 *
 * Everything happens inside a transaction that is always rolled back, so the suite seeds and
 * asserts against real rows without leaving any.
 */

const ORG_A = '01920000-0000-7000-8000-00000000000a';
const ORG_B = '01920000-0000-7000-8000-00000000000b';

const required = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `${key} is not set. Copy apps/api/.env.example to apps/api/.env and run via ` +
        '`pnpm test:e2e` with the Compose stack up.',
    );
  }
  return value;
};

const connect = async (user: string, password: string, applicationName: string) => {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number.parseInt(process.env.DB_PORT ?? '5432', 10),
    database: process.env.DB_NAME ?? 'esg',
    username: user,
    password,
    synchronize: false,
    entities: [],
    applicationName,
  });
  await dataSource.initialize();
  return dataSource;
};

/**
 * TypeORM's postgres driver returns `[rows, affectedCount]` for an UPDATE or DELETE — not the bare
 * row array a SELECT gives back. The count is the stronger assertion of the two: an empty
 * RETURNING clause only proves nothing came back, while `affected = 0` proves nothing was written.
 */
const writeResult = (result: unknown): { rows: unknown[]; affected: number } => {
  const [rows, affected] = result as [unknown[], number];
  return { rows, affected };
};

/** Sets the tenant exactly as `setTenantContext` does — bind parameter, transaction-local. */
const bind = (runner: QueryRunner, organizationId: string | null) =>
  runner.query('SELECT set_config($1, $2, true)', ['app.current_org', organizationId ?? '']);

const visibleIds = async (runner: QueryRunner): Promise<string[]> => {
  // No WHERE clause anywhere. That absence is the assertion.
  const rows = (await runner.query(
    `SELECT id FROM core.organization WHERE id IN ($1, $2) ORDER BY id`,
    [ORG_A, ORG_B],
  )) as { id: string }[];
  return rows.map((r) => r.id);
};

describe.each([
  ['esg_app — the runtime role', 'DB_USER', 'DB_PASSWORD', 'easyesg-isolation-app'],
  ['esg_migrator — the table owner, which only FORCE subjects to policy', 'DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-isolation-owner'],
])('tenant isolation as %s (AD-2, NFR-63)', (_label, userKey, passwordKey, applicationName) => {
  let dataSource: DataSource;
  let runner: QueryRunner;

  beforeAll(async () => {
    dataSource = await connect(required(userKey), required(passwordKey), applicationName);
  }, 30_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  beforeEach(async () => {
    runner = dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    // Seeded through the permissive INSERT policy the tenant root carries for FR-13. Creating a
    // row you then own is not a cross-tenant act; reading or altering someone else's is.
    await bind(runner, null);
    await runner.query(
      `INSERT INTO core.organization (id, name) VALUES ($1, 'Alpha SRL'), ($2, 'Beta SRL')`,
      [ORG_A, ORG_B],
    );
  });

  afterEach(async () => {
    await runner.rollbackTransaction();
    await runner.release();
  });

  it('shows a tenant only its own row', async () => {
    await bind(runner, ORG_A);
    expect(await visibleIds(runner)).toEqual([ORG_A]);

    await bind(runner, ORG_B);
    expect(await visibleIds(runner)).toEqual([ORG_B]);
  });

  it('returns nothing for another tenant asked for by id', async () => {
    await bind(runner, ORG_A);
    const rows = (await runner.query(`SELECT id FROM core.organization WHERE id = $1`, [
      ORG_B,
    ])) as unknown[];
    expect(rows).toEqual([]);
  });

  /**
   * The fail-closed default. An unset context yields NULL and therefore zero rows rather than a
   * 500 on every endpoint (AD-2) — and the empty string, which is what a context set from a blank
   * value produces, must behave identically. Without the `NULLIF` in the policy the cast raises
   * `invalid input syntax for type uuid` and every query fails instead of returning nothing.
   */
  it('sees nothing with no tenant bound, and does not raise', async () => {
    await bind(runner, null);
    expect(await visibleIds(runner)).toEqual([]);
  });

  it('cannot update another tenant’s row', async () => {
    await bind(runner, ORG_A);
    const { rows, affected } = writeResult(
      await runner.query(`UPDATE core.organization SET name = 'seized' WHERE id = $1 RETURNING id`, [
        ORG_B,
      ]),
    );
    expect({ rows, affected }).toEqual({ rows: [], affected: 0 });

    // And the row is genuinely untouched, not merely invisible to the RETURNING clause.
    await bind(runner, ORG_B);
    const surviving = (await runner.query(`SELECT name FROM core.organization WHERE id = $1`, [
      ORG_B,
    ])) as { name: string }[];
    expect(surviving[0].name).toBe('Beta SRL');
  });

  it('cannot move its own row to another tenant (WITH CHECK)', async () => {
    await bind(runner, ORG_A);
    await expect(
      runner.query(`UPDATE core.organization SET id = $1 WHERE id = $2`, [ORG_B, ORG_A]),
    ).rejects.toThrow(/row-level security/i);
  });

  it('cannot delete another tenant’s row', async () => {
    await bind(runner, ORG_A);
    const { rows, affected } = writeResult(
      await runner.query(`DELETE FROM core.organization WHERE id = $1 RETURNING id`, [ORG_B]),
    );
    expect({ rows, affected }).toEqual({ rows: [], affected: 0 });
  });
});

/**
 * Proves that `FORCE` is the clause doing the work, not `ENABLE` alone.
 *
 * Without this, the owner suite above passes and nobody can say why. The whole trap §7.6 records
 * is that a table's owner is exempt from its own policies regardless of `rolbypassrls`, so a
 * migration saying only `ENABLE ROW LEVEL SECURITY` produces a database that looks protected,
 * passes every application-role probe, and leaks completely to the role that runs migrations and
 * to anyone holding its credentials.
 *
 * The proof drops `FORCE` inside a transaction and shows isolation collapsing, then rolls back.
 * Only the owner may run the `ALTER`, which is why this is separate from the two-role suite.
 */
describe('FORCE ROW LEVEL SECURITY is what subjects the owner (§7.6)', () => {
  let dataSource: DataSource;
  let runner: QueryRunner;

  beforeAll(async () => {
    dataSource = await connect(
      required('DB_MIGRATOR_USER'),
      required('DB_MIGRATOR_PASSWORD'),
      'easyesg-isolation-force-probe',
    );
  }, 30_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  it('collapses to full visibility the moment FORCE is dropped', async () => {
    runner = dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await bind(runner, null);
      await runner.query(
        `INSERT INTO core.organization (id, name) VALUES ($1, 'Alpha SRL'), ($2, 'Beta SRL')`,
        [ORG_A, ORG_B],
      );
      await bind(runner, ORG_A);
      expect(await visibleIds(runner)).toEqual([ORG_A]);

      await runner.query(`ALTER TABLE core.organization NO FORCE ROW LEVEL SECURITY`);

      // Same connection, same bound tenant, same query — and now the owner sees both tenants.
      // This is precisely what would have shipped had the migration said ENABLE and stopped.
      expect(await visibleIds(runner)).toEqual([ORG_A, ORG_B]);
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  });

  it('leaves FORCE in place afterwards, so the proof cannot damage the schema', async () => {
    // A type argument, not a cast: `DataSource.query` is generic, unlike `QueryRunner.query`
    // whose `useStructuredResult` overload makes one select the wrong signature.
    const rows = await dataSource.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean }[]>(
      `SELECT relrowsecurity, relforcerowsecurity FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'core' AND c.relname = 'organization'`,
    );
    expect(rows[0]).toEqual({ relrowsecurity: true, relforcerowsecurity: true });
  });
});
