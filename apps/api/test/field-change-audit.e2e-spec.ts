import { DataSource, QueryRunner } from 'typeorm';

/**
 * Per-field audit capture (FR-54, FR-55, FR-159, P-11).
 *
 * FR-54 exists to support a future limited-assurance review (NFR-7), and an assurance reviewer
 * needs a trail with no unknown gaps. Two properties carry that, and both are database-side
 * because neither survives being a convention:
 *
 *  - **It cannot be skipped.** An `AFTER` trigger fires for every write, including one issued by a
 *    query nobody reviewed. A function the caller must remember to call would not.
 *  - **It cannot be forged.** The capture function is `SECURITY DEFINER`, so `esg_app` holds
 *    `SELECT` on `core.field_change` and no `INSERT` — the application can read its trail and has
 *    no privilege by which to author one.
 *
 * `core.organization` is the only audited table today; task 34's disclosure store attaches to the
 * same function with no new plpgsql, because the comparison is over `jsonb` row images rather than
 * named columns.
 */

const ORG_A = '01920000-0000-7000-8000-00000000000a';
const ORG_B = '01920000-0000-7000-8000-00000000000b';
const ACTOR = '01920000-0000-7000-8000-0000000000a1';

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

interface Change {
  operation: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  actor_id: string | null;
}

describe('per-field audit capture (FR-54, FR-55, P-11)', () => {
  let app: DataSource;
  let owner: DataSource;

  beforeAll(async () => {
    app = await connect('DB_USER', 'DB_PASSWORD', 'easyesg-field-audit-app');
    owner = await connect('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-field-audit-owner');
  }, 30_000);

  afterAll(async () => {
    if (app?.isInitialized) await app.destroy();
    if (owner?.isInitialized) await owner.destroy();
  });

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

  const bind = async (runner: QueryRunner, organizationId: string | null, actorId: string | null) => {
    await runner.query('SELECT set_config($1, $2, true)', ['app.current_org', organizationId ?? '']);
    await runner.query('SELECT set_config($1, $2, true)', ['app.current_user', actorId ?? '']);
  };

  const changes = async (runner: QueryRunner): Promise<Change[]> =>
    (await runner.query(
      `SELECT operation, field_name, old_value, new_value, actor_id::text
         FROM core.field_change ORDER BY occurred_at, field_name`,
    )) as Change[];

  describe('capture', () => {
    it('records every field of a created row, and attributes it', async () => {
      await inTransaction(app, async (runner) => {
        await bind(runner, ORG_A, ACTOR);
        await runner.query(`INSERT INTO core.organization (id, name, country_code) VALUES ($1, 'Alpha SRL', 'MD')`, [
          ORG_A,
        ]);

        const rows = await changes(runner);
        // `updated_at` is excluded by trigger argument: it changes on every write and recording it
        // would double the volume of the highest-volume table in the system to say nothing.
        //
        // **Everything else is here, including the columns that are NULL** — this test's name is
        // the rule. A created row's complete initial state is what an INSERT records, which is task
        // 14's decision and not something a later task should reverse in passing.
        //
        // **This list has now grown three times in three tasks**, and the growth is the point worth
        // noting rather than the list. Task 29.1 took it from three entries to eleven, 29.2 to
        // thirteen, 30.3 to fifteen — and an organization founded through S-04 supplies four of
        // them, so eleven of the fifteen rows record that a field was left empty. The cost is one audit row per column per insert,
        // paid by every future column on every audited table. Task 34 is where it stops being
        // academic: `core.report_disclosure_value` carries four mutually exclusive value columns,
        // so every disclosure written would record three empty fields on the highest-volume table
        // in the system. That task should weigh it with the volumes in hand.
        expect(rows.map((r) => r.field_name)).toEqual([
          'contact_email',
          'contact_phone',
          'country_code',
          'created_at',
          'id',
          'idno',
          'legal_form',
          'lei',
          'name',
          'registered_address_line1',
          'registered_address_line2',
          'registered_locality',
          'registered_postal_code',
          'report_contact_email',
          'report_contact_name',
        ]);
        expect(rows.every((r) => r.operation === 'INSERT')).toBe(true);
        expect(rows.every((r) => r.old_value === null)).toBe(true);
        expect(rows.every((r) => r.actor_id === ACTOR)).toBe(true);
      });
    });

    it('records only what changed, with the previous value FR-54 requires', async () => {
      await inTransaction(app, async (runner) => {
        await bind(runner, ORG_A, ACTOR);
        await runner.query(`INSERT INTO core.organization (id, name, country_code) VALUES ($1, 'Alpha SRL', 'MD')`, [
          ORG_A,
        ]);
        await runner.query(`DELETE FROM core.organization WHERE FALSE`); // no-op, no rows captured
        await runner.query(`UPDATE core.organization SET name = 'Alpha Group SRL' WHERE id = $1`, [
          ORG_A,
        ]);

        const updates = (await changes(runner)).filter((r) => r.operation === 'UPDATE');
        expect(updates).toHaveLength(1);
        expect(updates[0]).toMatchObject({
          field_name: 'name',
          old_value: 'Alpha SRL',
          new_value: 'Alpha Group SRL',
        });
      });
    });

    it('captures a write nobody routed through an application function', async () => {
      // The whole reason capture is a trigger rather than the callable helper AD-14 first
      // described: this is a bare UPDATE of the kind task 34 or 36 might write, and it is audited
      // anyway.
      await inTransaction(app, async (runner) => {
        await bind(runner, ORG_A, ACTOR);
        await runner.query(`INSERT INTO core.organization (id, name, country_code) VALUES ($1, 'Alpha', 'MD')`, [ORG_A]);
        await runner.query(`UPDATE core.organization SET name = name || ' SRL'`);
        const updates = (await changes(runner)).filter((r) => r.operation === 'UPDATE');
        expect(updates.map((r) => r.new_value)).toEqual(['Alpha SRL']);
      });
    });
  });

  describe('the trail cannot be authored, altered or erased by the application', () => {
    it.each([
      [
        'forged',
        `INSERT INTO core.field_change
           (organization_id, table_name, record_id, field_name, operation)
         VALUES ('${ORG_A}', 'core.organization', '${ORG_A}', 'name', 'UPDATE')`,
      ],
      ['rewritten', `UPDATE core.field_change SET new_value = 'tampered'`],
      ['erased', `DELETE FROM core.field_change`],
      ['truncated', `TRUNCATE core.field_change`],
    ])('cannot be %s', async (_label, sql) => {
      await inTransaction(app, async (runner) => {
        await bind(runner, ORG_A, ACTOR);
        await expect(runner.query(sql)).rejects.toThrow(/permission denied/i);
      });
    });

    it('is readable by the tenant it belongs to, and by no other', async () => {
      await inTransaction(app, async (runner) => {
        await bind(runner, ORG_A, ACTOR);
        await runner.query(`INSERT INTO core.organization (id, name, country_code) VALUES ($1, 'Alpha SRL', 'MD')`, [
          ORG_A,
        ]);
        expect(await changes(runner)).not.toHaveLength(0);

        await bind(runner, ORG_B, ACTOR);
        expect(await changes(runner)).toEqual([]);
      });
    });

    /**
     * FR-55: historical attribution must survive removal of a member's access, so the audit row
     * cannot depend on the account row continuing to exist. A foreign key on `actor_id` would make
     * FR-59's member removal either fail or cascade — both of which erase the trail.
     */
    it('holds no foreign key on actor_id, so removing a member cannot erase history', async () => {
      const rows = await owner.query<{ count: string }[]>(
        `SELECT count(*)::text AS count
           FROM pg_constraint con
           JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY (con.conkey)
          WHERE con.conrelid = 'core.field_change'::regclass
            AND con.contype = 'f' AND a.attname = 'actor_id'`,
      );
      expect(rows[0].count).toBe('0');
    });
  });

  describe('platform-level events (FR-80, FR-159)', () => {
    // Task 13 made organization_id NOT NULL and left this open; task 14 relaxes it, because an
    // administrator account change belongs to no organization.
    it('accepts an unattributed event when no tenant is bound', async () => {
      await inTransaction(app, async (runner) => {
        await bind(runner, null, ACTOR);
        await runner.query(
          `INSERT INTO audit.system_audit_log (organization_id, action) VALUES (NULL, $1)`,
          ['platform.administrator.deactivated'],
        );
      });
    });

    // A tenant request must not be able to write platform-level history. Without the second
    // condition in the policy, a bare `organization_id IS NULL` check would let it, since
    // permissive policies are OR'd.
    it('refuses one from a request that is acting for a tenant', async () => {
      await inTransaction(app, async (runner) => {
        await bind(runner, ORG_A, ACTOR);
        await expect(
          runner.query(`INSERT INTO audit.system_audit_log (organization_id, action) VALUES (NULL, $1)`, [
            'platform.forged',
          ]),
        ).rejects.toThrow(/row-level security/i);
      });
    });

    it('hides platform events from every tenant, without a policy written for it', async () => {
      await inTransaction(app, async (runner) => {
        await bind(runner, null, ACTOR);
        await runner.query(
          `INSERT INTO audit.system_audit_log (organization_id, action) VALUES (NULL, 'platform.x')`,
        );
        await bind(runner, ORG_A, ACTOR);
        const rows = (await runner.query(`SELECT count(*)::text AS c FROM audit.system_audit_log`)) as {
          c: string;
        }[];
        // `organization_id = <bound>` never matches NULL, so this costs nothing to arrange.
        expect(rows[0].c).toBe('0');
      });
    });
  });
});
