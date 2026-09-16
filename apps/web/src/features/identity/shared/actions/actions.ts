'use server';

import { getLocale } from 'next-intl/server';
import { endHeldSession } from '@/server/session/end-held-session';
import { redirect } from '@/i18n/navigation';
import { sanitizeReturnPath } from '@/lib/locale-path';
import { ROUTES } from '@/lib/routes';

/**
 * Server Actions for the identity journeys — the decided transport for unauthenticated identity
 * calls (task 20): the browser posts to the Next server tier, which calls the public API as the
 * ordinary client AD-9 says it is. The `/api/[...path]` pass-through stays scoped to traffic that
 * cannot go through this tier (wizard PATCH, offline drain, polls).
 *
 * An action is a projection and nothing more: the `api` client owns the wire conventions AND the
 * ambient context (the locale rides `Accept-Language` from inside the seam), `mapOutcome` owns the
 * failure passthrough, and what remains is the one per-endpoint fact — which members of the wire
 * DTO the screen needs. The API stays authoritative for every rule; the password policy is checked
 * client-side for feedback at the point of entry, but a bypassed form still meets the same policy as a
 * 400 here.
 *
 * **One `actions/` per journey** (task 134): this file kept sign-out, whose readers are the chrome
 * and S-03's permission state rather than any one journey; `register/`, `sign-in/`, `verify/`,
 * `reset/` and `invitation/` each carry their own beside the components that call them. **The one
 * identity request that is not an action here** is task 92's re-authentication dialogue, whose three
 * requests go to `/auth/session` handlers for the reasons `architecture.md` §12.5.6 records.
 */
/**
 * FR-5, UC-06. The two halves — the api's termination by refresh token, and the cookie cleared whatever
 * the api answered — are `endHeldSession`'s, shared since task 92 with the dialogue's sign-out, which
 * cannot be a Server Action; the reasons for each half are written there.
 */
export async function signOutAction(returnTo?: string): Promise<void> {
  await endHeldSession();

  // `returnTo` is S-03's permission state (task 26.3): someone opened an invitation while signed
  // in as a different address, and the way out is to sign out and come back to THIS invitation
  // rather than to a generic sign-in that loses the link. Sanitised like every other return path,
  // because it reaches this action through the browser and an unchecked one turns sign-out into an
  // open redirect — `proxy.ts` writes its own and this is the second writer.
  const back = sanitizeReturnPath(returnTo);
  const href = back
    ? `${ROUTES.SIGN_IN}?return=${encodeURIComponent(back.href)}`
    : ROUTES.SIGN_IN;
  redirect({ href, locale: back?.locale ?? (await getLocale()) });
}
