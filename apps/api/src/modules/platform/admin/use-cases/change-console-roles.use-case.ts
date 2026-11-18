import type { Clock } from '@api/contracts/clock.port';
import { consoleRolesFitRealm } from '../domain/console-role-assignment';
import {
  AdminAccountNotFoundError,
  ConsoleRolesInvalidError,
  ConsoleRolesNotApplicableError,
  ConsoleRolesSelfError,
} from '../errors/admin-accounts.errors';
import type { AdminAccountStore } from '../interfaces/admin-account-store.interface';
import { ADMIN_ACCOUNT_STATUS, ADMIN_ROLE } from '../models/admin-session.model';
import { orderedConsoleRoles, type ConsoleRole } from '../models/console-role.model';

export interface ChangeConsoleRolesCommand {
  readonly accountId: string;
  /** The whole set the account will hold — not a delta, so a repeat is harmless. */
  readonly roles: readonly ConsoleRole[];
  /** The operator changing them, from the request context — never the body. */
  readonly operatorId: string;
}

/**
 * UC-87's assignment (task 67.13; FR-80 behaviour 10 and AC-9; §12.5.6's task-67.13 row (6)): an administrator holding
 * the permission to assign changes which roles another Platform Administrator holds, and the route's audit action
 * records it once (FR-81).
 *
 * **Refused for one's own account**, as a suspension is: separation of duties means another administrator widens or
 * narrows what you can do. That also keeps the role-assigning permission held — the operator acting holds it and
 * cannot remove it from themselves — so no change here can leave the realm with nobody able to assign, and no
 * last-holder count is needed. **Refused for a Billing Operator's or a removed account**, which hold none (row (3)),
 * and **for no role at all**, which FR-80 AC-9 rules out. Under the realm's lifecycle lock, so a suspension and a role
 * change of one account serialise.
 */
export class ChangeConsoleRoles {
  constructor(
    private readonly store: AdminAccountStore,
    private readonly now: Clock,
  ) {}

  async execute(command: ChangeConsoleRolesCommand): Promise<void> {
    const roles = orderedConsoleRoles(command.roles);
    const at = this.now();

    await this.store.run(async (tx) => {
      await tx.countActivePlatformAdministratorsUnderLock();
      const account = await tx.findAccount(command.accountId);
      if (account === null) throw new AdminAccountNotFoundError();
      if (account.id === command.operatorId) throw new ConsoleRolesSelfError();
      if (account.role !== ADMIN_ROLE.PLATFORM_ADMINISTRATOR || account.status === ADMIN_ACCOUNT_STATUS.REMOVED) {
        throw new ConsoleRolesNotApplicableError();
      }
      if (!consoleRolesFitRealm({ realm: account.role, roles })) throw new ConsoleRolesInvalidError();

      await tx.replaceConsoleRoles({ accountId: account.id, roles, grantedBy: command.operatorId, at });
    });
  }
}
