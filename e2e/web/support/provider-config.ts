import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

/**
 * Publishes an `identity_provider` configuration entry for the browser e2e (task 24) — the
 * same three statements `ConfigurationPublisher.publish` runs, restated here because the api
 * under test is a separate process whose publisher has no route until A-18 (task 67). Wire
 * literals are pinned on purpose, as everywhere in the suites: a renamed table or kind must
 * break this file.
 *
 * Runs as the migration owner, like cleanup does: `esg_app` may write configuration, but the
 * harness role split mirrors "who does this in production" only where a suite asserts on it,
 * and this helper is stack plumbing, not an assertion.
 */
const asOwner = () => ({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number.parseInt(process.env.DB_PORT ?? '5432', 10),
  database: process.env.DB_NAME ?? 'esg',
  user: process.env.DB_MIGRATOR_USER ?? 'esg_migrator',
  password: process.env.DB_MIGRATOR_PASSWORD ?? 'devonly-migrator',
});

const KIND = 'identity_provider';
/** The publisher's unbounded validity literal — PostgreSQL canonicalises it to `(,)`. */
const UNBOUNDED = '[,)';

export async function publishIdentityProvider(
  scope: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const client = new Client(asOwner());
  await client.connect();
  try {
    await client.query('BEGIN');
    const revision = await client.query<{ next: number }>(
      `SELECT coalesce(max(revision), 0) + 1 AS next FROM config.entry_version
        WHERE kind = $1 AND scope = $2`,
      [KIND, scope],
    );
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO config.entry_version (kind, scope, revision, state, payload, created_by, published_at)
       VALUES ($1, $2, $3, 'published', $4::jsonb, NULL, now())
       RETURNING id`,
      [KIND, scope, revision.rows[0].next, JSON.stringify(payload)],
    );
    const slot = await client.query<{ version_id: string }>(
      `SELECT version_id FROM config.entry_schedule
        WHERE kind = $1 AND scope = $2 AND validity = $3::daterange`,
      [KIND, scope, UNBOUNDED],
    );
    if (slot.rows.length > 0) {
      await client.query(
        `UPDATE config.entry_schedule SET version_id = $4
          WHERE kind = $1 AND scope = $2 AND validity = $3::daterange`,
        [KIND, scope, UNBOUNDED, inserted.rows[0].id],
      );
      for (const row of slot.rows) {
        await client.query(
          `UPDATE config.entry_version SET state = 'superseded' WHERE id = $1 AND state = 'published'`,
          [row.version_id],
        );
      }
    } else {
      await client.query(
        `INSERT INTO config.entry_schedule (kind, scope, validity, version_id)
         VALUES ($1, $2, $3::daterange, $4)`,
        [KIND, scope, UNBOUNDED, inserted.rows[0].id],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

/** Re-publishes the committed seed payload, so the store leaves the run as `config:seed` expects. */
export async function restoreIdentityProviderSeed(scope: string): Promise<void> {
  const seed = JSON.parse(
    // Playwright compiles specs as ESM, so `import.meta.url` is the anchor — `__dirname` throws.
    readFileSync(
      fileURLToPath(new URL(`../../../config/seed/identity-provider.${scope}.json`, import.meta.url)),
      'utf8',
    ),
  ) as Record<string, unknown>;
  await publishIdentityProvider(scope, seed);
}
