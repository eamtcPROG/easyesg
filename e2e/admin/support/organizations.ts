import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

/**
 * Organizations for the console's browser e2e (task 67.3) — seeded as the migration owner, because
 * the console creates none: an organization exists because someone founded it in the tenant app, and
 * A-02 only reads the register.
 *
 * **The id is generated here rather than returned**, and that is RLS rather than style: `RETURNING`
 * makes the new row pass the table's SELECT policies, and with no organization bound it passes none —
 * so an `INSERT … RETURNING id` is refused for a row the INSERT policy admitted. Deleting binds the
 * organization for the same reason: `FORCE ROW LEVEL SECURITY` subjects the owner too, and a `DELETE`
 * matching no policy removes nothing and says nothing.
 */
const seeded = new Set<string>();
/** Accounts seeded as members (task 167). An account hangs off no organization, so the cascade does not take it. */
const seededAccounts = new Set<string>();

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

const inTransaction = async (organizationId: string, work: (client: Client) => Promise<void>) => {
  const client = await connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_org', $1, true)`, [organizationId]);
    await work(client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
};

export async function seedOrganization(input: { name: string; idno: string }): Promise<string> {
  const id = randomUUID();
  await inTransaction('', async (client) => {
    await client.query(
      `INSERT INTO core.organization (id, name, country_code, idno) VALUES ($1, $2, 'MD', $3)`,
      [id, input.name, input.idno],
    );
  });
  seeded.add(id);
  return id;
}

/**
 * A person with an active membership in a seeded organization (task 167) — an account as a registration would leave
 * it, with the name parts and, where given, the phone S-27 stores (`+` and the digits). Returns the account's id.
 */
export async function seedMember(input: {
  readonly organizationId: string;
  readonly email: string;
  readonly givenName: string;
  readonly familyName: string;
  readonly phone: string | null;
  readonly role: 'editor' | 'viewer' | 'organization_administrator';
}): Promise<string> {
  const accountId = randomUUID();
  await inTransaction(input.organizationId, async (client) => {
    await client.query(
      `INSERT INTO identity.account (id, email, locale, given_name, family_name, phone)
       VALUES ($1, $2, 'ro', $3, $4, $5)`,
      [accountId, input.email, input.givenName, input.familyName, input.phone],
    );
    await client.query(
      `INSERT INTO identity.membership (account_id, organization_id, role) VALUES ($1, $2, $3)`,
      [accountId, input.organizationId, input.role],
    );
  });
  seededAccounts.add(accountId);
  return accountId;
}

export async function cleanupOrganizations(): Promise<void> {
  for (const id of seeded) {
    await inTransaction(id, async (client) => {
      await client.query(`DELETE FROM core.organization WHERE id = $1`, [id]);
    });
  }
  seeded.clear();
  if (seededAccounts.size > 0) {
    const client = await connect();
    try {
      await client.query(`DELETE FROM identity.account WHERE id = ANY($1::uuid[])`, [[...seededAccounts]]);
    } finally {
      await client.end();
    }
    seededAccounts.clear();
  }
}
