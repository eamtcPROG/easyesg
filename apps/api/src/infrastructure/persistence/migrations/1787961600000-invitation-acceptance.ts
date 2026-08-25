import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The bearer's read of `identity.invitation` — UC-15, FR-11 (task 26.2).
 *
 * **The policies 26.1 deliberately did not write**, arriving with the code that needs them, exactly
 * as that migration said they would — one on `identity.invitation` so the bearer can read the
 * invitation, and one on `core.organization` so S-03 can name the organization doing the inviting. Every route in 26.1 was an administrator acting inside an
 * organization they already held; this is the opposite caller — someone who is not a member, may
 * not have an account, and holds nothing but a link.
 *
 * ── Why a third binding, and why it widens nothing ───────────────────────────────────────────────
 *
 * `app.current_org` cannot serve this read: UC-15's acceptor reads the invitation *before* they are
 * a member, so nothing has bound a tenant and 26.1's `invitation_tenant_select` answers zero rows.
 * `app.current_user` cannot serve it either — S-03 renders the inviting organization's name to a
 * visitor who is still **signed out**, which is the moment UC-15 step 2 has them deciding whether to
 * create an account at all.
 *
 * So the binding is the token itself: `app.current_invitation` holds the presented token's SHA-256,
 * and the policy says in SQL what is actually true — *the bearer of this token may read this one
 * row*. §12.5.6's task-26.2 row carries the decision.
 *
 * **It cannot widen a tenant request**, and that is a property of the binding rather than a promise:
 * a request that never sets `app.current_invitation` gets NULL from `current_setting(..., true)`,
 * and `token_hash = NULL` is NULL — never true — so the permissive policy contributes nothing to
 * the OR. Measured in five states before this was written: tenant-bound with no token reads its own
 * row and only that (26.1's behaviour, unchanged); unbound with no token, with the wrong token, and
 * with an empty token all read nothing; unbound with the right token reads exactly one row.
 *
 * **The `app.current_org IS NULL` conjunct that `organization_directory_select` carries is
 * deliberately NOT here**, and the difference between the two cases is the whole reason. There, the
 * qualifying condition — being a member — is true on every ordinary request, so without the
 * conjunct a normal tenant request would silently see more rows; the conjunct is load-bearing and
 * task 25.3 measured it. Here the qualifying condition is *knowing the token*, which no ordinary
 * request does and which is itself the capability the invitation grants: to read the row you must
 * already hold the value that was emailed to the person the row names. Adding the conjunct would
 * buy nothing against that and would make the policy's own sentence false — a signed-in bookkeeper
 * accepting their second client's invitation has a tenant bound, and the read must still work.
 *
 * **The application hashes; the wire never carries a hash.** `InvitationBearerStoreRepository`
 * binds `encode(sha256(<raw token>), 'hex')` computed from what the caller presented. A route that
 * accepted a hash directly would hand an attacker the one step the SHA-256-at-rest rule (NFR-64)
 * exists to make impossible — the stored value would become the credential.
 *
 * **`SECURITY DEFINER` was not an option**, and task 25.3 already measured why: `esg_migrator` owns
 * every table and `FORCE ROW LEVEL SECURITY` subjects an owner to its own policies, so a definer
 * function reading this table returns nothing. `SET row_security = off` raises rather than bypassing
 * for a forced-RLS owner. Escaping needs `BYPASSRLS`, which is cluster-level and lives outside the
 * migration ledger.
 *
 * ── The hex encoding, which is a decision and not a detail ───────────────────────────────────────
 *
 * A `set_config` value is `text`, and the stored column is `bytea`. `decode(..., 'hex')` is the
 * conversion, chosen over `::bytea` because a cast of a text literal goes through PostgreSQL's
 * *escape* format — where a byte such as `0x5c` is a backslash with its own meaning — so a token
 * hash containing one would decode to something other than itself and the lookup would silently
 * miss. `encode(hash, 'hex')` on the application side is its exact inverse.
 *
 * **`NULLIF` before `decode`**, for the reason every policy in this schema uses it: an unset
 * setting yields `''`, and `decode('', 'hex')` is an empty `bytea` rather than NULL — which would
 * compare against every row instead of none. It happens to match nothing today, since no
 * `token_hash` is empty, but the correctness would rest on the data rather than on the policy.
 */
export class InvitationAcceptance1787961600000 implements MigrationInterface {
  /**
   * The presented token's SHA-256, bound transaction-locally by the bearer store. `decode` rather
   * than a cast; `NULLIF` so an unset context is NULL and matches nothing. See the header.
   */
  private readonly presentedToken = `decode(NULLIF(current_setting('app.current_invitation', true), ''), 'hex')`;

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Permissive, so it is OR'd with `invitation_tenant_select` rather than qualifying it — S-16's
    // administrator keeps reading their organization's invitations exactly as before, and the
    // bearer reads one row from anywhere. SELECT only, deliberately: consuming an invitation is an
    // UPDATE, and it runs under a bound tenant (see below), so the bearer never holds a write
    // capability derived from merely knowing a token.
    await queryRunner.query(`
      CREATE POLICY invitation_bearer_select ON identity.invitation
        FOR SELECT USING (token_hash = ${this.presentedToken})
    `);

    // S-03 renders **the inviting organization's name**, and the bearer can reach neither existing
    // policy on the tenant root: `organization_tenant_select` wants a bound organization, and
    // `organization_directory_select` (task 25.3) wants an account that is already a member — which
    // the invitee is precisely not. So the same binding opens the same door one row wide.
    //
    // This is `organization_directory_select`'s shape with a different qualifying condition, and
    // the narrowness is deliberate for the same reason task 25.3 gives: task 29 is about to put
    // IDNO, registered address and contact details on this row, and a policy that admitted more
    // than the one organization an invitation names would put those outside the active tenant on a
    // request that has no tenant at all.
    //
    // It does not recurse. Evaluating it applies `identity.invitation`'s own policies, and the one
    // that admits the row — `invitation_bearer_select` above — reads a setting and references no
    // table.
    await queryRunner.query(`
      CREATE POLICY organization_invitation_select ON core.organization
        FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM identity.invitation i
             WHERE i.organization_id = core.organization.id
               AND i.token_hash = ${this.presentedToken}))
    `);

    // The consuming UPDATE is `invitation_tenant_update` (task 26.1) and needs no new policy, which
    // is worth stating because the absence looks like an omission. Acceptance binds the invitation's
    // OWN organization as `app.current_org` for the write — the acceptor is becoming a member of it
    // in the same transaction, and `membership_tenant_insert` requires that binding regardless. So
    // the tenant policies cover both writes, and the bearer policy stays read-only.

    // FR-11's "single-use" is a claim only the database can make, and this index is what lets it:
    // the consuming UPDATE is conditional on `status = 'pending'`, so two simultaneous acceptances
    // of one link produce one row update and one no-op rather than two memberships. The lookup
    // itself rides `identity.invitation`'s existing UNIQUE on `token_hash` (task 26.1).
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY organization_invitation_select ON core.organization`);
    await queryRunner.query(`DROP POLICY invitation_bearer_select ON identity.invitation`);
  }
}
