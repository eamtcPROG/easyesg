import { Client } from 'pg';

/**
 * A-03's journeys leave configuration versions behind (task 67.5), and a published version is immutable by trigger —
 * which is the guarantee, so a journey's cleanup goes around it as the migration owner, removing only the help topics
 * under the run's own key prefix.
 */
export async function cleanupContent(keyPrefix: string): Promise<void> {
  const client = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number.parseInt(process.env.DB_PORT ?? '5432', 10),
    database: process.env.DB_NAME ?? 'esg',
    user: process.env.DB_MIGRATOR_USER ?? 'esg_migrator',
    password: process.env.DB_MIGRATOR_PASSWORD ?? 'devonly-migrator',
  });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(`ALTER TABLE config.entry_version DISABLE TRIGGER reject_published_edit`);
    await client.query(`DELETE FROM config.entry_schedule WHERE kind = 'help_topic' AND scope LIKE $1`, [`${keyPrefix}%`]);
    await client.query(`DELETE FROM config.entry_version WHERE kind = 'help_topic' AND scope LIKE $1`, [`${keyPrefix}%`]);
    await client.query(`ALTER TABLE config.entry_version ENABLE TRIGGER reject_published_edit`);
    await client.query('COMMIT');
  } finally {
    await client.end();
  }
}
