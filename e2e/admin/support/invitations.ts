import { Client } from 'pg';

/**
 * An administrator invitation's link, read where the product keeps its one usable copy (task 67.4) —
 * the outbox payload of the email that carries it (OQ-54), since `identity.admin_invitation` holds only
 * its hash. Read as the migration owner, the only role that can read the outbox back.
 */
const INVITATION_EMAIL = 'platform.admin_invitation.issued';

const connect = async (): Promise<Client> => {
  const client = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number.parseInt(process.env.DB_PORT ?? '5432', 10),
    database: process.env.DB_NAME ?? 'esg',
    user: process.env.DB_MIGRATOR_USER ?? 'esg_migrator',
    password: process.env.DB_MIGRATOR_PASSWORD ?? 'devonly-migrator',
  });
  await client.connect();
  return client;
};

export async function invitationTokenFor(email: string): Promise<string> {
  const client = await connect();
  try {
    const { rows } = await client.query<{ token: string }>(
      `SELECT payload->>'token' AS token FROM audit.outbox_event
        WHERE event_type = $1 AND payload->>'email' = $2
        ORDER BY occurred_at DESC, id DESC LIMIT 1`,
      [INVITATION_EMAIL, email],
    );
    if (rows.length === 0) throw new Error(`no invitation email for ${email}`);
    return rows[0].token;
  } finally {
    await client.end();
  }
}

/**
 * The emails this run caused. An outbox row outlives its invitation on purpose (AD-6), so a suite
 * removes its own — `outbox.e2e-spec.ts` needs the table quiet.
 */
export async function cleanupInvitationEmails(prefix: string): Promise<void> {
  const client = await connect();
  try {
    await client.query(`DELETE FROM audit.outbox_event WHERE event_type = $1 AND payload->>'email' LIKE $2`, [
      INVITATION_EMAIL,
      `${prefix}%`,
    ]);
  } finally {
    await client.end();
  }
}
