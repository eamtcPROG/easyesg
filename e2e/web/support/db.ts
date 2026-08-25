import { randomUUID } from 'node:crypto';
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
 */
export async function grantMembership(email: string, organizationName: string): Promise<string> {
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
    await client.query(`INSERT INTO core.organization (id, name) VALUES ($1, $2)`, [
      organizationId,
      organizationName,
    ]);
    await client.query(`SELECT set_config('app.current_org', $1, true)`, [organizationId]);
    await client.query(
      `INSERT INTO identity.membership (account_id, organization_id, role)
       SELECT a.id, $2, 'organization_administrator' FROM identity.account a
        WHERE lower(a.email) = lower($1)`,
      [email, organizationId],
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
