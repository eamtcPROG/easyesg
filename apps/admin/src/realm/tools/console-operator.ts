import type { AdminAccount, AdminSessionResponse } from '@easyesg/contracts';

/**
 * The operator as the console holds them (task 67.13): who they are, and what their roles let them open — the session
 * answer's permissions, which the navigation and the console's home read. **Presentation, never the boundary**: every
 * route on the api judges its own permission, so a stale list hides or shows a link and refuses nothing.
 */
export type ConsoleOperator = AdminAccount & Pick<AdminSessionResponse, 'consoleRoles' | 'permissions'>;

/** The session answer's operator, as the realm's query caches it. */
export const operatorOf = (
  session: Pick<AdminSessionResponse, 'account' | 'consoleRoles' | 'permissions'>,
): ConsoleOperator => ({
  ...session.account,
  consoleRoles: session.consoleRoles,
  permissions: session.permissions,
});
