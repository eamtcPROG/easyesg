import type { Clock } from '@api/contracts/clock.port';
import { AdminAccountNotFoundError, AdminAccountNotLockedError } from '../errors/admin-accounts.errors';
import type { AdminAccountStore } from '../interfaces/admin-account-store.interface';

export interface ReleaseAdminLockoutCommand {
  readonly accountId: string;
}

/**
 * A-08's lockout release (task 67.4) — **what supersedes `admin:provision --unlock`** as the realm's
 * release (task 23's third deferral), which keeps working as the bootstrap's.
 *
 * It clears the lock and the failure count together, so the released operator gets the whole of
 * §12.5.6's threshold back rather than one attempt before locking again. **A release against an
 * account that is not locked is refused**, not answered as success: the route's audit action would
 * otherwise record a change that did not happen.
 *
 * An operator may release their own lockout — a lock set by someone else guessing at their address
 * while they hold a live session is the ordinary way it happens, and refusing it would send them to a
 * colleague to undo an attacker's work.
 */
export class ReleaseAdminLockout {
  constructor(
    private readonly store: AdminAccountStore,
    private readonly now: Clock,
  ) {}

  async execute(command: ReleaseAdminLockoutCommand): Promise<void> {
    const at = this.now();

    await this.store.run(async (tx) => {
      const account = await tx.findAccount(command.accountId);
      if (account === null) throw new AdminAccountNotFoundError();
      if (!(await tx.releaseLockout({ accountId: account.id, at }))) {
        throw new AdminAccountNotLockedError();
      }
    });
  }
}
