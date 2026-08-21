import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

/**
 * Operator provisioning for the browser e2e — **through the real CLI**, because the CLI is
 * UC-68's precondition mechanised (task 23) and the suite should prove the tool an operator
 * will actually run. `pree2e:web` already built the api, so the entrypoint is invoked from
 * `dist/` directly rather than through the package script (whose `pre` hook would rebuild per
 * call). Credentials default to the Compose stack's committed synthetic values, like
 * `e2e/web/support/db.ts`.
 */
const CLI = 'apps/api/dist/infrastructure/provisioning/provision-admin.main.js';

export function provisionOperator(email: string, password: string, totpSecret: string): void {
  execFileSync('node', [CLI, '--email', email, '--password', password, '--totp-secret', totpSecret], {
    // Playwright executes specs as ESM, so the repo root is anchored off `import.meta.url`,
    // never `__dirname` (undefined there).
    cwd: fileURLToPath(new URL('../../..', import.meta.url)),
    env: {
      ...process.env,
      DB_HOST: process.env.DB_HOST ?? 'localhost',
      DB_PORT: process.env.DB_PORT ?? '5432',
      DB_NAME: process.env.DB_NAME ?? 'esg',
      DB_USER: process.env.DB_USER ?? 'esg_app',
      DB_PASSWORD: process.env.DB_PASSWORD ?? 'devonly-app',
      AUTH_PASSWORD_PEPPER: process.env.AUTH_PASSWORD_PEPPER ?? 'devonly-pepper',
    },
    stdio: 'pipe',
  });
}

/** Cleanup runs as the migration owner — `esg_app` deliberately holds no DELETE (task 23's
 *  migration), and that grant split is not this suite's to work around. */
export async function cleanupOperators(prefix: string): Promise<void> {
  const client = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number.parseInt(process.env.DB_PORT ?? '5432', 10),
    database: process.env.DB_NAME ?? 'esg',
    user: process.env.DB_MIGRATOR_USER ?? 'esg_migrator',
    password: process.env.DB_MIGRATOR_PASSWORD ?? 'devonly-migrator',
  });
  await client.connect();
  try {
    await client.query(`DELETE FROM identity.auth_attempt WHERE attempt_key LIKE $1`, [
      `%${prefix}%`,
    ]);
    await client.query(`DELETE FROM identity.admin_account WHERE email LIKE $1`, [`${prefix}%`]);
  } finally {
    await client.end();
  }
}
