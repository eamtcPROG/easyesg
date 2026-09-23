import { setupHasLapsed } from '@api/modules/identity/account/domain/account-expiry';
import { ACCOUNT_STATUS } from '@api/modules/identity/account/models/account.model';
import { sessionHasExpired } from '@api/modules/identity/session/domain/session-expiry';
import type { ResolvedRequestIdentity } from '@api/modules/identity/session/interfaces/request-identity-store.interface';

/**
 * Whether a session may open a socket at the moment its ticket is presented (task 147; §12.5.6's task-147 ticket row)
 * — **`AuthGuard`'s judgement of an ordinary route, from the same helpers**: not ended, not expired, not an account
 * past its setup deadline, and not one still in setup, since the socket is not a setup route. Re-read at the upgrade
 * rather than trusted from the mint, because thirty seconds is long enough for a sign-out.
 */
export const sessionAdmitsSocket = (identity: ResolvedRequestIdentity, now: Date): boolean =>
  identity.revokedAt === null &&
  !sessionHasExpired(identity.anchors, now) &&
  !setupHasLapsed(identity.account, now) &&
  identity.account.status !== ACCOUNT_STATUS.AWAITING_SETUP;
