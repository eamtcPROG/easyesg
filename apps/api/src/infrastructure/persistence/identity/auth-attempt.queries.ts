import type { QueryRunner } from 'typeorm';

/**
 * The `identity.auth_attempt` window, shared by the two stores that throttle (§12.5.6: sign-in
 * in the session store, reset request in the account store — invitation accept joins at task
 * 26). One implementation because the two must not drift on the semantics the migration states:
 * count PROCESSED attempts only, and prune on write so nothing personal outlives its window.
 */

export async function countRecentAuthAttempts(
  queryRunner: QueryRunner,
  key: string,
  since: Date,
): Promise<number> {
  const rows = (await queryRunner.query(
    `SELECT count(*)::int AS attempts FROM identity.auth_attempt
      WHERE attempt_key = $1 AND attempted_at >= $2`,
    [key, since],
  )) as { attempts: number }[];
  return rows[0].attempts;
}

export async function recordAuthAttempt(
  queryRunner: QueryRunner,
  key: string,
  at: Date,
): Promise<void> {
  // The prune is global, not per key, and runs on every write: the table's rows are (IP, address)
  // pairs — personal data with a 15-minute usefulness — and a per-key prune would leave every
  // idle key's rows behind until that key's next attempt, which may be never. At this scale the
  // table is dozens of rows; a dedicated sweep would be machinery for hygiene one statement buys.
  await queryRunner.query(
    `DELETE FROM identity.auth_attempt WHERE attempted_at < now() - interval '15 minutes'`,
  );
  await queryRunner.query(
    `INSERT INTO identity.auth_attempt (attempt_key, attempted_at) VALUES ($1, $2)`,
    [key, at],
  );
}
