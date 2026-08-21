import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `identity.session`, `identity.refresh_token`, `identity.password_reset_token`, the lockout
 * columns on `identity.credential`, and `identity.auth_attempt` — FR-4, FR-5, FR-6 (task 21;
 * FR-6 assigned here by OQ-56).
 *
 * Like task 19's tables these are **deliberately not RLS-scoped**: a session belongs to an
 * account, and an account exists before any organization does. The schema-invariant gate reaches
 * the same conclusion mechanically — nothing here is `core.*` and nothing carries
 * `organization_id`.
 *
 * **What is deliberately absent:**
 *
 *  - **An `active_organization_id` on `session`.** FR-12 makes the active organization
 *    session-scoped, but memberships do not exist until task 25 and a column nothing can populate
 *    would be a guess at that task's shape. It arrives by expand→migrate with the membership
 *    tables.
 *  - **Role or entitlement snapshots.** AD-12 is explicit that the session carries identity only;
 *    role and organization are read per request from the membership records, which is what makes
 *    FR-58's "next request, not next login" true by construction.
 *  - **A TTL column.** Idle (7 d) and absolute (30 d) lifetimes are §12.5.6 policy (OQ-35),
 *    evaluated at the point of use from `refresh_token.issued_at` and `session.created_at` — a
 *    stored expiry would freeze the policy of the day into every row and make a register change
 *    a data migration.
 */
export class IdentitySession1787443200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // The session is the REVOCABLE thing (AD-12): FR-5's logout, FR-6's reset-invalidates-all and
    // task 28's per-request lookup all resolve to this row. Its access tokens die by `exp` within
    // 15 minutes; revoking the session is what kills the refresh path immediately.
    //
    // `revoked_reason` is a closed vocabulary (CHECK, mirrored by SESSION_REVOKED_REASON in the
    // model — same pattern as `account_status_known`): when a pilot user reports being signed
    // out, the difference between their own sign-out, a password reset and a reuse-detection
    // trip is the whole diagnosis, and it is unrecoverable unless written at the moment it
    // happens. The second CHECK keeps reason and instant appearing together.
    await queryRunner.query(`
      CREATE TABLE identity.session (
        id             uuid        PRIMARY KEY DEFAULT uuidv7(),
        account_id     uuid        NOT NULL REFERENCES identity.account(id) ON DELETE CASCADE,
        created_at     timestamptz NOT NULL DEFAULT now(),
        revoked_at     timestamptz,
        revoked_reason text,
        CONSTRAINT session_revoked_reason_known
          CHECK (revoked_reason IN ('signed_out', 'refresh_reused', 'password_reset')),
        CONSTRAINT session_revocation_is_whole
          CHECK ((revoked_at IS NULL) = (revoked_reason IS NULL))
      )
    `);

    // FR-6 and FR-7 both need "every session for this account"; the reset flow walks this index.
    await queryRunner.query(`CREATE INDEX session_account_idx ON identity.session (account_id)`);

    // One row per issued refresh token, retained after rotation rather than overwritten in place.
    // The retained, consumed row is what makes reuse DETECTABLE: a presented token that matches a
    // consumed row is evidence someone holds a stolen copy — the rotation already replaced it for
    // the legitimate client — and the session is revoked on the spot. With only the current hash
    // stored, a rotated-away token would be indistinguishable from garbage and the signal lost.
    //
    // As everywhere (§7.9, NFR-64): the value is never stored, only its SHA-256; the row id is
    // uuidv7 because the ROW is internal — the unguessable thing is the token, which is not here.
    await queryRunner.query(`
      CREATE TABLE identity.refresh_token (
        id          uuid        PRIMARY KEY DEFAULT uuidv7(),
        session_id  uuid        NOT NULL REFERENCES identity.session(id) ON DELETE CASCADE,
        token_hash  bytea       NOT NULL UNIQUE,
        issued_at   timestamptz NOT NULL DEFAULT now(),
        consumed_at timestamptz
      )
    `);

    // AD-12's rotation invariant, stated where it cannot drift: a session has at most ONE live
    // refresh token. Rotation consumes the old row and inserts the new one in one transaction,
    // and this index is what makes a code path that forgot the consume step fail loudly rather
    // than accumulate parallel live tokens.
    await queryRunner.query(`
      CREATE UNIQUE INDEX refresh_token_live_key ON identity.refresh_token (session_id)
        WHERE consumed_at IS NULL
    `);

    // The reset token is NOT folded into `identity.verification_token` — task 19's migration
    // records why in advance: different lifetime (60 min vs 24 h, §12.5.6), and consuming one
    // does something different (replaces the credential and revokes every session, FR-6, versus
    // activating the account). Same shape, separate object.
    await queryRunner.query(`
      CREATE TABLE identity.password_reset_token (
        id          uuid        PRIMARY KEY DEFAULT uuidv7(),
        account_id  uuid        NOT NULL REFERENCES identity.account(id) ON DELETE CASCADE,
        token_hash  bytea       NOT NULL UNIQUE,
        issued_at   timestamptz NOT NULL DEFAULT now(),
        expires_at  timestamptz NOT NULL,
        consumed_at timestamptz
      )
    `);

    // Partial for the same reason as `verification_token_pending_idx`: the only question asked of
    // it is "does this account have a live reset challenge", so a reissue retires the previous one.
    await queryRunner.query(`
      CREATE INDEX password_reset_token_pending_idx ON identity.password_reset_token (account_id)
        WHERE consumed_at IS NULL
    `);

    // FR-4's lockout counters, on the credential rather than the account: what is being defended
    // is the password, and a provider-only account (FR-2, task 24) has no row here and nothing to
    // lock. Task 19's migration parked these "with sign-in, task 21" — this is that.
    //
    // 10 consecutive failures locks (§12.5.6); a success resets the count. `locked_at` is the
    // lock, not a derivation from the count, because the two releases — reset link (FR-6, this
    // task) and PA action (FR-77…79, task 67) — clear the lock without rewriting history.
    await queryRunner.query(`
      ALTER TABLE identity.credential
        ADD COLUMN failed_attempts integer NOT NULL DEFAULT 0,
        ADD COLUMN locked_at timestamptz
    `);

    // §12.5.6's application-level throttle: 5 attempts / 15 min per (IP, account) on the auth
    // paths. The per-ACCOUNT half cannot live at `edge` — Caddy has no idea which account a body
    // names — so this table is the sliding window: count the key's rows in the window, refuse
    // beyond the limit, insert otherwise. Refused attempts are deliberately NOT inserted, so a
    // block drains 15 minutes after the fifth processed attempt rather than rolling forever.
    //
    // The key holds an IP and a lower-cased address — personal data — so writes prune the whole
    // table's expired rows opportunistically: nothing outlives its 15-minute usefulness by more
    // than the gap to the next auth attempt anywhere in the system. No id column: the key is not
    // unique and no row is ever addressed individually.
    await queryRunner.query(`
      CREATE TABLE identity.auth_attempt (
        attempt_key  text        NOT NULL,
        attempted_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX auth_attempt_window_idx ON identity.auth_attempt (attempt_key, attempted_at)
    `);

    // Grants, each a decision (the baseline granted USAGE only):
    //
    //  - Everything here is `esg_app` alone. The worker addresses mail from the outbox payload
    //    (OQ-54) and never reads a token table; `esg_admin_ro` gets nothing until a support
    //    surface exists to need it (task 67), per the default-deny stance task 19 set.
    //  - No DELETE anywhere: revocation and consumption are UPDATEs, account deletion cascades
    //    from `identity.account` under the RI triggers' own authority, and the sweep that reclaims
    //    dead rows belongs to the Phase 6 scheduler alongside OQ-52's. `auth_attempt` is the one
    //    exception — its rows expire by construction in 15 minutes and the writer prunes them.
    await queryRunner.query(`
      GRANT SELECT, INSERT, UPDATE
        ON identity.session, identity.refresh_token, identity.password_reset_token TO esg_app
    `);
    await queryRunner.query(`GRANT SELECT, INSERT, DELETE ON identity.auth_attempt TO esg_app`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE identity.auth_attempt`);
    await queryRunner.query(`
      ALTER TABLE identity.credential DROP COLUMN failed_attempts, DROP COLUMN locked_at
    `);
    await queryRunner.query(`DROP TABLE identity.password_reset_token`);
    await queryRunner.query(`DROP TABLE identity.refresh_token`);
    await queryRunner.query(`DROP TABLE identity.session`);
  }
}
