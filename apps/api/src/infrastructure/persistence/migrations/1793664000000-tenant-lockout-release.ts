import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A Platform Administrator releases a locked tenant account on A-02 (task 67.12; UC-214, FR-209; `architecture.md`
 * §12.5.6's task-67.12 row).
 *
 * **The reason is a column of the audit row** (row (1)): `audit.system_audit_log.reason`, written by
 * `AuditInterceptor` from the field the route names, so the one row FR-209 behaviour 3 asks for carries the operator,
 * the person, the action, the time and why. Null for every action that asks for none; bounded at A-07's 500 characters
 * when given, and never blank, which is the request DTO's rule restated where every writer meets it. Added to the
 * partitioned parent, so every partition takes it; the append-only triggers are untouched by a column.
 *
 * **A-02's member list says who is locked** (row (2)): `esg_admin_ro` reads `identity.credential (account_id,
 * locked_at)` and nothing else of it — not the hash, not the failure count — which is the column-grant shape A-08's
 * names were given at task 67.4.
 */
export class TenantLockoutRelease1793664000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE audit.system_audit_log ADD COLUMN reason text`);
    await queryRunner.query(`
      ALTER TABLE audit.system_audit_log ADD CONSTRAINT system_audit_log_reason_bounded
        CHECK (reason IS NULL OR (char_length(reason) BETWEEN 1 AND 500 AND btrim(reason) <> ''))
    `);

    await queryRunner.query(`GRANT SELECT (account_id, locked_at) ON identity.credential TO esg_admin_ro`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`REVOKE SELECT (account_id, locked_at) ON identity.credential FROM esg_admin_ro`);
    // Lossy by necessity: a recorded reason has nowhere to go.
    await queryRunner.query(`ALTER TABLE audit.system_audit_log DROP COLUMN reason`);
  }
}
