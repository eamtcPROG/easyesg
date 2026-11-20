import { Inject, Injectable } from '@nestjs/common';
import { CONSOLE_ROLE_STORE, type ConsoleRoleStore } from '../interfaces/console-role-store.interface';
import { permissionsOf, type AdminPermission, type ConsoleRole } from '../models/console-role.model';

/** What an operator holds: their roles, and the permissions those roles hold together. */
export interface ConsoleGrant {
  readonly roles: readonly ConsoleRole[];
  readonly permissions: readonly AdminPermission[];
}

/**
 * The operator's roles and permissions as they stand (task 67.13; FR-80 behaviour 10) — read by `AdminRealmGuard`
 * for a route that declares a permission, and by the session's answer, which the console's navigation reads to show
 * only what an operator may open. The navigation is presentation; the guard is the boundary.
 */
@Injectable()
export class ConsolePermissionsService {
  constructor(@Inject(CONSOLE_ROLE_STORE) private readonly roles: ConsoleRoleStore) {}

  async grantOf(input: { readonly accountId: string }): Promise<ConsoleGrant> {
    const roles = await this.roles.rolesOf(input);
    return { roles, permissions: permissionsOf(roles) };
  }
}
