import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `audit.support_access_log`, its acquisition half (task 67.3; FR-79, NFR-66; §7.6, §9.2) — and the
 * one column grant the organization register's *activity* needs.
 *
 * **Created now with only the acquisition half, by the project owner's decision (13 Sep 2026).** §9.2
 * names this table for *every support-access grant and every acquisition of the `BYPASSRLS` role*;
 * the register is the first acquisition, and the grant half is task 67.9's (A-07), which widens the
 * `entry_kind` check rather than adding a second table.
 *
 * **Append-only and partitioned, by `audit.enforce_append_only`** — §15's partitioning plan for
 * every append-only store, pre-created through 2028 with a default so a log write never fails for
 * want of a partition. That last property matters more here than on the system audit log: this
 * log's writer fails closed (`admin-readonly.ts`), so a missing partition would refuse the read.
 *
 * **RLS enabled and forced, with an insert policy admitting only a platform writer and no select
 * policy.** `organization_id` is `NULL` for a read across organizations and names the organization
 * for a scoped one, so the column makes this a table the RLS invariant covers. Nothing binds a tenant
 * to write it — the writer takes its own core connection — and a tenant request must not be able to
 * forge a row, so the insert check is *no organization bound*. Reads go through `esg_admin_ro`'s
 * `BYPASSRLS`, as the platform audit rows' do.
 *
 * **`requester_id` is a bare `uuid`** — the admin account — for FR-55's retention reason: the record
 * must outlive the account it names.
 *
 * **`identity.session (account_id, created_at)` to `esg_admin_ro`, and nothing else of that table.**
 * *Activity* is the most recent sign-in by any active member (owner's decision); `revoked_at`,
 * `active_organization_id` and `remembered` are no business of a register, so a column grant rather
 * than the table.
 */
export class SupportAccessLog1790035200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE audit.support_access_log (
        id              uuid        NOT NULL DEFAULT uuidv7(),
        occurred_at     timestamptz NOT NULL DEFAULT now(),
        entry_kind      text        NOT NULL,
        requester_id    uuid        NOT NULL,
        organization_id uuid,
        purpose         text        NOT NULL,
        PRIMARY KEY (id, occurred_at),
        CONSTRAINT support_access_log_entry_kind_known CHECK (entry_kind IN ('acquisition'))
      ) PARTITION BY RANGE (occurred_at)
    `);

    for (const year of [2026, 2027, 2028]) {
      await queryRunner.query(`
        CREATE TABLE audit.support_access_log_${year} PARTITION OF audit.support_access_log
          FOR VALUES FROM ('${year}-01-01 00:00:00+00') TO ('${year + 1}-01-01 00:00:00+00')
      `);
    }
    await queryRunner.query(`
      CREATE TABLE audit.support_access_log_default PARTITION OF audit.support_access_log DEFAULT
    `);

    // On the parent only, as the system audit log's: a routed INSERT is checked against the parent.
    await queryRunner.query(`GRANT INSERT ON audit.support_access_log TO esg_app`);
    await queryRunner.query(`GRANT SELECT ON audit.support_access_log TO esg_admin_ro`);

    await queryRunner.query(`ALTER TABLE audit.support_access_log ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE audit.support_access_log FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY support_access_log_platform_insert ON audit.support_access_log
        FOR INSERT WITH CHECK (NULLIF(current_setting('app.current_org', true), '') IS NULL)
    `);

    // Last, so every partition above exists for the procedure to seal.
    await queryRunner.query(`CALL audit.enforce_append_only('audit.support_access_log')`);

    await queryRunner.query(`GRANT SELECT (account_id, created_at) ON identity.session TO esg_admin_ro`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `REVOKE SELECT (account_id, created_at) ON identity.session FROM esg_admin_ro`,
    );
    // Takes its partitions, triggers, policies and grants with it.
    await queryRunner.query(`DROP TABLE audit.support_access_log`);
  }
}
