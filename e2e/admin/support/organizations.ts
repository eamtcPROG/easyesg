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

export async function cleanupOrganizations(): Promise<void> {
  for (const id of seeded) {
    await inTransaction(id, async (client) => {
      await client.query(`DELETE FROM core.organization WHERE id = $1`, [id]);
    });
  }
  seeded.clear();
}
