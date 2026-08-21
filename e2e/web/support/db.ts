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

/** The wire value is pinned on purpose — a renamed event type must break this suite. */
const EMAIL_VERIFICATION_REQUESTED = 'identity.email_verification.requested';

/** Polls the outbox for the verification token registration committed for `email`. */
export async function verificationTokenFor(email: string, timeoutMs = 15_000): Promise<string> {
  const client = new Client(asWorker());
  await client.connect();
  try {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const result = await client.query<{ payload: { token?: string } }>(
        `SELECT payload FROM audit.outbox_event
          WHERE event_type = $1 AND payload->>'email' = $2
          ORDER BY occurred_at DESC LIMIT 1`,
        [EMAIL_VERIFICATION_REQUESTED, email],
      );
      const token = result.rows[0]?.payload.token;
      if (token) return token;
      if (Date.now() > deadline) {
        throw new Error(`No outbox verification event for ${email} within ${timeoutMs}ms`);
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  } finally {
    await client.end();
  }
}

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
