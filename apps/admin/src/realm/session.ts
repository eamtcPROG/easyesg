import { queryOptions } from '@tanstack/react-query';
import {
  API_OUTCOME,
  type AdminAccount,
  type AdminSessionResponse,
  type AdminSignInRequest,
  type ApiOutcome,
} from '@easyesg/contracts';
import { api } from './api-client';

/**
 * The administrative auth realm — session handling for `admin.<host>` (task 23).
 *
 * The session itself lives NOWHERE in this app: it is the sealed httpOnly cookie the api set
 * (OQ-17 — the token handler is `POST /auth/admin/session` on the api), rotated server-side
 * inside `GET`'s resolve. What this module holds is the console's *view* of it — the operator's
 * identity block — as a TanStack Query entry, because "am I signed in" is server state like any
 * other (§11.2) and the router's guard and the strip both read it.
 *
 * §12.5.6's task-23 rows carry the whole design: 8 h idle / 12 h absolute, `SameSite=Strict`,
 * mandatory TOTP (FR-75), and the CSRF stance the api enforces (Origin proof + CORS pinned to
 * this origin — which is why `vite.config.ts` deliberately has no dev proxy).
 */
export const ADMIN_SESSION_QUERY_KEY = ['admin-session'] as const;

/** The one route this realm speaks to — OQ-17's token handler. */
const ADMIN_SESSION_PATH = '/auth/admin/session';

/**
 * `null` means "no session — sign in", and it is a VALUE, not an error: the guard branches on
 * it, and an error would make Query retry an answer that is already final. Network failure
 * stays thrown, so an unreachable api reads as the error it is rather than as signed-out.
 */
export const adminSessionQuery = queryOptions({
  queryKey: ADMIN_SESSION_QUERY_KEY,
  queryFn: async (): Promise<AdminAccount | null> => {
    const outcome = await api.get<AdminSessionResponse>(ADMIN_SESSION_PATH);
    if (outcome.status === API_OUTCOME.Ok) return outcome.value.account;
    if (outcome.status === API_OUTCOME.Problem) return null;
    throw new Error('admin session probe: the API is unreachable');
  },
  // A 401 is final until someone signs in; a live session is re-proven on the realm's own
  // navigations rather than by a poll — the cookie's rotation happens server-side regardless.
  staleTime: 60 * 1000,
  retry: false,
});

export function signIn(command: AdminSignInRequest): Promise<ApiOutcome<AdminAccount>> {
  return api
    .post<AdminSignInRequest, AdminSessionResponse>(ADMIN_SESSION_PATH, command)
    .then((outcome) =>
      outcome.status === API_OUTCOME.Ok
        ? { ...outcome, value: outcome.value.account }
        : outcome,
    );
}

/** FR-5's shape for the realm: server-side revocation plus the cleared cookie, in one call. */
export function signOut(): Promise<ApiOutcome<undefined>> {
  return api.delete(ADMIN_SESSION_PATH);
}
