import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type QueryRunner } from 'typeorm';
import { toLocale } from '@easyesg/i18n';
import { hashInvitationToken } from '@api/modules/identity/invitation/domain/invitation-token';
import {
  MEMBERSHIP_GRANT_KIND,
  type InvitationBearerStore,
  type InvitationBearerTransaction,
  type MembershipGranted,
} from '@api/modules/identity/invitation/interfaces/invitation-bearer-store.interface';
import {
  INVITATION_STATUS,
  type BearerInvitation,
  type InvitationStatus,
  type InvitedRole,
} from '@api/modules/identity/invitation/models/invitation.model';
import {
  MEMBERSHIP_STATUS,
  type MembershipRole,
} from '@api/modules/identity/membership/models/membership.model';
import { CORE_DATA_SOURCE } from '../data-source';
import { countRecentAuthAttempts, recordAuthAttempt } from './auth-attempt.queries';

interface BearerInvitationRow {
  id: string;
  organization_id: string;
  organization_name: string;
  invited_email: string;
  role: InvitedRole;
  status: InvitationStatus;
  locale: string;
  issued_at: Date;
  expires_at: Date;
  accepted_at: Date | null;
  revoked_at: Date | null;
}

/**
 * The `InvitationBearerStore` adapter — and the **third** identity store that opens its own
 * transaction rather than borrowing the request's, for the sharpest reason of the three.
 *
 * `AccountStoreRepository` opens its own because registration precedes every tenant.
 * `AccountMembershipStoreRepository` opens its own because `organization_directory_select` is
 * conditioned on *no* organization being bound. This one opens its own because the request's
 * transaction is bound to the **wrong** tenant: the acceptor is signed in and may already hold an
 * active organization, so `TenantTransactionGuard` has bound the one they are currently in, not the
 * one inviting them. Borrowing it would have `invitation_tenant_select` answer zero rows and
 * `membership_tenant_insert` refuse the write — both silently plausible as "the link is invalid".
 *
 * ── The three bindings, and who sets each ────────────────────────────────────────────────────────
 *
 *  - **`app.current_invitation`** — set by `run`, always. The presented token's SHA-256 in hex,
 *    which `invitation_bearer_select` and `organization_invitation_select` both read.
 *  - **`app.current_user`** — set by `run` when there is an actor. The preview has none and must
 *    not: a signed-out visitor is exactly who S-03 serves.
 *  - **`app.current_org`** — set by the write methods, from the invitation's own organization.
 *    Deliberately not by `run` and not by the use case: it is a persistence concern, the value is
 *    not known until the invitation has been read, and a use case naming an RLS setting would put
 *    the tenancy model inside the domain.
 *
 * Each write binds the organization it was given rather than relying on a previous call having done
 * it. `set_config` is idempotent and costs a round trip nobody will measure; the alternative is a
 * method whose correctness depends on call order, which is the kind of coupling that survives review
 * and breaks when someone reorders two lines.
 *
 * **The transaction is what makes FR-11's single-use true.** Consuming the invitation, granting the
 * membership and pointing the session all commit together or not at all.
 */
@Injectable()
export class InvitationBearerStoreRepository implements InvitationBearerStore {
  constructor(@InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource) {}

  async run<T>(
    input: { readonly token: string; readonly actorId: string | null },
    work: (tx: InvitationBearerTransaction) => Promise<T>,
  ): Promise<T> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      // The store hashes; the wire never carries a hash. A route accepting one would make the
      // stored value the credential, which is precisely what NFR-64's SHA-256-at-rest rule denies.
      // Hex rather than a `::bytea` cast, because a cast reads PostgreSQL's *escape* format and a
      // hash containing `0x5c` would decode to something other than itself — a silent miss.
      await bind(runner, 'app.current_invitation', hashInvitationToken(input.token).toString('hex'));
      if (input.actorId !== null) await bind(runner, 'app.current_user', input.actorId);

      const result = await work(new BearerTransaction(runner));
      await runner.commitTransaction();
      return result;
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }
}

class BearerTransaction implements InvitationBearerTransaction {
  constructor(private readonly runner: QueryRunner) {}

  /**
   * No `WHERE token_hash = $1`, and that absence is the tenancy model working the way it does in
   * every other repository here: the policy is what scopes the read, and a predicate restating it
   * would be a second source of truth that drifts the moment either changes. Bound to nothing, this
   * returns nothing — fail-closed, not an error.
   *
   * The join to `core.organization` is reachable only because `organization_invitation_select`
   * exists; before task 26.2 it would have returned zero rows and the invitee would have been shown
   * an invitation from nobody.
   */
  async findInvitation(): Promise<BearerInvitation | null> {
    const rows = (await this.runner.query(
      `SELECT i.id, i.organization_id, o.name AS organization_name, i.invited_email, i.role,
              i.status, i.locale, i.issued_at, i.expires_at, i.accepted_at, i.revoked_at
         FROM identity.invitation i
         JOIN core.organization o ON o.id = i.organization_id`,
    )) as BearerInvitationRow[];

    const row = rows[0];
    if (row === undefined) return null;
    return {
      id: row.id,
      organizationId: row.organization_id,
      organizationName: row.organization_name,
      invitedEmail: row.invited_email,
      role: row.role,
      status: row.status,
      locale: toLocale(row.locale),
      issuedAt: row.issued_at,
      expiresAt: row.expires_at,
      acceptedAt: row.accepted_at,
      revokedAt: row.revoked_at,
    };
  }

  /** `identity.account` carries no RLS — an account exists before any organization does. */
  async findAccountEmail(accountId: string): Promise<string | null> {
    const rows = (await this.runner.query(`SELECT email FROM identity.account WHERE id = $1`, [
      accountId,
    ])) as { email: string }[];
    return rows[0]?.email ?? null;
  }

  async consume(input: { readonly invitationId: string; readonly at: Date }): Promise<boolean> {
    // The organization must be bound before this runs: `invitation_bearer_select` is a SELECT
    // policy and grants no write, so the UPDATE is admitted by `invitation_tenant_update` alone.
    // That is deliberate — knowing a token must not by itself confer the ability to write a row.
    await this.bindOrganizationOf(input.invitationId);

    const result: unknown = await this.runner.query(
      `UPDATE identity.invitation
          SET status = $2, accepted_at = $3, updated_at = $3
        WHERE id = $1 AND status = $4 RETURNING id`,
      [input.invitationId, INVITATION_STATUS.ACCEPTED, input.at, INVITATION_STATUS.PENDING],
    );
    const [rows] = result as [unknown[], number];
    return rows.length === 1;
  }

  /**
   * The read half needs only `app.current_user`, which `run` bound: `membership_self_select` lets
   * an account see its own rows in **any** organization, whether or not one is bound. That is task
   * 25.1's bootstrap policy earning its keep a second time, and it is why this can tell an existing
   * member from a removed one before any tenant is bound.
   */
  async grantMembership(input: {
    readonly accountId: string;
    readonly organizationId: string;
    readonly role: InvitedRole;
    readonly at: Date;
  }): Promise<MembershipGranted> {
    const existing = (await this.runner.query(
      `SELECT id, role, status FROM identity.membership
        WHERE account_id = $1 AND organization_id = $2`,
      [input.accountId, input.organizationId],
    )) as { id: string; role: MembershipRole; status: string }[];

    await bind(this.runner, 'app.current_org', input.organizationId);

    const row = existing[0];
    if (row === undefined) {
      await this.runner.query(
        `INSERT INTO identity.membership (account_id, organization_id, role) VALUES ($1, $2, $3)`,
        [input.accountId, input.organizationId, input.role],
      );
      return { kind: MEMBERSHIP_GRANT_KIND.CREATED, role: input.role };
    }

    if (row.status === MEMBERSHIP_STATUS.ACTIVE) {
      // §12.5.6's task-26.2 row: consumed, role untouched. Their existing role is what comes back,
      // which for an administrator is a role no invitation could have assigned.
      return { kind: MEMBERSHIP_GRANT_KIND.ALREADY_MEMBER, role: row.role };
    }

    // Task 25.1's arc: one row per (account, organization) ever, so a removed member is restored
    // rather than inserted a second time — the history reads as invited, removed, restored.
    await this.runner.query(
      `UPDATE identity.membership
          SET role = $2, status = $3, removed_at = NULL, updated_at = $4
        WHERE id = $1`,
      [row.id, input.role, MEMBERSHIP_STATUS.ACTIVE, input.at],
    );
    return { kind: MEMBERSHIP_GRANT_KIND.REACTIVATED, role: input.role };
  }

  /** §12.5.6's window, through the one shared implementation the other two stores use. */
  countRecentAuthAttempts(key: string, since: Date): Promise<number> {
    return countRecentAuthAttempts(this.runner, key, since);
  }

  recordAuthAttempt(key: string, at: Date): Promise<void> {
    return recordAuthAttempt(this.runner, key, at);
  }

  /** `identity.session` carries no RLS — it belongs to an account, not to a tenant (task 25.1). */
  async setActiveOrganization(input: {
    readonly sessionId: string;
    readonly organizationId: string;
  }): Promise<void> {
    await this.runner.query(
      `UPDATE identity.session SET active_organization_id = $2 WHERE id = $1`,
      [input.sessionId, input.organizationId],
    );
  }

  /**
   * Binds the invitation's **own** organization, read back through the bearer policy rather than
   * taken from the caller. Taking it as a parameter would let a caller bind any organization they
   * named and then write to it under `invitation_tenant_update`, which is the whole tenancy model
   * handed to whoever calls this method.
   */
  private async bindOrganizationOf(invitationId: string): Promise<void> {
    const rows = (await this.runner.query(
      `SELECT organization_id FROM identity.invitation WHERE id = $1`,
      [invitationId],
    )) as { organization_id: string }[];

    const row = rows[0];
    if (row === undefined) return;
    await bind(this.runner, 'app.current_org', row.organization_id);
  }
}

/**
 * `set_config(..., true)` — transaction-local, and a **bind parameter** rather than `SET LOCAL`,
 * which is utility syntax taking no parameter and would force interpolation into the values the
 * tenancy model rests on. Session-scoped binding is prohibited outright: PgBouncer's transaction
 * pooling would leak it to the next borrower of the connection.
 */
const bind = async (runner: QueryRunner, setting: string, value: string): Promise<void> => {
  await runner.query('SELECT set_config($1, $2, true)', [setting, value]);
};
