import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Narrows `organization_invitation_select` to a **live** invitation — 26 Aug 2026 review.
 *
 * Task 26.2 keyed the policy on the bound token alone, so the bearer of any invitation naming an
 * organization could read that organization's row — including the bearer of one accepted last month
 * or revoked by an administrator this morning. Nothing leaked: `PreviewInvitation` withholds the
 * details for every standing but `acceptable`, so the disclosure was bounded by application code.
 *
 * **That is exactly the arrangement task 26.2's own header argued against.** It cites task 25.3's
 * reasoning for keeping the sibling policy narrow — "task 29 is about to put IDNO, registered
 * address and contact details on this row" — and then did not apply it here. A policy wider than
 * the product rule is a gap waiting for the first reader who does not know to withhold, and the
 * next task adds four columns worth having.
 *
 * **The invitation policy is deliberately NOT narrowed the same way.** `invitation_bearer_select`
 * must keep admitting spent and revoked rows, because the preview's whole job is telling the holder
 * of a dead link *which* kind of dead it is — S-03 draws expired, already-used and revoked as three
 * separate recoverable states. The two policies answer different questions, and the asymmetry is
 * the point: the invitation's own standing is disclosable to its bearer, the organization behind a
 * spent link is not.
 *
 * Nothing in the acceptance path breaks. `findInvitation` joins the tenant root **before** `consume`
 * flips the status, and every later read comes from the row that join already returned; the writes
 * bind `app.current_org` and go through `invitation_tenant_update` and `membership_tenant_insert`,
 * neither of which consults this policy.
 */
export class InvitationPolicyNarrowing1788048000000 implements MigrationInterface {
  private readonly presentedToken = `decode(NULLIF(current_setting('app.current_invitation', true), ''), 'hex')`;

  /**
   * The literal `'pending'` matches the migration-SQL exception in CLAUDE.md's closed-vocabulary
   * rule: a migration is frozen history, and interpolating a constant that can later be renamed
   * would silently rewrite what this history says. It mirrors `invitation_status_known`.
   */
  private readonly organizationOfLiveInvitation = `
    EXISTS (
      SELECT 1 FROM identity.invitation i
       WHERE i.organization_id = core.organization.id
         AND i.token_hash = ${this.presentedToken}
         AND i.status = 'pending')`;

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Replaced rather than altered: `ALTER POLICY` exists, but a drop-and-create leaves the whole
    // expression in one place in the history, which is what someone auditing "who could read this
    // organization" will actually read.
    await queryRunner.query(`DROP POLICY organization_invitation_select ON core.organization`);
    await queryRunner.query(`
      CREATE POLICY organization_invitation_select ON core.organization
        FOR SELECT USING (${this.organizationOfLiveInvitation})
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY organization_invitation_select ON core.organization`);
    await queryRunner.query(`
      CREATE POLICY organization_invitation_select ON core.organization
        FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM identity.invitation i
             WHERE i.organization_id = core.organization.id
               AND i.token_hash = ${this.presentedToken}))
    `);
  }
}
