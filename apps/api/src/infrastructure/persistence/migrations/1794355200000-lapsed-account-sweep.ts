import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * OQ-52's reclaiming sweep, made the database's rule (task 200; FR-3 AC-7; `architecture.md` §12.5.6's task-200 row).
 *
 * **`identity.reclaim_lapsed_accounts()` deletes every lapsed account and answers how many** (row (1)). It is
 * `SECURITY DEFINER`, so it runs as this table's owner, and `esg_worker` may execute it while holding no `DELETE` on
 * `identity.account`: the worker can remove a lapsed account and nothing else, whatever a defect above the database
 * asks. `core.delete_report` (task 192) is the same shape. `identity.account` is under no row security, so the owner
 * reaches every row.
 *
 * **The predicate is OQ-52's, as `accountHasLapsed` states it** — the point-of-use rule every route asks:
 *
 * - **`unverified`, registered 168 hours or more before now.** Hours, not `'7 days'`: a timestamp less a day is
 *   reckoned in the session's time zone, so across a clock change seven days is 167 or 169 hours, where
 *   `UNVERIFIED_ACCOUNT_TTL_MS` is exactly 168. The boundary is inclusive, as `>=` is there;
 * - **`awaiting_setup` with a deadline at or before now.** The deadline is stored (task 155), so no window is restated
 *   here. An account moved into setup from `active` carries none and is never matched.
 *
 * Two statements of one rule, then, and **the suite `lapsed-account-sweep.e2e-spec.ts` is what holds them equal**
 * (row (2)): it seeds either side of each edge from the TypeScript constant and asserts the function deletes exactly
 * what `accountHasLapsed` calls lapsed.
 *
 * **What goes with an account is its foreign keys' answer** (row (3)) — the same single `DELETE` registration's reclaim
 * runs: credential, tokens, sessions, provider identities, second factor, legal acceptances and memberships by cascade,
 * a cookie answer and a support request kept with the account cleared. Referential actions are not filtered by row
 * security, so the cascade into a tenant table needs no binding.
 *
 * **`now()` is the transaction's start**, so one call has one moment, and a run retried later deletes what has lapsed
 * since — past its window too.
 */
export class LapsedAccountSweep1794355200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE FUNCTION identity.reclaim_lapsed_accounts() RETURNS integer
        LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $fn$
      DECLARE
        reclaimed integer;
      BEGIN
        DELETE FROM identity.account a
         WHERE (a.status = 'unverified' AND a.created_at <= now() - interval '168 hours')
            OR (a.status = 'awaiting_setup' AND a.setup_expires_at IS NOT NULL AND a.setup_expires_at <= now());
        GET DIAGNOSTICS reclaimed = ROW_COUNT;
        RETURN reclaimed;
      END
      $fn$
    `);
    await queryRunner.query(`REVOKE ALL ON FUNCTION identity.reclaim_lapsed_accounts() FROM PUBLIC`);
    await queryRunner.query(`GRANT EXECUTE ON FUNCTION identity.reclaim_lapsed_accounts() TO esg_worker`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION identity.reclaim_lapsed_accounts()`);
  }
}
