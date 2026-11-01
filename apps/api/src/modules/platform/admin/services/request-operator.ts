import { requestContext } from '@api/infrastructure/persistence/request-context';
import { AdminSessionInvalidError } from '../errors/admin-session.errors';

/**
 * The operator an admin-realm request acts for (task 67.4) — what `AdminRealmGuard` wrote into the
 * request context as `adminAccountId`. **A service resolves it here and never from a body**: an
 * operator who could name the inviter or the actor in a request could attribute a change to someone
 * else, and the audit log's whole value is that they cannot.
 *
 * Absent only on a route that escaped the guard, which the permission table rules out; it refuses as
 * a signed-out request would rather than acting for nobody.
 */
export const requestOperatorId = (): string => {
  const operatorId = requestContext()?.adminAccountId;
  if (operatorId === undefined) throw new AdminSessionInvalidError();
  return operatorId;
};

/**
 * The admin session the request acts on (task 144) — `AdminRealmGuard` writes it beside the operator, and
 * `requestOperatorId`'s rule holds: from the request, never the body, or a caller could nominate which of
 * their sessions a password change spares.
 */
export const requestOperatorSessionId = (): string => {
  const sessionId = requestContext()?.adminSessionId;
  if (sessionId === undefined) throw new AdminSessionInvalidError();
  return sessionId;
};
