import { createHmac, hkdfSync } from 'node:crypto';
import { Client } from 'pg';

/**
 * FR-169's signed unsubscribe link, minted the way the worker mints it (task 52.2.2) — and one place a second copy of
 * the format is the point rather than drift. The worker the browser suite has run since task 150 sends to the log
 * provider, so no delivered email is there to read a link from; restating `HmacUnsubscribeTokens`' format (`apps/api`'s adapter, whose spec owns it) means
 * a change there turns S-38's journey red as *this link cannot be used*, rather than going unseen. The key is
 * `playwright.config.ts`'s, the one the api under test holds.
 */
const KEY = process.env.UNSUBSCRIBE_SIGNING_KEY ?? 'devonly-unsubscribe-signing-key-for-local-runs';

export const unsubscribeTokenFor = (input: {
  readonly accountId: string;
  readonly categoryKey: string;
  readonly signingKey?: string;
}): string => {
  const key = Buffer.from(hkdfSync('sha256', input.signingKey ?? KEY, '', 'easyesg-unsubscribe-v1', 32));
  const body = Buffer.from(JSON.stringify([input.accountId, input.categoryKey, 'email'])).toString('base64url');
  const mac = createHmac('sha256', key).update(`v1~${body}`).digest('base64url');
  return `v1~${body}~${mac}`;
};

const asOwner = () => ({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number.parseInt(process.env.DB_PORT ?? '5432', 10),
  database: process.env.DB_NAME ?? 'esg',
  user: process.env.DB_MIGRATOR_USER ?? 'esg_migrator',
  password: process.env.DB_MIGRATOR_PASSWORD ?? 'devonly-migrator',
});

/** An account an email could have been sent to — nothing else about it matters to S-38. */
export async function seedRecipient(email: string): Promise<string> {
  const client = new Client(asOwner());
  await client.connect();
  try {
    const result = await client.query<{ id: string }>(
      `INSERT INTO identity.account (email, locale) VALUES ($1, 'ro') RETURNING id`,
      [email],
    );
    return result.rows[0].id;
  } finally {
    await client.end();
  }
}

/** The account's switch-offs, as the table holds them. */
export async function switchedOffFor(accountId: string): Promise<{ category_key: string; channel: string }[]> {
  const client = new Client(asOwner());
  await client.connect();
  try {
    const result = await client.query<{ category_key: string; channel: string }>(
      `SELECT category_key, channel FROM notification.preference WHERE account_id = $1 ORDER BY 1, 2`,
      [accountId],
    );
    return result.rows;
  } finally {
    await client.end();
  }
}

/** Nothing cascades to a preference — it hangs off no organization — so what a suite switches off, it removes. */
export async function cleanupRecipients(prefix: string): Promise<void> {
  const client = new Client(asOwner());
  await client.connect();
  try {
    await client.query(
      `DELETE FROM notification.preference
        WHERE account_id IN (SELECT id FROM identity.account WHERE email LIKE $1)`,
      [`${prefix}%`],
    );
    await client.query(`DELETE FROM identity.account WHERE email LIKE $1`, [`${prefix}%`]);
  } finally {
    await client.end();
  }
}
