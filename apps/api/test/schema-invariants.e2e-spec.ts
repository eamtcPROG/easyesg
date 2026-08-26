import { DataSource } from 'typeorm';
import { AesGcmSecretCipher } from '@api/infrastructure/adapters/secret-cipher/aes-gcm-secret.cipher';

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
      WHERE c.relkind IN ('r', 'p')
        AND NOT EXISTS (SELECT 1 FROM pg_inherits i WHERE i.inhrelid = c.oid)
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
      WHERE c.relkind IN ('r', 'p')
        AND NOT EXISTS (SELECT 1 FROM pg_inherits i WHERE i.inhrelid = c.oid)
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

/**
 * DR-5 and AD-2, made mechanical. Two clauses, because tenant scoping has two shapes: `core` is
 * tenant storage in its entirety, and the tenant root is scoped by its own `id` rather than by an
 * `organization_id` a single-clause rule would look for — so the one table whose policy failing is
 * worst is the one table that rule would miss. The second clause catches tenant tables outside
 * `core`, such as task 57's invoices.
 *
 * Deliberately NOT every table everywhere: `billing`'s plan catalogue and `config` are global data,
 * and a rule that fired on them would be switched off rather than satisfied.
 *
 * `ENABLED` and `FORCED` are asserted together. Forced is the half `esg_migrator`'s ownership makes
 * necessary and the half that is invisible when missing — without it the policies are inert for the
 * owner and every application-role probe still passes.
 *
 * **Both `r` and `p` relkinds, and partitions are checked individually** — corrected 20 Aug 2026,
 * when task 13 introduced the first partitioned table. A partitioned parent is relkind `p`, which
 * the original single-relkind rule did not see at all; and RLS does **not** propagate from a parent
 * to its partitions, so a partition reads `relrowsecurity = false` and any direct grant on it would
 * expose every tenant's rows. Verified against PostgreSQL 18 rather than assumed.
 */
const tablesMissingRowLevelSecurity = (x: Executor) =>
  x.query<{ location: string; enabled: boolean; forced: boolean }[]>(
    `SELECT n.nspname || '.' || c.relname AS location,
            c.relrowsecurity           AS enabled,
            c.relforcerowsecurity      AS forced
       FROM pg_class     c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind IN ('r', 'p')
        AND n.nspname = ANY($1)
        AND NOT (n.nspname || '.' || c.relname = ANY($2))
        AND (n.nspname = 'core'
             OR EXISTS (SELECT 1 FROM pg_attribute a
                         WHERE a.attrelid = c.oid
                           AND a.attname = 'organization_id'
                           AND NOT a.attisdropped))
        AND NOT (c.relrowsecurity AND c.relforcerowsecurity)
      ORDER BY 1`,
    [DOMAIN_SCHEMAS, RLS_EXEMPT_TABLES],
  );

/**
 * DR-6 and NFR-33, per table rather than per schema.
 *
 * The list is not schema-scoped, and that is the point: `core.field_change` sits in `core` because
 * §7.10 puts it there — it is tenant data, scoped by the same RLS as the rows it describes — but
 * FR-54/55 make it an audit trail, so protection follows what a table *is* rather than where it
 * lives.
 *
 * `audit` is **not** uniformly append-only, and assuming it is would be wrong in a way that only
 * shows up in task 15: §7.10 puts `outbox_event` and `inbound_event` in this schema, and AD-6's
 * dispatcher has to mark an outbox row dispatched — an UPDATE. So the schema keeps §7.7's
 * default-deny posture and each table declares itself, with the lists below forcing a decision
 * whenever a new audit table appears rather than letting it default to unprotected.
 */
const APPEND_ONLY_TABLES = ['audit.system_audit_log', 'core.field_change'];

/** Named, with the reason, so task 15 did not have to rediscover why these are exempt. */
const MUTABLE_AUDIT_TABLES = ['audit.outbox_event', 'audit.inbound_event'];

/**
 * Tables carrying `organization_id` that are deliberately **not** RLS-scoped, each with its reason.
 *
 * `audit.outbox_event` is cross-tenant by nature: the dispatcher must scan every tenant's pending
 * work to find any of it, and AD-2 rejects giving the worker `BYPASSRLS` in terms. Protection is
 * the grant instead — `esg_app` holds INSERT and nothing else, so there is no tenant read for a
 * policy to scope. `audit.inbound_event` will be the same when task 56 adds it: a provider webhook
 * arrives before anything knows which tenant it belongs to.
 *
 * This list is the exemption being a decision on record. Everything not on it still has to comply.
 */
const RLS_EXEMPT_TABLES = ['audit.outbox_event', 'audit.inbound_event'];

/**
 * An append-only table is protected only if **all** of it is: the parent carries both triggers, and
 * so does every partition. The row trigger PostgreSQL clones onto partitions by itself; the
 * statement-level TRUNCATE trigger it does not — verified — which means a partition added by a
 * later task is a hole unless `audit.enforce_append_only` is re-run over it. This is the check that
 * says so.
 */
const unprotectedAppendOnlyRelations = (x: Executor) =>
  x.query<{ location: string; missing: string }[]>(
    `WITH protected AS (
       SELECT c.oid, n.nspname || '.' || c.relname AS location, c.relkind
         FROM pg_class     c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname || '.' || c.relname = ANY($1)
        UNION ALL
       SELECT p.oid, np.nspname || '.' || p.relname, p.relkind
         FROM pg_inherits  i
         JOIN pg_class     p  ON p.oid = i.inhrelid
         JOIN pg_namespace np ON np.oid = p.relnamespace
         JOIN pg_class     pa ON pa.oid = i.inhparent
         JOIN pg_namespace na ON na.oid = pa.relnamespace
        WHERE na.nspname || '.' || pa.relname = ANY($1)
     )
     SELECT location,
            CASE WHEN NOT EXISTS (SELECT 1 FROM pg_trigger t
                                   WHERE t.tgrelid = protected.oid AND NOT t.tgisinternal
                                     AND t.tgname = 'no_truncate')
                 THEN 'no_truncate' ELSE 'row trigger' END AS missing
       FROM protected
      WHERE NOT EXISTS (SELECT 1 FROM pg_trigger t
                         WHERE t.tgrelid = protected.oid AND t.tgname = 'no_truncate')
         OR NOT EXISTS (SELECT 1 FROM pg_trigger t
                         WHERE t.tgrelid = protected.oid AND t.tgname = 'no_mutate')
      ORDER BY 1`,
    [APPEND_ONLY_TABLES],
  );

/** No application role may hold a privilege that could rewrite history (§7.7's real subject). */
const mutationGrantsOnAppendOnlyTables = (x: Executor) =>
  x.query<{ location: string; grantee: string; privilege: string }[]>(
    `SELECT n.nspname || '.' || c.relname AS location, g.grantee, g.privilege_type AS privilege
       FROM pg_class     c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
       JOIN LATERAL (SELECT pg_get_userbyid(a.grantee) AS grantee,
                            a.privilege_type          AS privilege_type) g ON true
      WHERE n.nspname || '.' || c.relname = ANY($1)
        AND g.grantee IN ('esg_app', 'esg_worker')
        AND g.privilege_type IN ('UPDATE', 'DELETE', 'TRUNCATE')
      ORDER BY 1, 2, 3`,
    [APPEND_ONLY_TABLES],
  );

/** A new audit table must be classified, not silently unprotected. */
const unclassifiedAuditTables = (x: Executor) =>
  x.query<{ location: string }[]>(
    `SELECT n.nspname || '.' || c.relname AS location
       FROM pg_class     c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'audit'
        AND c.relkind IN ('r', 'p')
        AND NOT EXISTS (SELECT 1 FROM pg_inherits i WHERE i.inhrelid = c.oid)
        AND NOT (n.nspname || '.' || c.relname = ANY($1))
        AND NOT (n.nspname || '.' || c.relname = ANY($2))
      ORDER BY 1`,
    [APPEND_ONLY_TABLES, MUTABLE_AUDIT_TABLES],
  );

/**
 * P-11 and FR-54, made mechanical. Per-field audit is named as expensive-to-retrofit and built on
 * day one regardless of which phase its feature lands in — so a `core` table added in task 29, 31
 * or 34 must either carry the capture trigger or say why it does not. Silence is the failure: an
 * unaudited table produces no error, just a trail with a gap nobody can see afterwards.
 */
const FIELD_AUDITED_TABLES = ['core.organization', 'identity.membership', 'identity.invitation'];

/**
 * Tenant-scoped tables that are deliberately **not** field-audited, each with its reason.
 *
 * `core.field_change` is the trail itself: auditing it would recurse, and it is append-only by
 * other means. The two `audit` tables are the same argument in a different schema — a system audit
 * row and an outbox row are already immutable records of something that happened (§7.7), so
 * capturing per-field changes to them would record the writing of a record.
 */
const UNAUDITED_TABLES = [
  'core.field_change',
  'audit.system_audit_log',
  'audit.outbox_event',
];

const auditedTablesMissingCapture = (x: Executor) =>
  x.query<{ location: string }[]>(
    `SELECT n.nspname || '.' || c.relname AS location
       FROM pg_class     c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname || '.' || c.relname = ANY($1)
        AND NOT EXISTS (SELECT 1 FROM pg_trigger t
                         WHERE t.tgrelid = c.oid AND NOT t.tgisinternal
                           AND t.tgname = 'capture_field_change')
      ORDER BY 1`,
    [FIELD_AUDITED_TABLES],
  );

/**
 * The classification sweep, scoped by **what a table is** rather than by which schema it sits in.
 *
 * It read `nspname = 'core'` until task 25.1, when `identity.membership` became the first
 * tenant-scoped table outside `core` and would have shipped unaudited without a word from any gate.
 * The two clauses are now the same pair `tablesMissingRowLevelSecurity` already uses, and for the
 * same reason: tenant data is what FR-54 is about, and `core` is where most but no longer all of it
 * lives. Task 26.1's `identity.invitation` was the next case, and it was caught by this sweep
 * rather than remembered — the classification list above names it.
 */
const unclassifiedTenantTables = (x: Executor) =>
  x.query<{ location: string }[]>(
    `SELECT n.nspname || '.' || c.relname AS location
       FROM pg_class     c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind IN ('r', 'p')
        AND n.nspname = ANY($3)
        AND NOT EXISTS (SELECT 1 FROM pg_inherits i WHERE i.inhrelid = c.oid)
        AND (n.nspname = 'core'
             OR EXISTS (SELECT 1 FROM pg_attribute a
                         WHERE a.attrelid = c.oid
                           AND a.attname = 'organization_id'
                           AND NOT a.attisdropped))
        AND NOT (n.nspname || '.' || c.relname = ANY($1))
        AND NOT (n.nspname || '.' || c.relname = ANY($2))
      ORDER BY 1`,
    [FIELD_AUDITED_TABLES, UNAUDITED_TABLES, DOMAIN_SCHEMAS],
  );

/**
 * NFR-61 made structural, and the reason this task (27.1) ran before 27.2 rather than after.
 *
 * `identity.encrypted_secret` is a domain over `text` whose constraint pins the sealed envelope
 * `v<n>.<base64url>`, so a column of that type CANNOT hold plaintext — not from the api, not from
 * the provisioning CLI, not from a `psql` prompt. The claim in task 27.1's deliverable is "a
 * plaintext secret is unrepresentable", and a type is the only thing that makes it literally true.
 */
const ENCRYPTED_SECRET_DOMAIN = 'identity.encrypted_secret';

/**
 * Columns holding a **recoverable** secret. Each must be of the domain above.
 *
 * `identity.totp_credential.secret` joined the list on 26 Aug 2026 **because this gate stopped the
 * build**, which is the whole reason it exists: task 27.2 created the tenant factor's table and the
 * sweep below refused it before any code read the column. The probe test named *"task 27.2 lands
 * here"* was written a day earlier against exactly this table and tripped on it.
 */
const ENCRYPTED_SECRET_COLUMNS = [
  'identity.admin_account.totp_secret',
  'identity.totp_credential.secret',
];

/**
 * Columns whose name says "secret" but which are deliberately stored as they are, each with its
 * reason. Both entries are **one-way hashes**, and that distinction is the whole of this rule:
 * encrypting an Argon2id digest would protect nothing an attacker holding the row could not
 * already do, while it would add a key whose loss destroys every password in the system.
 *
 * `token_hash` columns are not listed because the sweep below does not look for them — see its
 * own note on why the candidate patterns are `secret` and `password` and not `token` or `key`.
 */
const PLAINTEXT_BY_DESIGN_SECRET_COLUMNS = [
  'identity.credential.password_hash',
  'identity.admin_account.password_hash',
];

/** A column claimed as encrypted whose type is not the domain — the claim without the guarantee. */
const encryptedColumnsNotTyped = (x: Executor) =>
  x.query<{ location: string; type: string }[]>(
    `SELECT n.nspname || '.' || c.relname || '.' || a.attname AS location,
            format_type(a.atttypid, a.atttypmod) AS type
       FROM pg_attribute a
       JOIN pg_class     c ON c.oid = a.attrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE a.attnum > 0 AND NOT a.attisdropped
        AND n.nspname || '.' || c.relname || '.' || a.attname = ANY($1)
        AND format_type(a.atttypid, a.atttypmod) <> $2
      ORDER BY 1`,
    [ENCRYPTED_SECRET_COLUMNS, ENCRYPTED_SECRET_DOMAIN],
  );

/**
 * The classification sweep — the half that makes task 27.2 inherit this decision rather than
 * remember it. Same shape as `unclassifiedTenantTables` above and for the same reason: a new
 * secret column added by a later task must either be sealed or say why it is not, because silence
 * is indistinguishable from a considered exemption.
 *
 * **The candidate patterns are `secret` and `password`, deliberately not `token` or `_key`.** Those
 * two words name a secret unambiguously; the other two do not — `idempotency_key`, `attempt_key`
 * and every `token_hash` would be swept in, each needing a classification row that says "not a
 * secret", and a rule producing more noise than signal is one that gets switched off rather than
 * satisfied (the same judgement `tablesMissingRowLevelSecurity` makes about `config` and the plan
 * catalogue). A future secret named neither is caught by review, not by this query, and that
 * limit is stated here rather than left to be discovered.
 */
const unclassifiedSecretColumns = (x: Executor) =>
  x.query<{ location: string }[]>(
    `SELECT n.nspname || '.' || c.relname || '.' || a.attname AS location
       FROM pg_attribute a
       JOIN pg_class     c ON c.oid = a.attrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind IN ('r', 'p')
        AND NOT EXISTS (SELECT 1 FROM pg_inherits i WHERE i.inhrelid = c.oid)
        AND a.attnum > 0 AND NOT a.attisdropped
        AND n.nspname = ANY($3)
        AND (a.attname LIKE '%secret%' OR a.attname LIKE '%password%')
        AND NOT (n.nspname || '.' || c.relname || '.' || a.attname = ANY($1))
        AND NOT (n.nspname || '.' || c.relname || '.' || a.attname = ANY($2))
      ORDER BY 1`,
    [ENCRYPTED_SECRET_COLUMNS, PLAINTEXT_BY_DESIGN_SECRET_COLUMNS, DOMAIN_SCHEMAS],
  );

/**
 * What makes the RLS exemption above safe, asserted rather than assumed.
 *
 * `audit.outbox_event` has no policy because the application tier cannot read it — that is the
 * whole argument. Granting `SELECT` to `esg_app` would turn a considered exemption into an
 * unscoped cross-tenant read, and nothing else in the system would notice: no test fails, no error
 * is raised, every row is simply visible to every tenant that asks.
 */
const readableRlsExemptTables = (x: Executor) =>
  x.query<{ location: string; grantee: string }[]>(
    `SELECT n.nspname || '.' || c.relname AS location, pg_get_userbyid(a.grantee) AS grantee
       FROM pg_class     c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
      WHERE n.nspname || '.' || c.relname = ANY($1)
        AND pg_get_userbyid(a.grantee) = 'esg_app'
        AND a.privilege_type = 'SELECT'
      ORDER BY 1`,
    [RLS_EXEMPT_TABLES],
  );

describe('schema invariants (§7)', () => {
  let db: DataSource;

  beforeAll(async () => {
    // Without this the symptom is `SASL: client password must be a string`, which sends the reader
    // to pg_hba.conf instead of to their environment.
    // `SECRET_ENCRYPTION_KEY` joins the list because the encryption-at-rest invariant seals a
    // probe value with the real adapter — asserting the domain accepts what the application
    // actually writes, rather than a literal hand-shaped to match the constraint.
    for (const key of ['DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'SECRET_ENCRYPTION_KEY']) {
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

  describe('every tenant-scoped table has RLS enabled and forced (DR-5, AD-2)', () => {
    it('holds', async () => {
      expect(await tablesMissingRowLevelSecurity(db)).toEqual([]);
    });

    it('catches a new core table that forgot its policies — task 29 and task 31 land here', async () => {
      const caught = await provingViolation(
        `CREATE TABLE core.__probe_entity (id uuid PRIMARY KEY, organization_id uuid NOT NULL)`,
        tablesMissingRowLevelSecurity,
      );
      expect(caught.map((r) => r.location)).toEqual(['core.__probe_entity']);
    });

    it('catches a tenant table outside core — task 57 lands here', async () => {
      const caught = await provingViolation(
        `CREATE TABLE billing.__probe_invoice (id uuid PRIMARY KEY, organization_id uuid NOT NULL)`,
        tablesMissingRowLevelSecurity,
      );
      expect(caught.map((r) => r.location)).toEqual(['billing.__probe_invoice']);
    });

    // ENABLE without FORCE is the shape that looks protected and is not: policies are inert for the
    // owner, and every probe run as the application role still passes (§7.6).
    it('catches ENABLE without FORCE, which no application-role probe can see', async () => {
      const caught = await provingViolation(
        `CREATE TABLE core.__probe_half (id uuid PRIMARY KEY);
         ALTER TABLE core.__probe_half ENABLE ROW LEVEL SECURITY`,
        tablesMissingRowLevelSecurity,
      );
      expect(caught).toEqual([{ location: 'core.__probe_half', enabled: true, forced: false }]);
    });

    it('accepts the fully protected form, so the rule is satisfiable', async () => {
      const caught = await provingViolation(
        `CREATE TABLE core.__probe_ok (id uuid PRIMARY KEY);
         ALTER TABLE core.__probe_ok ENABLE ROW LEVEL SECURITY;
         ALTER TABLE core.__probe_ok FORCE ROW LEVEL SECURITY`,
        tablesMissingRowLevelSecurity,
      );
      expect(caught).toEqual([]);
    });
  });

  describe('append-only tables are protected end to end (DR-6, NFR-33)', () => {
    it('holds — parent and every partition carry both triggers', async () => {
      expect(await unprotectedAppendOnlyRelations(db)).toEqual([]);
    });

    it('holds — no application role can UPDATE, DELETE or TRUNCATE them', async () => {
      expect(await mutationGrantsOnAppendOnlyTables(db)).toEqual([]);
    });

    // The hole partitioning reopens. §7.7 calls TRUNCATE "the fastest way to lose a ledger" and
    // answers it with a statement trigger — which PostgreSQL does not clone onto partitions.
    it('catches a partition added without its TRUNCATE trigger', async () => {
      const caught = await provingViolation(
        `CREATE TABLE audit.system_audit_log_2099 PARTITION OF audit.system_audit_log
           FOR VALUES FROM ('2099-01-01 00:00:00+00') TO ('2100-01-01 00:00:00+00')`,
        unprotectedAppendOnlyRelations,
      );
      expect(caught.map((r) => r.location)).toEqual(['audit.system_audit_log_2099']);
    });

    it('catches a grant that would let the application rewrite history', async () => {
      const caught = await provingViolation(
        `GRANT UPDATE ON audit.system_audit_log TO esg_app`,
        mutationGrantsOnAppendOnlyTables,
      );
      expect(caught).toEqual([
        { location: 'audit.system_audit_log', grantee: 'esg_app', privilege: 'UPDATE' },
      ]);
    });

    it('catches a new audit table that declared itself neither append-only nor mutable', async () => {
      const caught = await provingViolation(
        `CREATE TABLE audit.__probe_unclassified (id uuid PRIMARY KEY)`,
        unclassifiedAuditTables,
      );
      expect(caught.map((r) => r.location)).toEqual(['audit.__probe_unclassified']);
    });

    it('holds — every audit table today is classified', async () => {
      expect(await unclassifiedAuditTables(db)).toEqual([]);
    });
  });

  describe('per-field audit capture is attached where it is claimed (P-11, FR-54)', () => {
    it('holds — every audited table carries the capture trigger', async () => {
      expect(await auditedTablesMissingCapture(db)).toEqual([]);
    });

    it('holds — every tenant table is classified as audited or explicitly not', async () => {
      expect(await unclassifiedTenantTables(db)).toEqual([]);
    });

    it('catches an audited table whose trigger was dropped', async () => {
      const caught = await provingViolation(
        `DROP TRIGGER capture_field_change ON core.organization`,
        auditedTablesMissingCapture,
      );
      expect(caught.map((r) => r.location)).toEqual(['core.organization']);
    });

    // The membership table is task 25.1's, and it is the reason the rule below is no longer
    // scoped to `core`: a role change has to be attributable from its first write (FR-55), and
    // FR-59's removal is a status change whose whole evidential value is that it was recorded.
    it('catches the membership table losing its capture trigger', async () => {
      const caught = await provingViolation(
        `DROP TRIGGER capture_field_change ON identity.membership`,
        auditedTablesMissingCapture,
      );
      expect(caught.map((r) => r.location)).toEqual(['identity.membership']);
    });

    // Tasks 29, 31 and 34 all add core tables. This is what stops one of them shipping unaudited.
    it('catches a new core table that declared neither', async () => {
      const caught = await provingViolation(
        `CREATE TABLE core.__probe_entity (id uuid PRIMARY KEY, organization_id uuid NOT NULL)`,
        unclassifiedTenantTables,
      );
      expect(caught.map((r) => r.location)).toEqual(['core.__probe_entity']);
    });

    // The clause added with task 25.1. Before it, a tenant table outside `core` — this shape, and
    // task 26.1's `identity.invitation` — could ship unaudited and no gate would say a word.
    it('catches a tenant table outside core that declared neither', async () => {
      const caught = await provingViolation(
        `CREATE TABLE identity.__probe_invitation (id uuid PRIMARY KEY, organization_id uuid NOT NULL)`,
        unclassifiedTenantTables,
      );
      expect(caught.map((r) => r.location)).toEqual(['identity.__probe_invitation']);
    });

    // Satisfiable, not merely strict: a table with no tenant column is nobody's audit obligation,
    // which is what keeps the rule off `identity.account` and every `config` table.
    it('ignores a table that carries no tenant column at all', async () => {
      const caught = await provingViolation(
        `CREATE TABLE identity.__probe_untenanted (id uuid PRIMARY KEY)`,
        unclassifiedTenantTables,
      );
      expect(caught).toEqual([]);
    });
  });

  describe('a recoverable secret is unrepresentable in plaintext (NFR-61, task 27.1)', () => {
    it('holds — every column claimed as encrypted carries the domain type', async () => {
      expect(await encryptedColumnsNotTyped(db)).toEqual([]);
    });

    it('holds — every secret-named column is classified as encrypted or explicitly not', async () => {
      expect(await unclassifiedSecretColumns(db)).toEqual([]);
    });

    // The claim itself, asserted against the database rather than against the adapter: the
    // constraint must reject the base32 a TOTP secret is spelled in. This is the one test that
    // would have failed on 21 Aug 2026, when `totp_secret` shipped as plain `text`.
    it('refuses plaintext at the store, whatever wrote it', async () => {
      const runner = db.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      try {
        await expect(
          runner.query(
            `INSERT INTO identity.admin_account (email, role, password_hash, totp_secret)
             VALUES ('probe-plaintext@example.test', 'platform_administrator', 'x',
                     'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')`,
          ),
        ).rejects.toThrow(/encrypted_secret_is_sealed/u);
      } finally {
        await runner.rollbackTransaction();
        await runner.release();
      }
    });

    // Satisfiable, not merely strict — the pair that stops the rule above from passing by
    // rejecting everything, and it seals with the REAL adapter rather than with a literal
    // hand-shaped to match the constraint, so the two copies of the envelope pattern (the
    // adapter's `ENVELOPE` and the domain's `CHECK`) are checked against each other here.
    //
    // It runs as the migration owner, and deliberately does not `SET ROLE esg_app` to prove the
    // application role can write it: §7.6 makes `esg_migrator` no member of `esg_app`, so the
    // attempt fails with `permission denied to set role` — which is the role separation working.
    // That half is proven where the application role actually connects: `admin-session.e2e-spec`
    // seeds through `esg_app` with a sealed value, and the browser suite through the CLI.
    it('accepts what the application actually writes', async () => {
      const sealed = new AesGcmSecretCipher(process.env.SECRET_ENCRYPTION_KEY).seal(
        'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
      );
      const runner = db.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      try {
        await runner.query(
          `INSERT INTO identity.admin_account (email, role, password_hash, totp_secret)
           VALUES ('probe-sealed@example.test', 'platform_administrator', 'x', $1)`,
          [sealed],
        );
        // `QueryRunner.query` has a `useStructuredResult` overload, so a type ARGUMENT selects
        // the wrong signature (TS2558) and the assertion is the only spelling — apps/api/CLAUDE.md
        // records this alongside its `EntityManager.query` twin, which is the opposite.
        const stored = (await runner.query(
          `SELECT totp_secret FROM identity.admin_account
            WHERE email = 'probe-sealed@example.test'`,
        )) as { totp_secret: string }[];
        expect(stored).toEqual([{ totp_secret: sealed }]);
      } finally {
        await runner.rollbackTransaction();
        await runner.release();
      }
    });

    // Task 27.2 landed here on 26 Aug 2026 and this is what stopped it: `identity.totp_credential
    // .secret` was created as `identity.encrypted_secret` but unclassified, and the sweep refused
    // the build until the list above named it. The probe keeps the rule honest now that the real
    // case is classified — an unclassified column must still be caught.
    it('catches a new secret column added as plain text — task 27.2 landed here', async () => {
      const caught = await provingViolation(
        `CREATE TABLE identity.__probe_totp (account_id uuid PRIMARY KEY, totp_secret text NOT NULL)`,
        unclassifiedSecretColumns,
      );
      expect(caught).toEqual([{ location: 'identity.__probe_totp.totp_secret' }]);
    });

    it('catches a classified column whose type was widened back to text', async () => {
      const caught = await provingViolation(
        `ALTER TABLE identity.admin_account ALTER COLUMN totp_secret TYPE text`,
        encryptedColumnsNotTyped,
      );
      expect(caught).toEqual([
        { location: 'identity.admin_account.totp_secret', type: 'text' },
      ]);
    });
  });

  describe('an RLS-exempt table is unreadable by the application tier', () => {
    it('holds', async () => {
      expect(await readableRlsExemptTables(db)).toEqual([]);
    });

    it('catches the grant that would turn the exemption into a cross-tenant read', async () => {
      const caught = await provingViolation(
        `GRANT SELECT ON audit.outbox_event TO esg_app`,
        readableRlsExemptTables,
      );
      expect(caught).toEqual([{ location: 'audit.outbox_event', grantee: 'esg_app' }]);
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
        WHERE c.relkind IN ('r', 'p') AND n.nspname = ANY($1)`,
      [DOMAIN_SCHEMAS],
    );
    expect(Number(count)).toBeGreaterThan(0);
  });
});
