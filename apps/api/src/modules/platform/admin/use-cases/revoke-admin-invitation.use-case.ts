import type { Clock } from '@api/contracts/clock.port';
import { AdminInvitationNotFoundError } from '../errors/admin-invitation.errors';
import type { AdminAccountStore } from '../interfaces/admin-account-store.interface';

export interface RevokeAdminInvitationCommand {
  readonly invitationId: string;
}

/**
 * A-08's revoke (task 67.4): the link stops working at once, and the address is free to invite again.
 * The row stays, revoked, because an invitation is never erased — A-20 tells its bearer it was
 * withdrawn rather than that it never existed.
 */
export class RevokeAdminInvitation {
  constructor(
    private readonly store: AdminAccountStore,
    private readonly now: Clock,
  ) {}

  async execute(command: RevokeAdminInvitationCommand): Promise<void> {
    const at = this.now();
    await this.store.run(async (tx) => {
      if (!(await tx.revokeInvitation({ invitationId: command.invitationId, at }))) {
        throw new AdminInvitationNotFoundError();
      }
    });
  }
}
