import type { Clock } from '@api/contracts/clock.port';
import {
  adminAccountChangeApplies,
  sessionRevocationFor,
  statusAfterAdminAccountChange,
  statusesAdminAccountChangeAppliesFrom,
  wouldLeaveNoPlatformAdministrator,
} from '../domain/admin-account-lifecycle';
import {
  AdminAccountChangeRefusedError,
  AdminAccountNotFoundError,
  AdminAccountSelfError,
  LastPlatformAdministratorError,
} from '../errors/admin-accounts.errors';
import type { AdminAccountStore } from '../interfaces/admin-account-store.interface';
import type { AdminAccountChange } from '../models/admin-account-change.model';

export interface ChangeAdminAccountStatusCommand {
  readonly accountId: string;
  readonly change: AdminAccountChange;
  /** The operator making the change, from the request context — never the body. */
  readonly actingAccountId: string;
}

/**
 * UC-87's lifecycle — suspend, reactivate, remove (task 67.4; FR-80; §12.5.6's task-67.4 row).
 *
 * **One use case for the three**, because they are one behaviour with one set of rules: the same
 * lock, the same refusals and the same conditional write, differing only in the row of
 * `admin-account-lifecycle.ts`'s tables they read. Three routes declare three audit actions over it.
 *
 * **The lock comes first**, before the account is read: the last-administrator count and the write
 * must see the same world, and two Platform Administrators suspending each other at once would
 * otherwise both count two and both succeed, leaving none.
 *
 * **The sessions end in the same transaction as the status**, so there is no instant at which the
 * account is suspended and a session of it could still be revived by a reactivation.
 */
export class ChangeAdminAccountStatus {
  constructor(
    private readonly store: AdminAccountStore,
    private readonly now: Clock,
  ) {}

  async execute(command: ChangeAdminAccountStatusCommand): Promise<void> {
    const at = this.now();
    const { change } = command;

    await this.store.run(async (tx) => {
      const activePlatformAdministrators = await tx.countActivePlatformAdministratorsUnderLock();

      const account = await tx.findAccount(command.accountId);
      if (account === null) throw new AdminAccountNotFoundError();
      if (account.id === command.actingAccountId) throw new AdminAccountSelfError();
      if (!adminAccountChangeApplies({ change, status: account.status })) {
        throw new AdminAccountChangeRefusedError(change);
      }
      if (wouldLeaveNoPlatformAdministrator({ account, change, activePlatformAdministrators })) {
        throw new LastPlatformAdministratorError();
      }

      const changed = await tx.changeStatus({
        accountId: account.id,
        from: statusesAdminAccountChangeAppliesFrom(change),
        to: statusAfterAdminAccountChange(change),
        at,
      });
      // Unreachable under the lock, and answered as the read would have been if it ever were not.
      if (!changed) throw new AdminAccountChangeRefusedError(change);

      const reason = sessionRevocationFor(change);
      if (reason !== null) await tx.revokeSessions({ accountId: account.id, reason, at });
    });
  }
}
