import { ROUTES, type RoutePath } from '@/lib/routes';
import { readSession } from '@/server/session/session';

/**
 * Where a reader who has arrived at no screen is sent back to.
 *
 * Shared by the two §8.1 address states — `error — not found` and `error — not yet available`
 * (design_spec.md §4.5, task 103) — because both ask the same question and neither owns the
 * answer. Both surfaces render outside any route group's layout or inside `(public)`'s, so
 * neither can assume a session: `/legal/terms` is reachable signed out and `/billing` is not.
 *
 * **It reads the session rather than taking the destination as a prop**, and that is the whole
 * reason it exists. The alternative is every stub page passing the right route, each one a chance
 * to pass the wrong one — and the failure is silent, because `/home` handed to a
 * signed-out reader does not error, it bounces through the proxy to sign-in with a `?return=`
 * they never asked for.
 */
export const RETURN_DESTINATION = {
  HOME: 'home',
  SIGN_IN: 'signIn',
} as const;

export type ReturnDestination = (typeof RETURN_DESTINATION)[keyof typeof RETURN_DESTINATION];

export async function returnDestination(): Promise<{
  readonly href: RoutePath;
  readonly kind: ReturnDestination;
}> {
  // `readSession` answers null for a missing, unsealable or expired cookie alike — every one of
  // which means the same thing here, so no branch distinguishes them.
  return (await readSession())
    ? { href: ROUTES.HOME, kind: RETURN_DESTINATION.HOME }
    : { href: ROUTES.SIGN_IN, kind: RETURN_DESTINATION.SIGN_IN };
}
