import type { Clock } from '@api/contracts/clock.port';
import { InvitationNotFoundError } from '../errors/invitation.errors';
import type { InvitationStore } from '../interfaces/invitation-store.interface';
import { INVITATION_STATUS } from '../models/invitation.model';

export interface RevokeInvitationCommand {
  readonly invitationId: string;
}

/**
 * UC-61's revoke half (FR-57) — "revocation invalidates the outstanding link immediately".
 *
 * **Immediately needs no code, and that is the design.** The link is a token looked up against a
 * row whose `status` this sets, so acceptance (task 26.2) refuses it on the invitee's very next
 * request without anything being invalidated, expired or swept. Anything that had cached the
 * token's validity would need a second mechanism to undo; nothing does, so nothing has to.
 *
 * **A revoked invitation is retained, not deleted** — FR-55's trail. No runtime role holds `DELETE`
 * on the table (task 26.1), so this is not a convention a later caller can route around, and "who
 * could have reached this data in March" stays answerable for an invitation issued in error and
 * withdrawn the same afternoon.
 *
 * Revoking frees the invited address: the partial unique index is over `status = 'pending'` alone,
 * so the administrator who revokes can immediately invite the same person again — at a different
 * role, which is the ordinary reason to.
 */
export class RevokeInvitation {
  constructor(
    private readonly store: InvitationStore,
    private readonly now: Clock,
  ) {}

  async execute(command: RevokeInvitationCommand): Promise<void> {
    const invitation = await this.store.findInvitation(command.invitationId);
    // Revoking an already-accepted invitation is not a no-op dressed as success: the person is a
    // member now, and withdrawing their access is UC-63 on a different resource with a different
    // consequence-disclosing confirmation (UX-70). Answering 404 sends the administrator to the
    // screen that can actually do what they meant.
    if (invitation === null || invitation.status !== INVITATION_STATUS.PENDING) {
      throw new InvitationNotFoundError();
    }

    if (!(await this.store.revoke({ invitationId: invitation.id, at: this.now() }))) {
      throw new InvitationNotFoundError();
    }
  }
}
