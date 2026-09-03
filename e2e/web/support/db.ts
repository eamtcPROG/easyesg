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
export async function seedReport(input: {
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
}): Promise<string> {
  const { organizationId, name, fiscalYear = 2026, sites } = input;
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
      `INSERT INTO core.reporting_period
         (id, organization_id, reporting_entity_id, fiscal_year,
          period_start, period_start_tz, period_end, period_end_tz,
          template_version, taxonomy_version, entity_snapshot_id)
       VALUES ($1, $2, $3, $4, $5, 'Europe/Chisinau', $6, 'Europe/Chisinau', '2026-05-01', '2026-05-01', $7)`,
      [periodId, organizationId, entityId, fiscalYear, `${fiscalYear}-01-01`, `${fiscalYear}-12-31`, snapshotId],
    );
    await client.query(
      `INSERT INTO core.report
         (id, organization_id, reporting_period_id, scope, status, template_version, taxonomy_version)
       VALUES ($1, $2, $3, 'basic', 'open', '2026-05-01', '2026-05-01')`,
      [reportId, organizationId, periodId],
    );
    await client.query('COMMIT');
    return reportId;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
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
}): Promise<{ valueNumeric: string | null; valueText: string | null; state: string } | null> {
  const client = new Client(asOwner());
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_org', $1, true)`, [input.organizationId]);
    const result = await client.query<{
      value_numeric: string | null;
      value_text: string | null;
      state: string;
    }>(
      `SELECT value_numeric, value_text, state
         FROM core.report_disclosure_value
        WHERE report_id = $1 AND element_key = $2 AND dimension_key = '' AND ordinal = 0`,
      [input.reportId, input.elementKey],
    );
    await client.query('COMMIT');
    const row = result.rows[0];
    return row === undefined
      ? null
      : { valueNumeric: row.value_numeric, valueText: row.value_text, state: row.state };
  } finally {
    await client.end();
  }
}
