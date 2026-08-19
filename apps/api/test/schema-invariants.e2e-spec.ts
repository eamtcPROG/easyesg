import { DataSource } from 'typeorm';

/**
 * The structural invariants of §7, asserted against a real migrated database.
 *
 * This is the schema half of what `boundaries:prove` does for imports, and it borrows that
 * script's central lesson: **a rule that matches nothing looks exactly like a rule that passes.**
 * Every invariant here therefore comes in a pair — one test that it holds, and one that creates a
 * genuine violation and asserts the same query catches it. The violation is made inside a
 * transaction that is always rolled back, so the proof costs no cleanup and cannot leak.
 *
 * It runs as `esg_migrator` and reads **`pg_catalog`, never `information_schema`**. That is not a
 * style preference: `information_schema` views filter their rows by the querying role's
 * privileges, so a table the connecting role cannot touch is simply absent — an invariant check
 * that silently sees fewer tables than exist is worse than none, because it passes.
 *
 * It builds its own `DataSource` rather than importing `migration.data-source.ts`, which
 * constructs its singleton at import time and throws on missing credentials — before any env could
 * be loaded here. `pg` is not used directly: it ships no type declarations and `@types/pg` is not
 * installed, so a bare `Client` would type every row `any` and quietly turn a strict assertion into
 * one that cannot fail.
 */

// The connection settings arrive already in the environment: `db:invariants` launches jest through
// `node --env-file-if-exists=.env`. Loading the file from inside the spec does NOT work, and that
// is why this comment exists — jest's node environment hands the test a *copy* of `process`, so
// `process.loadEnvFile()` mutates a sandbox and the real credentials never appear. The symptom is
// a SASL error about a non-string password, which reads as a database problem rather than an env
// one. Like the flag, this never overrides an already-set variable, so Compose and CI beat a stale
// local file rather than the other way round.

/** §7.1's five. `migration` is infrastructure and `public` holds only extensions. */
const DOMAIN_SCHEMAS = ['identity', 'core', 'billing', 'config', 'audit'];

/**
 * The one method both `DataSource` and `QueryRunner` offer, declared structurally rather than as
 * `Pick<QueryRunner, 'query'>` — `QueryRunner.query` is overloaded with a `useStructuredResult`
 * form whose third parameter conflicts with `DataSource.query`'s, so the Pick matches neither
 * cleanly. Method syntax, so parameters stay bivariant and both concrete types satisfy it.
 */
interface Executor {
  query<T>(sql: string, parameters?: unknown[]): Promise<T>;
}

/**
 * DR-1 and NFR-15, made structural. §7.1 permits exactly one cross-schema foreign key —
 * `identity.* → core.organization`, the membership target — and no other. `billing` referencing an
 * organization by unenforced ID is the physical expression of NFR-15: an FK there would make
 * NFR-1's "disable billing entirely" test impossible to run, because the schema would not load.
 */
const crossSchemaForeignKeys = (x: Executor) =>
  x.query<{ violation: string }[]>(
    `SELECT src.nspname || '.' || srcc.relname || ' -> ' ||
            tgt.nspname || '.' || tgtc.relname || ' (' || con.conname || ')' AS violation
       FROM pg_constraint con
       JOIN pg_class     srcc ON srcc.oid = con.conrelid
       JOIN pg_namespace src  ON src.oid  = srcc.relnamespace
       JOIN pg_class     tgtc ON tgtc.oid = con.confrelid
       JOIN pg_namespace tgt  ON tgt.oid  = tgtc.relnamespace
      WHERE con.contype = 'f'
        AND src.nspname = ANY($1)
        AND src.nspname <> tgt.nspname
        AND NOT (src.nspname = 'identity' AND tgt.nspname = 'core' AND tgtc.relname = 'organization')
      ORDER BY 1`,
    [DOMAIN_SCHEMAS],
  );

/** Columns of the five domain schemas whose rendered SQL type is one of `types`. */
const columnsOfType = (x: Executor, types: string[]) =>
  x.query<{ location: string; type: string }[]>(
    `SELECT n.nspname || '.' || c.relname || '.' || a.attname AS location,
            format_type(a.atttypid, a.atttypmod) AS type
       FROM pg_attribute a
       JOIN pg_class     c ON c.oid = a.attrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'r'
        AND a.attnum > 0 AND NOT a.attisdropped
        AND n.nspname = ANY($1)
        AND format_type(a.atttypid, a.atttypmod) = ANY($2)
      ORDER BY 1`,
    [DOMAIN_SCHEMAS, types],
  );

/**
 * NFR-34's other half, which is a pairing rather than a type. A legal date must carry the timezone
 * that determined it, because an instant cannot settle which fiscal year a document falls in — and
 * FR-125 makes that error uncorrectable by editing, only by credit note. The convention is
 * `<field>` and `<field>_tz` (§7.9), so the check is mechanical. It first bites in task 31
 * (reporting period start/end/due) and task 57 (invoice and credit-note dates).
 */
const unpairedLegalDates = (x: Executor) =>
  x.query<{ location: string }[]>(
    `SELECT n.nspname || '.' || c.relname || '.' || a.attname AS location
       FROM pg_attribute a
       JOIN pg_class     c ON c.oid = a.attrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'r'
        AND a.attnum > 0 AND NOT a.attisdropped
        AND n.nspname = ANY($1)
        AND format_type(a.atttypid, a.atttypmod) = 'date'
        AND NOT EXISTS (
          SELECT 1 FROM pg_attribute tz
           WHERE tz.attrelid = a.attrelid
             AND tz.attname  = a.attname || '_tz'
             AND NOT tz.attisdropped)
      ORDER BY 1`,
    [DOMAIN_SCHEMAS],
  );

describe('schema invariants (§7)', () => {
  let db: DataSource;

  beforeAll(async () => {
    // Without this the symptom is `SASL: client password must be a string`, which sends the reader
    // to pg_hba.conf instead of to their environment.
    for (const key of ['DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD']) {
      if (!process.env[key]) {
        throw new Error(
          `${key} is not set. This check connects as the migration owner (§7.6); ` +
            'copy apps/api/.env.example to apps/api/.env, and run it via `pnpm db:invariants`.',
        );
      }
    }

    db = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number.parseInt(process.env.DB_PORT ?? '5432', 10),
      database: process.env.DB_NAME ?? 'esg',
      username: process.env.DB_MIGRATOR_USER,
      password: process.env.DB_MIGRATOR_PASSWORD,
      synchronize: false,
      entities: [],
      applicationName: 'easyesg-schema-invariants',
    });
    await db.initialize();
  }, 30_000);

  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
  });

  /**
   * Creates a deliberately non-conforming object, runs the probe against the *same* connection —
   * a pooled one would not see uncommitted DDL — and rolls back unconditionally. PostgreSQL makes
   * DDL transactional, which is what lets a proof mutate the schema and leave no trace.
   */
  const provingViolation = async <T>(ddl: string, probe: (x: Executor) => Promise<T[]>) => {
    const runner = db.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query(ddl);
      return await probe(runner);
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  };

  describe('no cross-schema foreign key except identity → core.organization (DR-1, NFR-15)', () => {
    it('holds', async () => {
      expect((await crossSchemaForeignKeys(db)).map((r) => r.violation)).toEqual([]);
    });

    it('catches a billing → core foreign key, which is the one T-2 warns about', async () => {
      const caught = await provingViolation(
        `CREATE TABLE billing.__probe (organization_id uuid REFERENCES core.organization(id))`,
        crossSchemaForeignKeys,
      );
      expect(caught).toHaveLength(1);
      expect(caught[0].violation).toContain('billing.__probe -> core.organization');
    });
  });

  describe('no floating-point column anywhere (NFR-58)', () => {
    // Both kinds of number this system holds are prohibited from being float: disclosure
    // quantities are `numeric`, rounded once at presentation (NFR-18); money is integer minor
    // units, rounded at issuance and stored, because an invoice must foot to the bani or
    // e-Factura rejects a document that D-10 says cannot then be corrected by editing.
    const FLOATS = ['real', 'double precision'];

    it('holds', async () => {
      expect((await columnsOfType(db, FLOATS)).map((r) => `${r.location}: ${r.type}`)).toEqual([]);
    });

    it('catches a double precision column', async () => {
      const caught = await provingViolation(
        `CREATE TABLE core.__probe_float (quantity double precision)`,
        (x) => columnsOfType(x, FLOATS),
      );
      expect(caught.map((r) => r.location)).toEqual(['core.__probe_float.quantity']);
    });
  });

  describe('every instant is timestamptz, never a naive timestamp (§7.8, OQ-50)', () => {
    const NAIVE = ['timestamp without time zone'];

    it('holds', async () => {
      expect((await columnsOfType(db, NAIVE)).map((r) => r.location)).toEqual([]);
    });

    // The failure this catches is quiet: `timestamp` looks all but identical to `timestamptz` in a
    // migration diff and in most client output, and it discards the offset — so the value is wrong
    // only for readers in another zone, which is every reader of a system hosted in the EU and
    // used from Chisinau.
    it('catches a `timestamp` that should have been `timestamptz`', async () => {
      const caught = await provingViolation(
        `CREATE TABLE core.__probe_ts (created_at timestamp)`,
        (x) => columnsOfType(x, NAIVE),
      );
      expect(caught.map((r) => r.location)).toEqual(['core.__probe_ts.created_at']);
    });
  });

  describe('every `date` column carries its originating timezone (NFR-34)', () => {
    it('holds', async () => {
      expect((await unpairedLegalDates(db)).map((r) => r.location)).toEqual([]);
    });

    it('catches a legal date with no `_tz` sibling', async () => {
      const caught = await provingViolation(
        `CREATE TABLE core.__probe_date (period_end date)`,
        unpairedLegalDates,
      );
      expect(caught.map((r) => r.location)).toEqual(['core.__probe_date.period_end']);
    });

    it('accepts the paired form, so the rule is satisfiable and not merely strict', async () => {
      const caught = await provingViolation(
        `CREATE TABLE core.__probe_paired (period_end date, period_end_tz text)`,
        unpairedLegalDates,
      );
      expect(caught).toEqual([]);
    });
  });

  /**
   * Proves the checks above are looking at a migrated database rather than an empty one. Without
   * it, a connection to the wrong database satisfies every "holds" assertion by finding nothing at
   * all — the exact false green that makes a silent gate worse than no gate.
   */
  it('is looking at a migrated database', async () => {
    const [{ count }] = await db.query<{ count: string }[]>(
      `SELECT count(*)::text AS count FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'r' AND n.nspname = ANY($1)`,
      [DOMAIN_SCHEMAS],
    );
    expect(Number(count)).toBeGreaterThan(0);
  });
});
