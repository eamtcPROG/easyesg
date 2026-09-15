import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Client } from 'pg';

/**
 * Database access for the browser e2e, mirroring the api e2e's arrangement exactly:
 *
 * - the verification token is read from `audit.outbox_event` **as `esg_worker`** — the only
 *   role permitted to SELECT there (`esg_app` holds INSERT and no SELECT, which is what stands
 *   in for RLS on that table). The raw token exists nowhere else: the token table stores its
 *   SHA-256 (OQ-54).
 * - cleanup runs as the migration owner, because `esg_app` may not DELETE and that is the
 *   point of the grant split.
 *
 * Credentials default to the Compose stack's committed synthetic values, same as
 * `playwright.config.ts`.
 */
const connection = (user: string, password: string) => ({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number.parseInt(process.env.DB_PORT ?? '5432', 10),
  database: process.env.DB_NAME ?? 'esg',
  user,
  password,
});

const asWorker = () =>
  connection(
    process.env.DB_WORKER_USER ?? 'esg_worker',
    process.env.DB_WORKER_PASSWORD ?? 'devonly-worker',
  );

const asOwner = () =>
  connection(
    process.env.DB_MIGRATOR_USER ?? 'esg_migrator',
    process.env.DB_MIGRATOR_PASSWORD ?? 'devonly-migrator',
  );

/** The wire values are pinned on purpose — a renamed event type must break this suite. */
const EMAIL_VERIFICATION_REQUESTED = 'identity.email_verification.requested';
const PASSWORD_RESET_REQUESTED = 'identity.password_reset.requested';

/** Polls the outbox for the raw token a committed request left for `email` — the same
 *  arrangement for both single-use links: the row IS where the token exists (OQ-54). */
async function outboxTokenFor(
  eventType: string,
  email: string,
  timeoutMs: number,
): Promise<string> {
  const client = new Client(asWorker());
  await client.connect();
  try {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const result = await client.query<{ payload: { token?: string } }>(
        `SELECT payload FROM audit.outbox_event
          WHERE event_type = $1 AND payload->>'email' = $2
          ORDER BY occurred_at DESC LIMIT 1`,
        [eventType, email],
      );
      const token = result.rows[0]?.payload.token;
      if (token) return token;
      if (Date.now() > deadline) {
        throw new Error(`No ${eventType} outbox event for ${email} within ${timeoutMs}ms`);
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  } finally {
    await client.end();
  }
}

/** Polls the outbox for the verification token registration committed for `email`. */
export const verificationTokenFor = (email: string, timeoutMs = 15_000): Promise<string> =>
  outboxTokenFor(EMAIL_VERIFICATION_REQUESTED, email, timeoutMs);

/** Polls the outbox for the reset token a reset request committed for `email` (task 21). */
export const passwordResetTokenFor = (email: string, timeoutMs = 15_000): Promise<string> =>
  outboxTokenFor(PASSWORD_RESET_REQUESTED, email, timeoutMs);

/** Removes the accounts and outbox rows a run created (addresses share a unique prefix). */
export async function cleanupAccounts(prefix: string): Promise<void> {
  const client = new Client(asOwner());
  await client.connect();
  try {
    await client.query(`DELETE FROM identity.account WHERE email LIKE $1`, [`${prefix}%`]);
    await client.query(`DELETE FROM audit.outbox_event WHERE payload->>'email' LIKE $1`, [
      `${prefix}%`,
    ]);
  } finally {
    await client.end();
  }
}

/**
 * Gives the account at `email` a membership in a fresh organization, and returns the organization's
 * id — §4.3's branch needs one to distinguish "none" from "one", and no route creates either yet
 * (task 29 founds an organization, task 26.2 accepts an invitation).
 *
 * **Bound per organization, in a transaction, and both halves matter.** `set_config(..., true)` is
 * transaction-local, so without a transaction the binding does not reach the next statement; and
 * `identity.membership`'s INSERT policy is a real `WITH CHECK`, so an unbound insert is refused
 * rather than mis-scoped. The organization row itself goes in unbound, through the permissive
 * INSERT policy the tenant root carries for FR-13.
 *
 * **One named object, not three positional arguments** (CLAUDE.md, "Conventions"). It took two
 * `string`s and gained a third when S-16 needed a non-administrator; swapped, the address becomes
 * the organization's name and the membership matches no account, so the helper commits an
 * organization nobody belongs to and reports success. Named fields make that unrepresentable.
 */
export async function grantMembership(input: {
  readonly email: string;
  readonly organizationName: string;
  /**
   * Defaults to Organization Administrator, which is what every caller before task 26.4 wanted.
   * S-16 needs the other two as well: its permission state is what an editor or a viewer sees, and
   * seeding one is the only way to reach it — no route demotes the account you are signed in as.
   */
  readonly role?: 'editor' | 'viewer' | 'organization_administrator';
}): Promise<string> {
  const { email, organizationName, role = 'organization_administrator' } = input;
  const client = new Client(asOwner());
  await client.connect();
  try {
    // The id is generated here rather than taken from `RETURNING`, and that is not a preference.
    // `INSERT ... RETURNING` makes PostgreSQL apply the SELECT policies to the new row — and with
    // no tenant and no account bound, none of them match, so the insert fails with "new row
    // violates row-level security policy" while the WITH CHECK it names is `true`. Measured.
    const organizationId = randomUUID();
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_org', '', true)`);
    await client.query(
      `INSERT INTO core.organization (id, name, country_code) VALUES ($1, $2, 'MD')`,
      [organizationId, organizationName],
    );
    await client.query(`SELECT set_config('app.current_org', $1, true)`, [organizationId]);
    await client.query(
      `INSERT INTO identity.membership (account_id, organization_id, role)
       SELECT a.id, $2, $3 FROM identity.account a
        WHERE lower(a.email) = lower($1)`,
      [email, organizationId, role],
    );
    await client.query('COMMIT');
    return organizationId;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

/**
 * Withdraws an account's membership in one organization the way S-16's removal does (FR-59) — the row
 * stays and stops granting — so a choice left stale by a removal can be met (task 83.3). Bound to the
 * organization, because `identity.membership`'s `UPDATE` policy is the organization's alone.
 */
export async function removeMembership(input: {
  readonly email: string;
  readonly organizationId: string;
}): Promise<void> {
  const client = new Client(asOwner());
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_org', $1, true)`, [input.organizationId]);
    const removed = await client.query(
      `UPDATE identity.membership m SET status = 'removed', removed_at = now()
         FROM identity.account a
        WHERE m.account_id = a.id AND lower(a.email) = lower($1) AND m.organization_id = $2
          AND m.status = 'active'`,
      [input.email, input.organizationId],
    );
    // A removal that matched nothing is a fixture that did not do what the test believes it did.
    if (removed.rowCount !== 1) throw new Error(`removeMembership matched ${removed.rowCount} rows`);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

/**
 * Fills `count` seats in an organization with bare accounts holding active memberships (task 142), so
 * S-16's seat region can be reached at and near its ceiling without registering a person per seat.
 *
 * The addresses start with `prefix`, so `cleanupAccounts` with the run's prefix removes them — and the
 * memberships with them, by the cascade from the account. Accounts are unbound (the table carries no
 * RLS); the memberships are inserted with the organization bound, for `grantMembership`'s reason.
 * **Call it once per prefix**: a second call would try to give the same accounts a second membership.
 */
export async function seedSeatHolders(input: {
  readonly organizationId: string;
  readonly prefix: string;
  readonly count: number;
}): Promise<void> {
  const client = new Client(asOwner());
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO identity.account (email, locale)
       SELECT $1 || '-seat-' || n || '@example.md', 'ro' FROM generate_series(1, $2::int) AS n`,
      [input.prefix, input.count],
    );
    await client.query(`SELECT set_config('app.current_org', $1, true)`, [input.organizationId]);
    await client.query(
      `INSERT INTO identity.membership (account_id, organization_id, role)
       SELECT a.id, $1, 'editor' FROM identity.account a WHERE a.email LIKE $2`,
      [input.organizationId, `${input.prefix}-seat-%@example.md`],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

/**
 * Removes organizations this run created, by id, cascading their memberships.
 *
 * **It takes ids rather than finding them, and the first draft did not.** A
 * `SELECT ... WHERE name LIKE` here returns nothing: `core.organization` is readable only as the
 * bound tenant or, since task 25.3, to a bound account through the directory policy — and a
 * cleanup routine is neither. It would have deleted nothing and reported success. So the caller
 * keeps what it created, and each row is deleted with itself bound.
 *
 * There is no membership delete and there cannot be: no role holds `DELETE` on that table
 * (task 25.1), so the cascade from the organization is the only way those rows leave.
 */
/**
 * Issues an invitation directly, and returns the raw token the email would have carried.
 *
 * **Seeded rather than driven through `POST /invitations`**, because S-16 does not exist yet
 * (task 26.4) — this suite is S-03's, and its subject is what happens to the person who *receives*
 * an invitation. The api's own suite drives the issuing routes end to end.
 *
 * Bound per organization in a transaction, for `grantMembership`'s two reasons: `set_config(...,
 * true)` is transaction-local, and `invitation_tenant_insert` is a real `WITH CHECK` that refuses
 * an unbound insert rather than mis-scoping it. The token is generated here and stored as its
 * SHA-256, exactly as the api does — the table never holds a usable value (OQ-54, NFR-64).
 */
export async function issueInvitation(input: {
  organizationId: string;
  email: string;
  role?: 'editor' | 'viewer';
  /** Set in the past to seed S-03's expired state without waiting seven days. */
  expiresAt?: Date;
}): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const client = new Client(asOwner());
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true)', [
      'app.current_org',
      input.organizationId,
    ]);
    await client.query(
      `INSERT INTO identity.invitation
         (organization_id, invited_email, role, locale, token_hash, expires_at)
       VALUES ($1, $2, $3, 'ro', $4, $5)`,
      [
        input.organizationId,
        input.email,
        input.role ?? 'editor',
        createHash('sha256').update(token, 'utf8').digest(),
        input.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ],
    );
    await client.query('COMMIT');
    return token;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

/**
 * Withdraws every outstanding invitation for an address — S-03's revoked state.
 *
 * An UPDATE and not a DELETE, and not by choice: `identity.invitation` has no `DELETE` policy at
 * all, so under `FORCE ROW LEVEL SECURITY` even the owner matches zero rows and the statement
 * reports success while removing nothing (task 26.1's suite records the same finding).
 */
export async function revokeInvitations(organizationId: string, email: string): Promise<void> {
  const client = new Client(asOwner());
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true)', ['app.current_org', organizationId]);
    await client.query(
      `UPDATE identity.invitation SET status='revoked', revoked_at=now(), updated_at=now()
        WHERE invited_email = $1 AND status = 'pending'`,
      [email],
    );
    await client.query('COMMIT');
  } finally {
    await client.end();
  }
}

/**
 * The organizations an account is a member of, by id — for cleaning up what a *journey* created
 * rather than what the suite seeded (task 30.2, S-04).
 *
 * **It binds `app.current_user` and reads `identity.membership`, and neither half is incidental.**
 * `cleanupOrganizations`'s own docblock records that a `SELECT ... WHERE name LIKE` on
 * `core.organization` returns nothing here: the table is readable as the bound tenant, or to a
 * bound account through task 25.3's directory policy, and a cleanup routine holding neither is not
 * an exception — `FORCE ROW LEVEL SECURITY` applies to the owner too. So this asks the question the
 * product asks before any tenant exists, through the policy that answers it
 * (`membership_self_select`), and gets ids the caller can then delete one at a time with each
 * bound.
 *
 * No organization is bound while it runs, which is required rather than tidy: the directory policy
 * is conditioned on exactly that state.
 */
export async function organizationIdsForAccount(email: string): Promise<string[]> {
  const client = new Client(asOwner());
  await client.connect();
  try {
    await client.query('BEGIN');
    const account = await client.query<{ id: string }>(
      `SELECT id FROM identity.account WHERE lower(email) = lower($1)`,
      [email],
    );
    if (account.rows.length === 0) {
      await client.query('ROLLBACK');
      return [];
    }
    await client.query(`SELECT set_config('app.current_user', $1, true)`, [account.rows[0].id]);
    const rows = await client.query<{ organization_id: string }>(
      `SELECT organization_id FROM identity.membership WHERE status = 'active'`,
    );
    await client.query('COMMIT');
    return rows.rows.map((row) => row.organization_id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

export async function cleanupOrganizations(organizationIds: readonly string[]): Promise<void> {
  if (organizationIds.length === 0) return;
  const client = new Client(asOwner());
  await client.connect();
  try {
    for (const organizationId of organizationIds) {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.current_org', $1, true)`, [organizationId]);
      await client.query(`DELETE FROM core.organization WHERE id = $1`, [organizationId]);
      await client.query('COMMIT');
    }
  } finally {
    await client.end();
  }
}

/**
 * An entity, a period and its report, seeded straight to the database (task 35.1).
 *
 * **The wizard has no way in through the product yet**, which is why this exists: S-06 is task
 * 32.2.2 and blocked, and report creation is task 32.3. A journey that could not reach S-07 could
 * not check the one thing 35.1 delivers — that the steps are navigable and each has a URL that
 * restores it.
 *
 * **The pins are written, not resolved.** A period opened through the API asks the taxonomy registry
 * for them; here they are stated, so the fixture does not depend on which adoption window the
 * calendar happens to be in. `2026-05-01` is what a FY2026 period pins under task 33.3's schedule.
 *
 * **`entity_snapshot_id` is left null.** FR-18's snapshot is taken at period open by the use case,
 * and a browser journey about navigation has no business manufacturing one — the column is nullable
 * precisely because it is the API's to fill.
 */
/** What both fixtures need. `seedReport` returns the report's id; `seedOpenPeriod` returns the
 *  period's, and neither caller sees the other's half. */
export interface SeedReportInput {
  readonly organizationId: string;
  readonly name: string;
  readonly fiscalYear?: number;
  readonly sites?: readonly { readonly name: string; readonly locality: string }[];
  /**
   * FR-21's optional due date, as ISO `YYYY-MM-DD` (task 32.4).
   *
   * S-05's overview is the first journey that needs one: *has the deadline passed* is answerable
   * only against a deadline, and a fixture that could not set one would leave the overdue state
   * reachable in a unit spec and unreachable in a browser. Omitted means a period with no deadline,
   * which is a real and common state.
   */
  readonly dueDate?: string;
}

/**
 * S-06's fixture (task 32.2.2): the report id, as every caller before this task expected.
 *
 * The shape is unchanged deliberately — five suites call this and none of them wants the entity or
 * the period, so widening the return would make every one of them read a field it ignores.
 */
export async function seedReport(input: SeedReportInput): Promise<string> {
  const { reportId } = await seedFiling({ ...input, withReport: true });
  // Non-null by construction: `withReport` is true. Asserted rather than asserted-away, because a
  // fixture that silently returned `null` would fail a journey somewhere far from here.
  if (reportId === null) throw new Error('seedReport: the report was not written');
  return reportId;
}

async function seedFiling(input: {
  readonly organizationId: string;
  readonly name: string;
  readonly fiscalYear?: number;
  /**
   * Sites for the FR-18 snapshot the period takes at open (task 36.2).
   *
   * **The snapshot is what B1's pre-population reads**, never the live entity, so a fixture without
   * one produces a B1 with no defaults and no site rows — which is a legitimate report and the wrong
   * subject for a journey about either. Omitted means exactly that: a period that took no snapshot,
   * which the api tolerates and one case here still uses.
   */
  readonly sites?: readonly { readonly name: string; readonly locality: string }[];
  readonly dueDate?: string;
  readonly withReport: boolean;
}): Promise<{
  readonly entityId: string;
  readonly periodId: string;
  readonly reportId: string | null;
}> {
  const { organizationId, name, fiscalYear = 2026, sites, dueDate, withReport } = input;
  const client = new Client(asOwner());
  await client.connect();
  try {
    const entityId = randomUUID();
    const periodId = randomUUID();
    const reportId = randomUUID();
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_org', $1, true)`, [organizationId]);
    await client.query(
      `INSERT INTO core.reporting_entity (id, organization_id, name, nace_codes)
       VALUES ($1, $2, $3, '{}')`,
      [entityId, organizationId, name],
    );
    // The payload is `to_jsonb(row)`'s shape — whatever columns the entity had on the day — which
    // is what the api's reader tolerates by design (task 91.2).
    const snapshotId = sites === undefined ? null : randomUUID();
    if (snapshotId !== null) {
      await client.query(
        `INSERT INTO core.entity_snapshot (id, organization_id, reporting_entity_id, payload)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [
          snapshotId,
          organizationId,
          entityId,
          JSON.stringify({
            id: entityId,
            name,
            legal_form: 'srl',
            nace_codes: ['10.71'],
            consolidation_basis: 'individual',
            sites: sites.map((site) => ({ name: site.name, locality: site.locality, country_code: 'MD' })),
          }),
        ],
      );
    }
    await client.query(
      // The zone travels with the date on both boundaries and on the due date, which is the paired
      // `<field>`/`<field>_tz` shape §7.9 requires and the `CHECK` refuses a half of.
      `INSERT INTO core.reporting_period
         (id, organization_id, reporting_entity_id, fiscal_year,
          period_start, period_start_tz, period_end, period_end_tz,
          due_date, due_date_tz,
          template_version, taxonomy_version, entity_snapshot_id)
       VALUES ($1, $2, $3, $4, $5, 'Europe/Chisinau', $6, 'Europe/Chisinau',
               $7, CASE WHEN $7::date IS NULL THEN NULL ELSE 'Europe/Chisinau' END,
               '2026-05-01', '2026-05-01', $8)`,
      [
        periodId,
        organizationId,
        entityId,
        fiscalYear,
        `${fiscalYear}-01-01`,
        `${fiscalYear}-12-31`,
        dueDate ?? null,
        snapshotId,
      ],
    );
    if (withReport) {
      await client.query(
        `INSERT INTO core.report
           (id, organization_id, reporting_period_id, scope, status, template_version, taxonomy_version)
         VALUES ($1, $2, $3, 'basic', 'open', '2026-05-01', '2026-05-01')`,
        [reportId, organizationId, periodId],
      );
    }
    await client.query('COMMIT');
    return { entityId, periodId, reportId: withReport ? reportId : null };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

/**
 * The same fixture **without** the report — an entity with one open period, which is what S-06's
 * creation flow needs something to offer (task 32.3).
 *
 * A variant of `seedReport` rather than a copy of it: the entity, the snapshot and the period are
 * the same four inserts, and two copies of them would drift the moment a column is added — which is
 * exactly what `core.reporting_period` gained twice already (the lock at 31.2, the snapshot link at
 * 31.1).
 */
export async function seedOpenPeriod(input: SeedReportInput): Promise<{
  readonly entityId: string;
  readonly periodId: string;
}> {
  const { entityId, periodId } = await seedFiling({ ...input, withReport: false });
  return { entityId, periodId };
}

/**
 * One stored disclosure value, read as the migration owner **with the tenant bound** — RLS is forced
 * on the tenant tables for the owner too, so an unbound read answers nothing rather than everything.
 * `null` where no row exists. What the autosave journey asserts on: the acknowledgement the screen
 * shows is only honest if this row is what it says (NFR-56).
 */
export async function disclosureValueOf(input: {
  readonly organizationId: string;
  readonly reportId: string;
  readonly elementKey: string;
  /**
   * §7.3's second key part (task 36.4). Defaults to `''` — the undimensioned row every caller
   * before B3 wanted — so a breakdown's member row is reachable **and** the undimensioned row a
   * broken breakdown would have written to stays assertable. Reading only `''` is what made the
   * first B3 case claim a property it could not see.
   */
  readonly dimensionKey?: string;
  /**
   * §7.3's third key part (task 36.6). Defaults to `0` — every caller before B5 wanted the only
   * row an undimensioned element has — so a typed axis's second site is reachable, **and** the row
   * a group that ignored its ordinal would have written stays assertable.
   */
  readonly ordinal?: number;
}): Promise<{
  valueNumeric: string | null;
  valueText: string | null;
  /** UX-14's unit as stored (task 91.4) — the half of the answer a bare number cannot carry. */
  unitCode: string | null;
  /** FR-32's reason, which the store pairs to `not_available` alone (task 36.5). */
  notAvailableReason: string | null;
  valueBoolean: boolean | null;
  state: string;
} | null> {
  const client = new Client(asOwner());
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_org', $1, true)`, [input.organizationId]);
    const result = await client.query<{
      value_numeric: string | null;
      value_text: string | null;
      unit_code: string | null;
      not_available_reason: string | null;
      value_boolean: boolean | null;
      state: string;
    }>(
      `SELECT value_numeric, value_text, unit_code, not_available_reason, value_boolean, state
         FROM core.report_disclosure_value
        WHERE report_id = $1 AND element_key = $2 AND dimension_key = $3 AND ordinal = $4`,
      [input.reportId, input.elementKey, input.dimensionKey ?? '', input.ordinal ?? 0],
    );
    await client.query('COMMIT');
    const row = result.rows[0];
    return row === undefined
      ? null
      : {
          valueNumeric: row.value_numeric,
          valueText: row.value_text,
          unitCode: row.unit_code,
          notAvailableReason: row.not_available_reason,
          valueBoolean: row.value_boolean,
          state: row.state,
        };
  } finally {
    await client.end();
  }
}

/**
 * A prior year for a report that already exists — FR-45's linkage, with something in it (task 36.14).
 *
 * **Built here rather than through the product** because the product cannot: `seedFiling` opens one
 * period per entity, and UC-45's subject is two periods of the *same* entity with the later linked
 * to the earlier. Opening a second period through the API would exercise task 31.1's linkage rather
 * than this task's display, and would put a fixture's correctness inside the thing under test.
 *
 * The prior report is pinned to the **same** taxonomy version as the current one, so every value it
 * holds is `comparable` — task 34.3's other two verdicts are unit-tested against the vocabulary, and
 * contriving a version skew in a browser fixture would test 34.3 rather than the screen.
 */
export async function seedPriorPeriod(input: {
  readonly organizationId: string;
  readonly reportId: string;
  /** Element key to value — written into the prior year's report, in the text or numeric column. */
  readonly values: Readonly<Record<string, { readonly numeric?: string; readonly text?: string }>>;
}): Promise<{ readonly priorReportId: string }> {
  const client = new Client(asOwner());
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_org', $1, true)`, [input.organizationId]);

    const current = await client.query<{ reporting_entity_id: string; fiscal_year: number; period_id: string }>(
      `SELECT p.reporting_entity_id, p.fiscal_year, p.id AS period_id
         FROM core.report r JOIN core.reporting_period p ON p.id = r.reporting_period_id
        WHERE r.id = $1`,
      [input.reportId],
    );
    const { reporting_entity_id: entityId, fiscal_year: year, period_id: periodId } = current.rows[0];
    const priorPeriodId = randomUUID();
    const priorReportId = randomUUID();

    await client.query(
      `INSERT INTO core.reporting_period
         (id, organization_id, reporting_entity_id, fiscal_year,
          period_start, period_start_tz, period_end, period_end_tz,
          template_version, taxonomy_version)
       VALUES ($1, $2, $3, $4, $5, 'Europe/Chisinau', $6, 'Europe/Chisinau', '2026-05-01', '2026-05-01')`,
      [priorPeriodId, input.organizationId, entityId, year - 1, `${year - 1}-01-01`, `${year - 1}-12-31`],
    );
    await client.query(
      // The pin is copied from the period, as `ReportStoreRepository.create` does — DR-4's rule
      // that a report never resolves it a second time (task 31.3). A fixture that hard-coded it
      // would be a second place the pin is decided.
      `INSERT INTO core.report
         (id, organization_id, reporting_period_id, scope, status, template_version, taxonomy_version)
       SELECT $1, $2, p.id, 'basic', 'open', p.template_version, p.taxonomy_version
         FROM core.reporting_period p WHERE p.id = $3`,
      [priorReportId, input.organizationId, priorPeriodId],
    );
    // The linkage FR-45 resolves from, set after both exist.
    await client.query(`UPDATE core.reporting_period SET prior_period_id = $2 WHERE id = $1`, [
      periodId,
      priorPeriodId,
    ]);

    for (const [elementKey, value] of Object.entries(input.values)) {
      await client.query(
        `INSERT INTO core.report_disclosure_value
           (organization_id, report_id, element_key, value_numeric, value_text, state)
         VALUES ($1, $2, $3, $4, $5, 'ok')`,
        [input.organizationId, priorReportId, elementKey, value.numeric ?? null, value.text ?? null],
      );
    }
    // **Locked last, and the order is the guard's** (task 34.1's `refuse_locked_write`): a prior
    // year is a filed year, and writing into it while locked is refused by the database — which is
    // what this fixture met on its first run. Values first, then the lock, is also the order the
    // product itself takes.
    await client.query(`UPDATE core.report SET status = 'locked' WHERE id = $1`, [priorReportId]);
    await client.query('COMMIT');
    return { priorReportId };
  } finally {
    await client.end();
  }
}

/**
 * Moves the account at `email` into setup (task 155), so S-36's two steps can be reached by a scan
 * without driving a provider registration through the stub for each one.
 *
 * `holdsPassword: true` leaves the credential and clears the family name — S-36's second step, since
 * an account holding everything setup asks for is not in setup. `false` also removes the credential,
 * which is the first step. The account's status is what S-36 reads, and it reads it from the API, so
 * the session cookie's own copy — still *active* from the sign-in — does not stand in the way.
 */
export async function moveIntoSetup(input: {
  readonly email: string;
  readonly holdsPassword: boolean;
}): Promise<void> {
  const client = new Client(asOwner());
  await client.connect();
  try {
    await client.query(
      `UPDATE identity.account SET status = 'awaiting_setup', family_name = NULL
        WHERE lower(email) = lower($1)`,
      [input.email],
    );
    if (!input.holdsPassword) {
      await client.query(
        `DELETE FROM identity.credential c USING identity.account a
          WHERE c.account_id = a.id AND lower(a.email) = lower($1)`,
        [input.email],
      );
    }
  } finally {
    await client.end();
  }
}

/**
 * Removes the credential of the account at `email` (task 155). Done before its confirmation link is
 * followed, that leaves a provider registration's shape where the provider did not assert the address —
 * an unverified row, a live challenge, no password — so S-36's password step on S-02's path can be
 * reached without the provider stub.
 */
export async function dropCredential(input: { readonly email: string }): Promise<void> {
  const client = new Client(asOwner());
  await client.connect();
  try {
    await client.query(
      `DELETE FROM identity.credential c USING identity.account a
        WHERE c.account_id = a.id AND lower(a.email) = lower($1)`,
      [input.email],
    );
  } finally {
    await client.end();
  }
}
