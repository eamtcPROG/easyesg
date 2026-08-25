import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `identity.invitation` — FR-11, FR-57 (task 26.1).
 *
 * **The schema is `identity`, not `core`.** Task 26.1's row in `docs/task.md` said
 * `core.invitation`; §7.1 lists invitations under `identity` and permits exactly one cross-schema
 * foreign key, "to `core.organization` only (membership target)" — which is what the reference
 * below is. The document governs and the tracking row was what was wrong; it has been corrected,
 * as task 25.1's was, for the same reason and in the same words.
 *
 * The second tenant-scoped table outside `core`, and it follows `identity.membership`'s pattern
 * exactly: `organization_id`, ENABLE **and** FORCE row-level security with its policies in this
 * same migration, per-field capture attached, and **no `DELETE` granted to any runtime role** —
 * revocation is a `status` change, so an invitation that was issued and withdrawn stays answerable
 * six months later.
 *
 * ── The three unknowns this table's shape encodes ────────────────────────────────────────────────
 *
 * Raised in task 26.1's batch and closed by the project owner on 25 Aug 2026; §12.5.6 carries the
 * normative rows, and each is one column or one index here.
 *
 *  1. **A resend rotates the token and restarts the seven days, on this row.** FR-57's "a resend
 *     delivers the same invitation" is satisfied by the *record*, not by the string: the row keeps
 *     its id, its role and its history, so S-16 shows one line per invited person. `token_hash` and
 *     `expires_at` are therefore mutable columns rather than write-once ones, and there is exactly
 *     one live link per invitation, ever — OQ-55's verification precedent applied to the third
 *     token kind.
 *  2. **`locale` is resolved at issue and stored**, from the invited address's account if one
 *     exists and from the inviting administrator's negotiated locale otherwise. FR-169 resolves
 *     email language per recipient and the worker has no `Accept-Language` to negotiate; for an
 *     invitee with no account there is no preference to honour, and the inviter's is the only
 *     evidence the request contains.
 *  3. **One pending invitation per address per organization**, as the partial unique index below.
 *
 * ── What is deliberately absent, so nobody completes it in passing ───────────────────────────────
 *
 *  - **No `invited_by_account_id`.** `core.capture_field_change` already attributes the INSERT to
 *    `app.current_user`, so a column would be a second copy of who invited whom — and the copy
 *    would be the one that goes stale, since it is the one a later `UPDATE` can rewrite. Nothing in
 *    FR-56 or S-16 asks for the inviter by name.
 *  - **No `expired` status.** Expiry is `expires_at` compared to the clock at the point of use,
 *    exactly as AD-12's session lifetimes are (§12.5.6, OQ-35). A stored status would need a sweep
 *    to maintain, and between sweeps the column would be wrong — which is worse than deriving it,
 *    because it *looks* authoritative.
 *  - **No acceptance policy.** UC-15's acceptor reads this row by token **before** they are a
 *    member, so `app.current_org` is unbound and the tenant SELECT policy answers zero rows. That
 *    is task 26.2's problem and gets task 26.2's policy — added by `CREATE POLICY` in that
 *    migration, beside the code that needs it, the way every grant in this schema has arrived.
 *    `status = 'accepted'` is in the CHECK already because the *vocabulary* is this table's design
 *    and the partial index below depends on it being complete: without it, 26.2 would have to leave
 *    a consumed invitation `pending` and the index would hold the address forever.
 *  - **Seat entitlement** (UC-60's precondition, UX-50's quota path) gates nothing. `EntitlementPort`
 *    has no implementation until task 54; the deferral is recorded on the task row.
 */
export class IdentityInvitation1787875200000 implements MigrationInterface {
  private readonly boundOrganization = `NULLIF(current_setting('app.current_org', true), '')::uuid`;

  public async up(queryRunner: QueryRunner): Promise<void> {
    // `token_hash` is the SHA-256 of a 256-bit random value and the raw token is never stored,
    // exactly as `identity.verification_token` does it and for §7.9's reason: an externally visible
    // token must not be a `uuidv7()`, because v7 ships its own creation time as a predictable
    // prefix. `id` is v7 because the row is internal; the two are different objects and this table
    // is the first to carry both.
    //
    // `bytea` rather than hex text — 32 bytes instead of 64, and the comparison is over the value
    // rather than over a chosen encoding of it.
    //
    // The role CHECK admits **two** values where `identity.membership` admits three, and that is
    // FR-57 in terms: a user is invited "with an edit or view-only role". Organization
    // Administrator is reached by UC-64's promotion after joining, never by invitation — which is
    // what keeps FR-60's lockout rule answerable from the membership table alone.
    //
    // The two instant/status CHECKs are the shape `account_verified_at_matches_status` and
    // `membership_removed_at_matches_status` already use: a state and the instant that produced it
    // cannot drift apart, because a future code path setting one and not the other would leave an
    // auditor unable to say when access was withdrawn.
    await queryRunner.query(`
      CREATE TABLE identity.invitation (
        id              uuid        PRIMARY KEY DEFAULT uuidv7(),
        organization_id uuid        NOT NULL REFERENCES core.organization(id) ON DELETE CASCADE,
        invited_email   text        NOT NULL,
        role            text        NOT NULL,
        status          text        NOT NULL DEFAULT 'pending',
        locale          text        NOT NULL,
        token_hash      bytea       NOT NULL UNIQUE,
        issued_at       timestamptz NOT NULL DEFAULT now(),
        expires_at      timestamptz NOT NULL,
        accepted_at     timestamptz,
        revoked_at      timestamptz,
        created_at      timestamptz NOT NULL DEFAULT now(),
        updated_at      timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT invitation_role_known CHECK (role IN ('editor', 'viewer')),
        CONSTRAINT invitation_status_known
          CHECK (status IN ('pending', 'accepted', 'revoked')),
        CONSTRAINT invitation_accepted_at_matches_status
          CHECK ((status = 'accepted') = (accepted_at IS NOT NULL)),
        CONSTRAINT invitation_revoked_at_matches_status
          CHECK ((status = 'revoked') = (revoked_at IS NOT NULL))
      )
    `);

    // The collision rule, held by the database rather than by the application's memory: two
    // simultaneous invitations of one address both pass a read-then-write check and one of them is
    // wrong. `lower(...)` because `identity.account` is unique on `lower(email)` for the same
    // reason — every mail provider in practice treats the local part case-insensitively, so
    // `Ana@x.md` and `ana@x.md` are one person.
    //
    // **Partial on `status = 'pending'`, which includes an expired-but-unrevoked invitation.** A
    // partial index cannot reference `now()` — it is not immutable — so this is the widest rule the
    // index can hold, and it is the right one anyway: the refusal names *resend* as its resolution,
    // and a resend is exactly what an expired invitation needs. Accepting or revoking frees the
    // address, which is what makes re-inviting a departed colleague possible at all.
    await queryRunner.query(`
      CREATE UNIQUE INDEX invitation_pending_address_key
        ON identity.invitation (organization_id, lower(invited_email))
        WHERE status = 'pending'
    `);

    // Default-deny: the baseline granted schema USAGE only, so each of these is a decision, and the
    // absences are the interesting part.
    //
    //  - **No DELETE for anyone.** FR-57's revocation is the `status` update, and FR-55 is why: an
    //    invitation issued in error and withdrawn is part of the answer to "who could have reached
    //    this data in March". With no privilege, a later author reaching for a hard delete gets an
    //    error rather than a quietly destroyed trail.
    //  - `esg_worker` gets nothing. The invitation email is dispatched from the outbox payload,
    //    which carries everything the handler needs (OQ-54) — so the worker never reads this table
    //    and must not be able to read a colleague's address out of it.
    //  - `esg_admin_ro` gets nothing yet. Support triage on "was an invitation sent" has no screen
    //    until FR-77 … FR-79 (task 67), and the grant arrives with the surface that needs it rather
    //    than in anticipation of one — the rule `identity.verification_token` already follows.
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE ON identity.invitation TO esg_app`);

    // ── Row-level security (DR-5, AD-2, NFR-63) ───────────────────────────────────────────────
    //
    // FORCE as well as ENABLE, per §7.6: `esg_migrator` owns this table and an owner is exempt from
    // its own policies regardless of `rolbypassrls`, so ENABLE alone would be inert for the owner
    // and invisible, because every probe run as `esg_app` would still pass.
    //
    // **Unlike `identity.membership`, this table needs no self-select bootstrap policy.** The
    // membership table is read to *produce* `app.current_org`, so scoping it to that binding would
    // make sign-in structurally impossible. Nothing derives the binding from an invitation: every
    // route in task 26.1 is an administrator acting inside an organization they already hold. The
    // one read that happens before a tenant exists is UC-15's acceptance, and it belongs to task
    // 26.2 along with the policy that admits it.
    await queryRunner.query(`ALTER TABLE identity.invitation ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE identity.invitation FORCE ROW LEVEL SECURITY`);

    await queryRunner.query(`
      CREATE POLICY invitation_tenant_select ON identity.invitation
        FOR SELECT USING (organization_id = ${this.boundOrganization})
    `);

    await queryRunner.query(`
      CREATE POLICY invitation_tenant_insert ON identity.invitation
        FOR INSERT WITH CHECK (organization_id = ${this.boundOrganization})
    `);

    // UC-61's resend (a token rotation) and revoke (a status change) are both this one policy. The
    // `WITH CHECK` is what stops a row being moved to another organization — `organization_id` is
    // an ordinary updatable column, and this table decides who gets to reach a tenant's data next.
    await queryRunner.query(`
      CREATE POLICY invitation_tenant_update ON identity.invitation
        FOR UPDATE USING (organization_id = ${this.boundOrganization})
                WITH CHECK (organization_id = ${this.boundOrganization})
    `);

    // Per-field capture (P-11, FR-54, FR-55, FR-159). TG_ARGV[0] names the tenant column; the rest
    // are ignored.
    //
    // `updated_at` is ignored for task 14's reason — it changes on every write and recording it
    // would say nothing twice. **`token_hash` is ignored for a different one:** capturing it would
    // write a credential's digest into the audit trail to record a fact the trail already carries,
    // since a resend necessarily moves `expires_at` and that change is captured with its actor. The
    // trail answers "who resent this, and when" without holding anything derived from the secret.
    await queryRunner.query(`
      CREATE TRIGGER capture_field_change
        AFTER INSERT OR UPDATE OR DELETE ON identity.invitation
        FOR EACH ROW EXECUTE FUNCTION
          core.capture_field_change('organization_id', 'updated_at', 'token_hash')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The trigger, the policies and the index all go with the table; none of them outlives it, so
    // none needs a separate drop. Dropped without CASCADE, per the baseline's rule: a revert that
    // refuses because something unexpected depends on this table is recoverable, and one that
    // succeeds by quietly dropping that something is not.
    await queryRunner.query(`DROP TABLE identity.invitation`);
  }
}
