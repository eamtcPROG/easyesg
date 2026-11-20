import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Platform administration is role-based (task 67.13; FR-80, UC-87; 182/3; `architecture.md` §12.5.6's task-67.13
 * row).
 *
 * **What a role holds is code; who holds a role is this table** (row (2)). `identity.admin_console_role` is one row per
 * account and role, removed when a role is taken away — the system audit log keeps who changed what (FR-81), so the
 * table needs no history of its own and `esg_app` may `DELETE` from it, the one other realm table it may beside the
 * recovery codes. The `CHECK` is the database's copy of `CONSOLE_ROLE`; the two change together by hand, as every
 * vocabulary here does. `granted_by` is a bare id, the actor-column rule.
 *
 * **An invitation carries the roles its account will start with** (row (5)), `console_roles`, copied at acceptance in
 * the transaction that creates the account — empty for a Billing Operator's, whose authority stays the realm's.
 *
 * **Nobody's power changes the day it ships** (182/3's assumption, row (4)): every Platform Administrator account not
 * removed, and every pending Platform Administrator invitation, is given every role — together they hold every
 * permission — and narrowing is done afterwards on A-08. The step is `grantEveryConsoleRole`, exported for its case in
 * `migration-data-steps.e2e-spec.ts`; the realm tables carry no row security, so it needs no `FORCE` lifted.
 */
export const CONSOLE_ROLES = [
  'account_administration',
  'support',
  'operations',
  'content_author',
  'content_publisher',
] as const;

const KNOWN = `ARRAY[${CONSOLE_ROLES.map((role) => `'${role}'`).join(', ')}]::text[]`;

export async function grantEveryConsoleRole(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`
    INSERT INTO identity.admin_console_role (account_id, role)
    SELECT a.id, r.role
      FROM identity.admin_account a
     CROSS JOIN unnest(${KNOWN}) AS r(role)
     WHERE a.role = 'platform_administrator' AND a.status <> 'removed'
    ON CONFLICT DO NOTHING
  `);
  await queryRunner.query(`
    UPDATE identity.admin_invitation SET console_roles = ${KNOWN}
     WHERE role = 'platform_administrator' AND status = 'pending'
  `);
}

export class ConsoleRoles1793750400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE identity.admin_console_role (
        account_id uuid        NOT NULL REFERENCES identity.admin_account(id) ON DELETE CASCADE,
        role       text        NOT NULL,
        granted_at timestamptz NOT NULL DEFAULT now(),
        granted_by uuid,
        PRIMARY KEY (account_id, role),
        CONSTRAINT admin_console_role_known CHECK (role = ANY (${KNOWN}))
      )
    `);
    await queryRunner.query(`GRANT SELECT, INSERT, DELETE ON identity.admin_console_role TO esg_app`);

    await queryRunner.query(`
      ALTER TABLE identity.admin_invitation
        ADD COLUMN console_roles text[] NOT NULL DEFAULT '{}',
        ADD CONSTRAINT admin_invitation_console_roles_known CHECK (console_roles <@ ${KNOWN})
    `);

    await grantEveryConsoleRole(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE identity.admin_invitation DROP COLUMN console_roles`);
    // Lossy by necessity: before this migration a Platform Administrator held every power, which is what dropping the
    // table restores.
    await queryRunner.query(`DROP TABLE identity.admin_console_role`);
  }
}
