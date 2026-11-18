import type { ConsoleRole } from '../models/console-role.model';

/**
 * The roles an operator holds, read when a request needs them (task 67.13; §12.5.6's task-67.13 row (7)) — on every
 * request to a route that declares a permission, and for the session's answer. **Never sealed into the cookie**: a role
 * taken away on A-08 must stop the next request, not the next rotation.
 */
export interface ConsoleRoleStore {
  rolesOf(read: { readonly accountId: string }): Promise<readonly ConsoleRole[]>;
}

export const CONSOLE_ROLE_STORE = Symbol('CONSOLE_ROLE_STORE');
