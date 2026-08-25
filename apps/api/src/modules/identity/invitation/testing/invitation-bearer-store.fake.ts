import { hashInvitationToken } from '../domain/invitation-token';
import {
  MEMBERSHIP_GRANT_KIND,
  type InvitationBearerStore,
  type InvitationBearerTransaction,
  type MembershipGranted,
} from '../interfaces/invitation-bearer-store.interface';
import {
  INVITATION_STATUS,
  type BearerInvitation,
  type InvitedRole,
} from '../models/invitation.model';
import {
  MEMBERSHIP_STATUS,
  type MembershipRole,
} from '@api/modules/identity/membership/models/membership.model';

interface FakeMembership {
  accountId: string;
  organizationId: string;
  role: MembershipRole;
  status: string;
}

/**
 * An in-memory `InvitationBearerStore` for the use-case specs — no database, no container.
 *
 * **It models the token as the lookup key**, which is what the policy does in production: `run`
 * resolves the row from the hash of the presented token and `findInvitation` takes no argument, so
 * a spec cannot accidentally read a row the token does not name. A fake keyed by invitation id
 * would let a use case pass the wrong id and still pass.
 *
 * **It models the conditional consume**, because that is where FR-11's single-use actually lives:
 * `consume` returns false on a row that is no longer `pending`, exactly as `UPDATE ... WHERE status
 * = 'pending'` does. A fake that always returned true would let the double-click spec pass while
 * the production path granted two memberships.
 *
 * It writes rather than recording calls, so a spec can assert the order-dependent things: that the
 * invitation is spent before the membership is granted, and that the session is pointed at the new
 * organization even when the caller was already a member.
 */
export class FakeInvitationBearerStore implements InvitationBearerStore {
  memberships: FakeMembership[] = [];
  activeOrganizationBySession: Record<string, string> = {};
  /** Every actor `run` was given, so a spec can prove the preview binds none. */
  readonly actors: (string | null)[] = [];
  /** §12.5.6's window rows, so a spec can prove a refused attempt still spent its budget. */
  readonly attempts: { key: string; at: Date }[] = [];

  constructor(
    private readonly invitations: BearerInvitation[] = [],
    /** Raw token → invitation id, so the fake resolves the way the policy does. */
    private readonly tokens: Record<string, string> = {},
    private readonly accounts: Record<string, string> = {},
  ) {}

  run<T>(
    input: { readonly token: string; readonly actorId: string | null },
    work: (tx: InvitationBearerTransaction) => Promise<T>,
  ): Promise<T> {
    this.actors.push(input.actorId);
    // Hashed here for no functional reason and one documentary one: it is what the real adapter
    // does, so a spec reading this fake sees that the raw token never becomes the lookup key.
    void hashInvitationToken(input.token);
    return work(new FakeBearerTransaction(this, this.tokens[input.token]));
  }

  /** @internal — the transaction reaches back through this rather than duplicating the rows. */
  find(invitationId: string | undefined): BearerInvitation | null {
    return this.invitations.find((row) => row.id === invitationId) ?? null;
  }

  /** @internal */
  replace(updated: BearerInvitation): void {
    const index = this.invitations.findIndex((row) => row.id === updated.id);
    this.invitations[index] = updated;
  }

  /** @internal */
  emailOf(accountId: string): string | null {
    return this.accounts[accountId] ?? null;
  }
}

class FakeBearerTransaction implements InvitationBearerTransaction {
  constructor(
    private readonly store: FakeInvitationBearerStore,
    private readonly invitationId: string | undefined,
  ) {}

  /**
   * The §12.5.6 window, modelled as rows rather than as a counter — so a spec can assert the thing
   * that actually matters: that a **refused** acceptance still spent its budget. A fake counting
   * only successes would let the throttle-rollback defect through unseen.
   */
  countRecentAuthAttempts(key: string, since: Date): Promise<number> {
    return Promise.resolve(
      this.store.attempts.filter((a) => a.key === key && a.at.getTime() >= since.getTime()).length,
    );
  }

  recordAuthAttempt(key: string, at: Date): Promise<void> {
    this.store.attempts.push({ key, at });
    return Promise.resolve();
  }

  findInvitation(): Promise<BearerInvitation | null> {
    return Promise.resolve(this.store.find(this.invitationId));
  }

  findAccountEmail(accountId: string): Promise<string | null> {
    return Promise.resolve(this.store.emailOf(accountId));
  }

  consume(input: { readonly at: Date }): Promise<boolean> {
    const row = this.requireResolved();
    if (row.status !== INVITATION_STATUS.PENDING) return Promise.resolve(false);
    this.store.replace({ ...row, status: INVITATION_STATUS.ACCEPTED, acceptedAt: input.at });
    return Promise.resolve(true);
  }

  grantMembership(input: {
    readonly accountId: string;
    readonly at: Date;
  }): Promise<MembershipGranted> {
    // Derived from the resolved invitation, exactly as the adapter does — a fake that took the
    // organization and the role as arguments would model a port that no longer accepts them, and
    // a spec passing the wrong ones would still pass.
    const invitation = this.requireResolved();
    const existing = this.store.memberships.find(
      (m) => m.accountId === input.accountId && m.organizationId === invitation.organizationId,
    );

    if (existing === undefined) {
      this.store.memberships.push({
        accountId: input.accountId,
        organizationId: invitation.organizationId,
        role: invitation.role,
        status: MEMBERSHIP_STATUS.ACTIVE,
      });
      return Promise.resolve({ kind: MEMBERSHIP_GRANT_KIND.CREATED, role: invitation.role });
    }

    if (existing.status === MEMBERSHIP_STATUS.ACTIVE) {
      return Promise.resolve({
        kind: MEMBERSHIP_GRANT_KIND.ALREADY_MEMBER,
        role: existing.role,
      });
    }

    existing.role = invitation.role;
    existing.status = MEMBERSHIP_STATUS.ACTIVE;
    return Promise.resolve({ kind: MEMBERSHIP_GRANT_KIND.REACTIVATED, role: invitation.role });
  }

  /**
   * Keyed by session AND account, because the adapter's statement is — a fake that ignored the
   * account would let a spec pass while production scoped the write and matched nothing.
   */
  setActiveOrganization(input: {
    readonly sessionId: string;
    readonly accountId: string;
  }): Promise<void> {
    this.store.activeOrganizationBySession[`${input.accountId}:${input.sessionId}`] =
      this.requireResolved().organizationId;
    return Promise.resolve();
  }

  /** The adapter throws here too: a write before `findInvitation` resolves nothing and must be loud. */
  private requireResolved(): BearerInvitation {
    const row = this.store.find(this.invitationId);
    if (row === null) {
      throw new Error(
        'The invitation must be resolved with findInvitation() before any write on this transaction.',
      );
    }
    return row;
  }
}

/** A bearer row with the fields a spec cares about named and the rest defaulted. */
export const bearerInvitation = (row: {
  id: string;
  invitedEmail?: string;
  role?: InvitedRole;
  status?: BearerInvitation['status'];
  expiresAt?: Date;
  organizationId?: string;
}): BearerInvitation => ({
  id: row.id,
  organizationId: row.organizationId ?? 'organization-alpha',
  // **Null once the invitation stops being pending**, because that is what the LEFT JOIN yields
  // under `organization_invitation_select`'s narrowing (26 Aug 2026). A fake that always supplied
  // a name would let a spec pass while production answered null — the exact drift that made an
  // inner join look correct until the e2e ran.
  organizationName:
    (row.status ?? INVITATION_STATUS.PENDING) === INVITATION_STATUS.PENDING ? 'Alpha SRL' : null,
  invitedEmail: row.invitedEmail ?? 'ana@example.md',
  role: row.role ?? 'editor',
  status: row.status ?? INVITATION_STATUS.PENDING,
  locale: 'ro',
  issuedAt: new Date('2026-08-20T00:00:00Z'),
  expiresAt: row.expiresAt ?? new Date('2026-08-27T00:00:00Z'),
  acceptedAt: null,
  revokedAt: null,
});
