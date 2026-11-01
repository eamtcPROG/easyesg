import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `organization_invitation_select` applies to the application role alone (task 44.2).
 *
 * **The worker could not read its own tenant root.** The policy lets a request bearing an invitation read the inviting
 * organization's name (task 26.2), and it reads `identity.invitation` to do so. PostgreSQL checks the reader's
 * privileges on every relation any applicable policy names, and every policy here was `TO PUBLIC` — so `esg_worker`,
 * which holds no grant on the invitations and needs none, was refused *every* read of `core.organization`, inside its
 * own organization too, with `permission denied for table invitation`. The export's job is the first worker code to
 * read the organization (the calculator's report read joins it for the country), and it met this at once.
 *
 * **Scoped to `esg_app` rather than granting the worker the table.** The invitations hold token hashes, and the worker
 * has no request that could bear one. And the reason `1787184000000-organization-rls.ts` gives for `TO PUBLIC` does not
 * reach this policy: a role named on a *permissive* policy is a role granted visibility, so a role added later without
 * it sees less, never more — the fail-closed direction, where an unnamed role on a filter would be the fail-open one.
 */
export class OrganizationInvitationPolicyRole1792800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER POLICY organization_invitation_select ON core.organization TO esg_app`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER POLICY organization_invitation_select ON core.organization TO PUBLIC`);
  }
}
