import type { Locale } from '@easyesg/i18n';
import type { Clock } from '@api/contracts/clock.port';
import { normaliseEmail } from '@api/modules/identity/account/domain/email-address';
import { INVITATION_ISSUED, type InvitationIssued } from '../constants/invitation.constants';
import { issueInvitationToken } from '../domain/invitation-token';
import { AlreadyMemberError } from '../errors/invitation.errors';
import type { InvitationStore } from '../interfaces/invitation-store.interface';
import type { Invitation, InvitedRole } from '../models/invitation.model';

export interface IssueInvitationCommand {
  readonly email: string;
  readonly role: InvitedRole;
  /**
   * Negotiated from the inviting administrator's `Accept-Language` (OQ-46), used only when the
   * invited address has no account of its own. Resolved by `InvitationService` from ambient request
   * context, which is why the controller never supplies it — the same seam `AccountService` uses
   * for registration.
   */
  readonly inviterLocale: Locale;
}

/**
 * UC-60 — invite a user to the organization (FR-57), and the issuing half of FR-11.
 *
 * Framework-free, as `domain-free-of-frameworks` requires: no `@Injectable`, no TypeORM, no HTTP.
 * `invitation.module.ts` constructs it with `useFactory`.
 *
 * It reads as UC-60's main success scenario — an address, a role, an invitation issued through the
 * common notification mechanism — with the two refusals §12.5.6's collision row decided placed
 * where each can actually be enforced.
 *
 * **The email is an outbox row, not a send** (P-8, AD-6). Sending inside the transaction is the
 * dual write AD-10 rejects, and here its failure is concrete: roll back after the send and a
 * colleague holds a working link into an organization that never invited them.
 *
 * **No `run()` and no transaction of its own.** Every statement below is on the request's
 * `QueryRunner`, so the invitation row and the outbox row commit with the request or not at all.
 *
 * **No entitlement gate**, and that is a recorded deferral rather than an omission: UC-60's
 * precondition is seat entitlement and UX-50 draws the quota path, but `EntitlementPort` has no
 * implementation until task 54 and `EntitlementGuard` does not exist. What closes it is one
 * `@RequiresEntitlement('org.seats.max')` on the route.
 */
export class IssueInvitation {
  constructor(
    private readonly store: InvitationStore,
    private readonly now: Clock,
  ) {}

  async execute(command: IssueInvitationCommand): Promise<Invitation> {
    const invitedEmail = normaliseEmail(command.email);

    // The membership collision, checked rather than constrained — the two tables cannot share an
    // index, and no constraint can express "not an active member of this organization" across them.
    // It is a read-then-write check and therefore racy in principle: an invitation issued in the
    // same instant a membership is created would pass. That race is benign and the alternative is
    // not — the losing outcome is one redundant invitation, which acceptance (task 26.2) resolves
    // by finding the person already a member, while a trigger enforcing it would put a cross-table
    // rule in the one place `esg_app` cannot be made to see it fail.
    if (await this.store.hasActiveMemberWithEmail(invitedEmail)) throw new AlreadyMemberError();

    // FR-169, resolved here and stored, so every resend of this invitation speaks the same language
    // and the worker needs no fallback of its own (§12.5.6, task 26.1).
    const locale = (await this.store.findAccountLocale(invitedEmail)) ?? command.inviterLocale;

    const token = issueInvitationToken(this.now());

    // The pending-address collision is the index's to refuse, and the store translates it. Nothing
    // reads first: two simultaneous invitations of one address both pass a read-then-write check
    // and one of them is wrong (`RegisterAccount` records the same reasoning for registration).
    const invitation = await this.store.issue({
      invitedEmail,
      role: command.role,
      locale,
      tokenHash: token.hash,
      expiresAt: token.expiresAt,
    });

    await emitInvitationEmail(this.store, invitation, token.value);

    return invitation;
  }
}

/**
 * Commits the intent to email an invitation, on the caller's transaction.
 *
 * A free function rather than a method on either use case, for `issueVerificationChallenge`'s
 * reason: `IssueInvitation` and `ResendInvitation` do exactly this and the two must not diverge —
 * a resend carrying a different template, event name or idempotency scheme would be a second
 * invitation flow wearing the first one's name.
 *
 * A `Pick`, not the whole store (ISP): it needs exactly these two operations, and the narrowing is
 * what says the shared step reads nothing else and writes nothing else.
 */
export async function emitInvitationEmail(
  store: Pick<InvitationStore, 'emit' | 'activeOrganizationName'>,
  invitation: Invitation,
  token: string,
): Promise<void> {
  const payload: InvitationIssued = {
    invitationId: invitation.id,
    organizationName: await store.activeOrganizationName(),
    email: invitation.invitedEmail,
    locale: invitation.locale,
    // The raw value, which exists nowhere else once this returns — the table holds its SHA-256.
    // OQ-54 records the decision and what bounds the exposure.
    token,
  };

  await store.emit({
    eventType: INVITATION_ISSUED,
    payload: { ...payload },
    // A natural key, as AD-6 asks: one invitation, one issuance window. A re-emitted row after a
    // dispatcher crash carries the same key and is discarded by the queue rather than sending a
    // second email — while a genuine resend has rotated `expiresAt` and is therefore a different
    // key, which is the behaviour that matters in both directions. It is the same construction
    // `issueVerificationChallenge` uses, and it works here for the same reason: the expiry moves
    // with every issuance and with nothing else.
    idempotencyKey: `${INVITATION_ISSUED}:${invitation.id}:${invitation.expiresAt.getTime()}`,
  });
}
