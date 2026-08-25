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

/**
 * Two accounts, because task 25.1's membership policies are the first that can leak in two
 * directions. `ACCOUNT_BOTH` belongs to Alpha and Beta — the multi-membership FR-12 requires and
 * UC-16's picker exists for — and `ACCOUNT_BETA_ONLY` is the row it must never see while acting
 * for Alpha.
 */
const ACCOUNT_BOTH = '01920000-0000-7000-8000-0000000000c1';
const ACCOUNT_BETA_ONLY = '01920000-0000-7000-8000-0000000000c2';

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

/**
 * Sets the request context exactly as `setTenantContext` does — bind parameters, transaction-local,
 * and **both** settings, because `identity.membership` is the first table whose policies read the
 * second one.
 *
 * Named fields rather than two positional strings, for the reason the production signature gives:
 * swapped, `app.current_org` holds an account id, matches no policy, and every tenant read returns
 * zero rows — which reads downstream as "this customer has no data" rather than as an error.
 * Omitting a field binds the empty string, which is the unset context the `NULLIF` in every policy
 * collapses to NULL.
 */
interface Binding {
  readonly organizationId?: string | null;
  readonly accountId?: string | null;
}

const bind = async (runner: QueryRunner, binding: Binding) => {
  await runner.query('SELECT set_config($1, $2, true)', [
    'app.current_org',
    binding.organizationId ?? '',
  ]);
  await runner.query('SELECT set_config($1, $2, true)', [
    'app.current_user',
    binding.accountId ?? '',
  ]);
};

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
    await bind(runner, {});
    await runner.query(
      `INSERT INTO core.organization (id, name) VALUES ($1, 'Alpha SRL'), ($2, 'Beta SRL')`,
      [ORG_A, ORG_B],
    );
    // `identity.account` carries no RLS by design — an account exists before any organization does.
    await runner.query(
      `INSERT INTO identity.account (id, email, locale)
            VALUES ($1, 'ana@alpha.md', 'ro'), ($2, 'boris@beta.md', 'ro')`,
      [ACCOUNT_BOTH, ACCOUNT_BETA_ONLY],
    );
    // Memberships are seeded with each organization bound, because `membership_tenant_insert` is a
    // real WITH CHECK rather than the tenant root's permissive exception — so seeding them any
    // other way would be refused, which is itself half of what this suite asserts.
    await bind(runner, { organizationId: ORG_A });
    await runner.query(
      `INSERT INTO identity.membership (account_id, organization_id, role)
            VALUES ($1, $2, 'organization_administrator')`,
      [ACCOUNT_BOTH, ORG_A],
    );
    await bind(runner, { organizationId: ORG_B });
    await runner.query(
      `INSERT INTO identity.membership (account_id, organization_id, role)
            VALUES ($1, $3, 'viewer'), ($2, $3, 'editor')`,
      [ACCOUNT_BOTH, ACCOUNT_BETA_ONLY, ORG_B],
    );
  });

  afterEach(async () => {
    await runner.rollbackTransaction();
    await runner.release();
  });

  it('shows a tenant only its own row', async () => {
    await bind(runner, { organizationId: ORG_A });
    expect(await visibleIds(runner)).toEqual([ORG_A]);

    await bind(runner, { organizationId: ORG_B });
    expect(await visibleIds(runner)).toEqual([ORG_B]);
  });

  it('returns nothing for another tenant asked for by id', async () => {
    await bind(runner, { organizationId: ORG_A });
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
    await bind(runner, {});
    expect(await visibleIds(runner)).toEqual([]);
  });

  it('cannot update another tenant’s row', async () => {
    await bind(runner, { organizationId: ORG_A });
    const { rows, affected } = writeResult(
      await runner.query(`UPDATE core.organization SET name = 'seized' WHERE id = $1 RETURNING id`, [
        ORG_B,
      ]),
    );
    expect({ rows, affected }).toEqual({ rows: [], affected: 0 });

    // And the row is genuinely untouched, not merely invisible to the RETURNING clause.
    await bind(runner, { organizationId: ORG_B });
    const surviving = (await runner.query(`SELECT name FROM core.organization WHERE id = $1`, [
      ORG_B,
    ])) as { name: string }[];
    expect(surviving[0].name).toBe('Beta SRL');
  });

  it('cannot move its own row to another tenant (WITH CHECK)', async () => {
    await bind(runner, { organizationId: ORG_A });
    await expect(
      runner.query(`UPDATE core.organization SET id = $1 WHERE id = $2`, [ORG_B, ORG_A]),
    ).rejects.toThrow(/row-level security/i);
  });

  it('cannot delete another tenant’s row', async () => {
    await bind(runner, { organizationId: ORG_A });
    const { rows, affected } = writeResult(
      await runner.query(`DELETE FROM core.organization WHERE id = $1 RETURNING id`, [ORG_B]),
    );
    expect({ rows, affected }).toEqual({ rows: [], affected: 0 });
  });

  /**
   * `identity.membership` — the first tenant-scoped table outside `core`, and the first with two
   * SELECT policies (task 25.1, FR-12, FR-56 … FR-60).
   *
   * The second policy is what makes sign-in possible at all: AD-2 grounds `app.current_org` in the
   * membership lookup `AuthGuard` performs, so that lookup necessarily runs *before* any tenant is
   * bound. Scoping every policy to the bound organization would have returned zero rows for
   * everyone, forever, and presented as "this account belongs to no organization" rather than as a
   * failure. What the pair has to be is generous in exactly one direction and no other — an account
   * reads its own rows anywhere; everything else is the bound tenant's — and that asymmetry is what
   * the block below probes from both sides.
   */
  describe('membership', () => {
    const visibleMemberships = async (): Promise<{ account: string; org: string }[]> => {
      // Again no WHERE clause. The policies are the filter, which is the whole of NFR-63.
      const rows = (await runner.query(
        `SELECT account_id, organization_id FROM identity.membership
          ORDER BY organization_id, account_id`,
      )) as { account_id: string; organization_id: string }[];
      return rows.map((r) => ({ account: r.account_id, org: r.organization_id }));
    };

    it('shows a tenant only its own members', async () => {
      await bind(runner, { organizationId: ORG_A });
      expect(await visibleMemberships()).toEqual([{ account: ACCOUNT_BOTH, org: ORG_A }]);

      await bind(runner, { organizationId: ORG_B });
      expect(await visibleMemberships()).toEqual([
        { account: ACCOUNT_BOTH, org: ORG_B },
        { account: ACCOUNT_BETA_ONLY, org: ORG_B },
      ]);
    });

    // UC-16's picker, and the bootstrap `AuthGuard` depends on: an account can always see where it
    // belongs. Note what it still cannot see — Beta's *other* member — which is the line between
    // "my memberships" and "Beta's members".
    it('shows an account its own memberships elsewhere, and nobody else’s', async () => {
      await bind(runner, { organizationId: ORG_A, accountId: ACCOUNT_BOTH });
      expect(await visibleMemberships()).toEqual([
        { account: ACCOUNT_BOTH, org: ORG_A },
        { account: ACCOUNT_BOTH, org: ORG_B },
      ]);
    });

    // The same read with no organization bound at all — which is the state the guard is actually in
    // when it runs, and the one a single-policy table answers with silence.
    it('answers the pre-tenant lookup from the account alone', async () => {
      await bind(runner, { accountId: ACCOUNT_BETA_ONLY });
      expect(await visibleMemberships()).toEqual([{ account: ACCOUNT_BETA_ONLY, org: ORG_B }]);
    });

    it('sees nothing with neither organization nor account bound', async () => {
      await bind(runner, {});
      expect(await visibleMemberships()).toEqual([]);
    });

    it('cannot grant itself membership of another tenant (WITH CHECK)', async () => {
      await bind(runner, { organizationId: ORG_A, accountId: ACCOUNT_BOTH });
      await expect(
        runner.query(
          `INSERT INTO identity.membership (account_id, organization_id, role)
                VALUES ($1, $2, 'organization_administrator')`,
          [ACCOUNT_BETA_ONLY, ORG_B],
        ),
      ).rejects.toThrow(/row-level security/i);
    });

    it('cannot change another tenant’s member’s role', async () => {
      await bind(runner, { organizationId: ORG_A });
      const { affected } = writeResult(
        await runner.query(
          `UPDATE identity.membership SET role = 'organization_administrator'
            WHERE organization_id = $1 RETURNING id`,
          [ORG_B],
        ),
      );
      expect(affected).toBe(0);
    });

    /**
     * The asymmetry, asserted directly: `membership_self_select` grants **read** and nothing more.
     * Without this test the pair would look identical to one that let a viewer in Beta promote
     * themselves from a session scoped to Alpha — visible in the first probe, writable in neither.
     */
    it('cannot edit its own membership in an organization it is not acting for', async () => {
      await bind(runner, { organizationId: ORG_A, accountId: ACCOUNT_BOTH });

      const visible = (await runner.query(
        `SELECT role FROM identity.membership WHERE account_id = $1 AND organization_id = $2`,
        [ACCOUNT_BOTH, ORG_B],
      )) as { role: string }[];
      expect(visible).toEqual([{ role: 'viewer' }]);

      const { affected } = writeResult(
        await runner.query(
          `UPDATE identity.membership SET role = 'organization_administrator'
            WHERE account_id = $1 AND organization_id = $2 RETURNING id`,
          [ACCOUNT_BOTH, ORG_B],
        ),
      );
      expect(affected).toBe(0);
    });

    it('cannot move a membership to another tenant (WITH CHECK)', async () => {
      await bind(runner, { organizationId: ORG_A });
      await expect(
        runner.query(`UPDATE identity.membership SET organization_id = $1 WHERE organization_id = $2`, [
          ORG_B,
          ORG_A,
        ]),
      ).rejects.toThrow(/row-level security/i);
    });
  });
});

/**
 * FR-59 made structural rather than remembered (task 25.1).
 *
 * Removing a member is a `status` change, so that the membership's own history — when the role was
 * granted, by whom, when it was withdrawn — survives alongside the field-level attribution
 * `core.field_change` already keeps. That is a rule the application could simply forget in task
 * 25.2 or 26.2, which is why it is not the application's to keep: no runtime role holds `DELETE` on
 * the table, so the destructive path does not exist to be taken by mistake.
 *
 * The row still leaves on the cascade from its account (NFR-28's erasure) or its organization —
 * referential-integrity actions bypass row security by design, so those keep working.
 */
describe('a membership cannot be deleted by any runtime role (FR-59)', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = await connect(
      required('DB_MIGRATOR_USER'),
      required('DB_MIGRATOR_PASSWORD'),
      'easyesg-isolation-membership-privileges',
    );
  }, 30_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  it.each(['esg_app', 'esg_worker', 'esg_admin_ro'])('holds for %s', async (role) => {
    const [{ permitted }] = await dataSource.query<{ permitted: boolean }[]>(
      `SELECT has_table_privilege($1, 'identity.membership', 'DELETE') AS permitted`,
      [role],
    );
    expect(permitted).toBe(false);
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
      await bind(runner, {});
      await runner.query(
        `INSERT INTO core.organization (id, name) VALUES ($1, 'Alpha SRL'), ($2, 'Beta SRL')`,
        [ORG_A, ORG_B],
      );
      await bind(runner, { organizationId: ORG_A });
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
