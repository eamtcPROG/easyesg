import type { Clock } from '@api/contracts/clock.port';
import { issueInvitationToken } from '../domain/invitation-token';
import { InvitationNotFoundError } from '../errors/invitation.errors';
import type { InvitationStore } from '../interfaces/invitation-store.interface';
import { INVITATION_STATUS } from '../models/invitation.model';
import { emitInvitationEmail } from './issue-invitation.use-case';

export interface ResendInvitationCommand {
  readonly invitationId: string;
}

/**
 * UC-61's resend half (FR-57).
 *
 * **A resend rotates the token and restarts the seven days, on the same row** — §12.5.6's
 * task-26.1 row, decided by the project owner on 25 Aug 2026. FR-57's acceptance criterion, "a
 * resend delivers the same invitation", is satisfied by the *record*: the row keeps its id, its
 * role and its change history, so S-16 shows one line per invited person and the trail reads as one
 * arc rather than as unrelated rows nothing joins. What does not survive is the previous link,
 * which is the property that makes this safe — exactly one live link per invitation, ever, which is
 * OQ-55's verification precedent applied to the third token kind.
 *
 * **Resending an expired invitation is permitted and is the point.** Nothing here consults the
 * clock: an invitation whose window has passed is still `pending`, and reminting its token is what
 * makes "they never got round to it" recoverable without revoke-and-reinvite. The alternative the
 * project owner declined — re-delivering the existing link — left that state unfixable.
 *
 * **The idempotency key moves with the expiry**, so this emit is a different outbox row from the
 * issuing one rather than a duplicate the queue discards. That is the same construction
 * `issueVerificationChallenge` relies on and it holds for the same reason: `expiresAt` changes on
 * every issuance and on nothing else.
 */
export class ResendInvitation {
  constructor(
    private readonly store: InvitationStore,
    private readonly now: Clock,
  ) {}

  async execute(command: ResendInvitationCommand): Promise<void> {
    const invitation = await this.store.findInvitation(command.invitationId);
    // An accepted or revoked invitation is not outstanding, and neither is another tenant's — RLS
    // has already answered that one with no row, which is why "not yours" and "not there" collapse
    // into a single 404 here rather than becoming a cross-tenant existence oracle.
    if (invitation === null || invitation.status !== INVITATION_STATUS.PENDING) {
      throw new InvitationNotFoundError();
    }

    const now = this.now();
    const token = issueInvitationToken(now);

    // Conditional on the row still being `pending`, so the claim is the database's. Inside one
    // request transaction it cannot have changed since the read above — treated as not-found rather
    // than ignored, because "cannot happen" is the assumption that stops holding when a later task
    // changes the caller.
    if (
      !(await this.store.reissueToken({
        invitationId: invitation.id,
        tokenHash: token.hash,
        issuedAt: now,
        expiresAt: token.expiresAt,
      }))
    ) {
      throw new InvitationNotFoundError();
    }

    // The row as it now stands, not as it was read: the payload's idempotency key is derived from
    // `expiresAt`, so emitting the pre-rotation values would reuse the issuing row's key and the
    // queue would discard the resend as a duplicate — the exact failure a resend exists to fix.
    await emitInvitationEmail(
      this.store,
      { ...invitation, issuedAt: now, expiresAt: token.expiresAt },
      token.value,
    );
  }
}
