import { Injectable } from '@nestjs/common';
import { toLocale, type Locale } from '@easyesg/i18n';
import { emailIdentityKey } from '@api/modules/identity/account/domain/email-address';
import { InvitationAlreadyPendingError } from '@api/modules/identity/invitation/errors/invitation.errors';
import type { InvitationStore } from '@api/modules/identity/invitation/interfaces/invitation-store.interface';
import {
  INVITATION_STATUS,
  type Invitation,
  type InvitationStatus,
  type InvitedRole,
  type PendingInvitation,
} from '@api/modules/identity/invitation/models/invitation.model';
import { MEMBERSHIP_STATUS } from '@api/modules/identity/membership/models/membership.model';
import { writeOutboxEvent } from '@api/infrastructure/outbox/outbox-writer';
import { TenantRepository } from '../tenant-repository';

/** Rows as PostgreSQL returns them: snake_case, `timestamptz` already parsed to `Date` by `pg`. */
interface InvitationRow {
  id: string;
  organization_id: string;
  invited_email: string;
  role: InvitedRole;
  status: InvitationStatus;
  locale: string;
  issued_at: Date;
  expires_at: Date;
  accepted_at: Date | null;
  revoked_at: Date | null;
}

const INVITATION_COLUMNS =
  'id, organization_id, invited_email, role, status, locale, issued_at, expires_at, accepted_at, revoked_at';

/**
 * The `InvitationStore` adapter — the second repository extending `TenantRepository`, and it
 * inherits `MembershipStoreRepository`'s reasoning wholesale.
 *
 * `manager` resolves the request's `QueryRunner` from `AsyncLocalStorage` and **throws** when there
 * is none. That throw is the whole T-11 mitigation, because the alternative is not an error: RLS
 * returns zero rows for an unbound context, so a query that missed the request transaction would
 * report that the organization has invited nobody — and an administrator would believe it.
 *
 * **No statement below names an organization**, and none may. `app.current_org` is bound to the
 * transaction and the policies do the scoping; a `WHERE organization_id = $1` here would read as
 * prudence and would in fact be a second source of tenancy, drifting from the policy the moment
 * either changed.
 *
 * Every statement is schema-qualified, as the baseline requires: TypeORM's postgres driver sets no
 * `search_path`.
 *
 * Rows are typed with a **type argument** rather than an `as Row[]` assertion, because
 * `EntityManager.query` is generic and unoverloaded — the opposite spelling from the identity
 * repositories that hold a `QueryRunner` directly (`apps/api/CLAUDE.md` records both).
 */
@Injectable()
export class InvitationStoreRepository
  extends TenantRepository<never>
  implements InvitationStore
{
  protected readonly entity = 'identity.invitation' as never;

  async listPending(): Promise<PendingInvitation[]> {
    // Ordered by issuance so S-16's list is stable across a resend — which moves `issued_at`, and
    // would reorder the list under the reader if this ordered by that instead. `id` breaks the tie
    // deterministically, as `listActiveMembers` does.
    //
    // No expiry predicate, deliberately: this collection must publish exactly what
    // `invitation_pending_address_key` constrains, or an administrator gets a 409 for a row they
    // cannot see.
    const rows = await this.manager.query<InvitationRow[]>(
      `SELECT ${INVITATION_COLUMNS} FROM identity.invitation
        WHERE status = $1 ORDER BY created_at, id`,
      [INVITATION_STATUS.PENDING],
    );

    return rows.map((row) => ({
      id: row.id,
      invitedEmail: row.invited_email,
      role: row.role,
      issuedAt: row.issued_at,
      expiresAt: row.expires_at,
    }));
  }

  async findInvitation(invitationId: string): Promise<Invitation | null> {
    const rows = await this.manager.query<InvitationRow[]>(
      `SELECT ${INVITATION_COLUMNS} FROM identity.invitation WHERE id = $1`,
      [invitationId],
    );

    const row = rows[0];
    return row === undefined ? null : toInvitation(row);
  }

  /**
   * The join is to `identity.account`, which carries no RLS of its own — an account exists before
   * any organization does. It is safe precisely because the driving side is scoped: the membership
   * policy decides which memberships are visible, and the join can only reach the accounts those
   * name.
   */
  async hasActiveMemberWithEmail(email: string): Promise<boolean> {
    const rows = await this.manager.query<{ present: boolean }[]>(
      `SELECT EXISTS (
         SELECT 1 FROM identity.membership m
           JOIN identity.account a ON a.id = m.account_id
          WHERE m.status = $1 AND lower(a.email) = $2) AS present`,
      [MEMBERSHIP_STATUS.ACTIVE, emailIdentityKey(email)],
    );
    return rows[0].present;
  }

  /**
   * Reads `identity.account` unjoined and therefore across every tenant, which is correct and worth
   * being explicit about: the table carries no `organization_id` and no policy, because an account
   * precedes every organization. What comes back is one column that is not personal data and never
   * reaches the administrator — only the language their colleague's email is written in.
   */
  async findAccountLocale(email: string): Promise<Locale | null> {
    const rows = await this.manager.query<{ locale: string }[]>(
      `SELECT locale FROM identity.account WHERE lower(email) = $1`,
      [emailIdentityKey(email)],
    );

    const row = rows[0];
    return row === undefined ? null : toLocale(row.locale);
  }

  async issue(input: {
    readonly invitedEmail: string;
    readonly role: InvitedRole;
    readonly locale: Locale;
    readonly tokenHash: Buffer;
    readonly expiresAt: Date;
  }): Promise<Invitation> {
    // `organization_id` comes from the bound context rather than from the caller — the one place
    // this repository names it, because an INSERT has to supply the column the policy then checks.
    // `WITH CHECK` on `invitation_tenant_insert` is what makes that safe: a value other than the
    // bound organization is refused by the database, so this is not the tenancy decision, only its
    // restatement.
    try {
      const rows = await this.manager.query<InvitationRow[]>(
        `INSERT INTO identity.invitation
           (organization_id, invited_email, role, locale, token_hash, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ${INVITATION_COLUMNS}`,
        [
          this.organizationId,
          input.invitedEmail,
          input.role,
          input.locale,
          input.tokenHash,
          input.expiresAt,
        ],
      );
      return toInvitation(rows[0]);
    } catch (error) {
      if (isPendingAddressViolation(error)) throw new InvitationAlreadyPendingError();
      throw error;
    }
  }

  /**
   * `issued_at` moves with the token, which is what makes the resend legible on S-16 and in the
   * audit trail: the administrator sees when the *live* link was sent, not when the first one was.
   * `expires_at` moving is what makes the outbox idempotency key differ from the previous
   * issuance's, so the queue treats the resend as new work rather than as a duplicate.
   */
  async reissueToken(input: {
    readonly invitationId: string;
    readonly tokenHash: Buffer;
    readonly issuedAt: Date;
    readonly expiresAt: Date;
  }): Promise<boolean> {
    return this.wroteOneRow(
      `UPDATE identity.invitation
          SET token_hash = $2, issued_at = $3, expires_at = $4, updated_at = $3
        WHERE id = $1 AND status = $5 RETURNING id`,
      [
        input.invitationId,
        input.tokenHash,
        input.issuedAt,
        input.expiresAt,
        INVITATION_STATUS.PENDING,
      ],
    );
  }

  /**
   * The soft revocation FR-57 requires — and there is no hard one available to write by mistake:
   * `esg_app` holds no `DELETE` on this table (task 26.1), so a later author reaching for one gets
   * a privilege error rather than a silently destroyed record of who was offered access.
   */
  async revoke(input: { readonly invitationId: string; readonly at: Date }): Promise<boolean> {
    return this.wroteOneRow(
      `UPDATE identity.invitation
          SET status = $2, revoked_at = $3, updated_at = $3
        WHERE id = $1 AND status = $4 RETURNING id`,
      [input.invitationId, INVITATION_STATUS.REVOKED, input.at, INVITATION_STATUS.PENDING],
    );
  }

  /**
   * One row by construction: `app.current_org` is bound and `organization_tenant_select` admits
   * exactly that organization. A missing row would mean the binding names an organization that does
   * not exist, which `AuthGuard` cannot produce — so this reads the value rather than defending
   * against its absence, and would throw on `rows[0]` if the impossible happened.
   */
  async activeOrganizationName(): Promise<string> {
    const rows = await this.manager.query<{ name: string }[]>(
      `SELECT name FROM core.organization WHERE id = $1`,
      [this.organizationId],
    );
    return rows[0].name;
  }

  /**
   * On THIS runner, which is the whole reason the port exposes `emit` beside the writes rather than
   * as a separate dependency (P-8, AD-6). `organizationId` is left to default from the request
   * context, because an invitation belongs to exactly the tenant this request is acting for.
   */
  async emit(effect: {
    readonly eventType: string;
    readonly payload: Record<string, unknown>;
    readonly idempotencyKey: string;
  }): Promise<void> {
    await writeOutboxEvent(this.runner, {
      eventType: effect.eventType,
      payload: effect.payload,
      idempotencyKey: effect.idempotencyKey,
    });
  }

  /**
   * `UPDATE ... RETURNING` gives back `[rows, rowCount]`, not the bare row array a `SELECT` or an
   * `INSERT ... RETURNING` gives — TypeORM builds `raw` with a switch on the driver's `command`.
   * Normalising here rather than at each call site is the api CLAUDE.md's standing advice, and the
   * reason it is standing advice is that the mistake surfaces later as a `TypeError` on a property
   * of what should have been a row.
   */
  private async wroteOneRow(sql: string, parameters: unknown[]): Promise<boolean> {
    const result: unknown = await this.manager.query(sql, parameters);
    const [rows] = result as [unknown[], number];
    return rows.length === 1;
  }
}

const toInvitation = (row: InvitationRow): Invitation => ({
  id: row.id,
  organizationId: row.organization_id,
  invitedEmail: row.invited_email,
  role: row.role,
  status: row.status,
  locale: toLocale(row.locale),
  issuedAt: row.issued_at,
  expiresAt: row.expires_at,
  acceptedAt: row.accepted_at,
  revokedAt: row.revoked_at,
});

/**
 * `23505` is PostgreSQL's `unique_violation` SQLSTATE; the constraint name says *which* uniqueness
 * failed. Both are named rather than compared as bare literals (CLAUDE.md, "Conventions"), and the
 * rule's stated rationale is exactly the failure mode here: a typo in either makes the comparison
 * quietly false, the branch never fires, and a duplicate invitation answers `500` instead of `409`.
 *
 * `PENDING_ADDRESS_UNIQUE_INDEX` mirrors the index name in `1787875200000-identity-invitation.ts`,
 * which stays literal there because a migration is frozen history. Two copies, deliberately, changed
 * together by hand — the same shape as an `as const` object mirroring a CHECK.
 */
const UNIQUE_VIOLATION = '23505';
const PENDING_ADDRESS_UNIQUE_INDEX = 'invitation_pending_address_key';

const isPendingAddressViolation = (error: unknown): boolean => {
  const driverError = (error as { driverError?: { code?: string; constraint?: string } }).driverError;
  return (
    driverError?.code === UNIQUE_VIOLATION &&
    driverError.constraint === PENDING_ADDRESS_UNIQUE_INDEX
  );
};
