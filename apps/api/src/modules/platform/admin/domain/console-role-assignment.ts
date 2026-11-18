import { ADMIN_ROLE, type AdminRole } from '../models/admin-session.model';
import type { ConsoleRole } from '../models/console-role.model';

/**
 * Whether a set of console roles fits the realm it is for (task 67.13; FR-80 behaviour 10; §12.5.6's task-67.13 row
 * (3), (5)): **a Platform Administrator holds one or more** — FR-80 AC-9 — and **a Billing Operator holds none**, the
 * realm being that account's authority until task 68. An invitation and a change on A-08 are both judged by it.
 */
export const consoleRolesFitRealm = (input: {
  readonly realm: AdminRole;
  readonly roles: readonly ConsoleRole[];
}): boolean =>
  input.realm === ADMIN_ROLE.PLATFORM_ADMINISTRATOR ? input.roles.length > 0 : input.roles.length === 0;
