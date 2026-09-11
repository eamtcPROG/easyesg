import 'server-only';
import type { Locale } from '@easyesg/i18n';
import { redirect } from '@/i18n/navigation';
import { targetLocale } from '@/features/identity/post-sign-in';
import { destinationForHeldSession } from './post-sign-in';
import { readSession } from './session';

/**
 * The closed-by-default gate's other direction: a reader who **already holds a session** does not
 * belong on a screen whose job is to issue one (task 112).
 *
 * `proxy.ts` has turned an anonymous caller away from an authenticated address since task 22, and
 * nothing did the reverse — so a signed-in reader who typed `/sign-in`, followed a bookmark or hit
 * back after signing in was served the form again, and submitting it **replaced their live session
 * in place**. On `/register` the same page created a second account and swapped the session to it
 * silently. Which routes those are is `route-access.ts`'s `SESSION_ISSUING_SEGMENTS`, deliberately
 * narrower than the set beside it: `/reset` and `/set-password` recover a credential and must stay
 * reachable, because a reset link is followed on whatever device is to hand and that device is
 * frequently already signed in.
 *
 * **Where it does not go is the proxy, and the reason is the destination rather than the
 * predicate.** The gate's own answer is one address — `/sign-in` — but this one's is §4.3's branch:
 * none → S-04, one or several → S-05, and a failed membership read → S-35. Sending everyone to
 * `/home` would land a member-of-nothing in the empty workspace task 25.4 refused for exactly this
 * reason, stating as a fact that they belong to an organization we cannot name. Resolving that
 * branch needs `api-client`, which reads the request's cookies through `next/headers` — a scope the
 * proxy does not have, as `proxy.spec.ts` asserts by mocking `cookies()` to reject. So the branch is
 * resolved where it can be, during render, and the proxy's contribution is to rotate a stale access
 * token first so the read is not answered 401.
 *
 * **A Server Component may call this because it only reads.** `api-client` never rotates, which is
 * what makes it legal here (a cookie write during render throws) — the same property
 * `organization-unavailable/page.tsx` relies on to re-resolve the branch on every render.
 *
 * It cannot loop: every destination the branch can answer is inside `(app)`, and no `(app)` route
 * issues a session.
 *
 * **It has exactly one caller, and that is the point.** `(identity)/(session-issuing)/layout.tsx`
 * gates the whole route group at once, so membership of that directory is the predicate and there
 * is nothing for a new screen to remember. The first draft called this from each page instead —
 * which is the shape task 105 was raised against, a rule every consumer must re-apply, where the
 * copy that goes missing is invisible to every gate.
 */
export const redirectWhenSignedIn = async (input: {
  /** The route's own locale, from the layout's `params` — used where the destination names none. */
  readonly locale: Locale;
}): Promise<void> => {
  if (!(await readSession())) return;

  // **No `?return=`, and that is the shape's one cost.** A layout cannot see `searchParams`, and
  // the branch's own destination is the right answer for a request that already carries a session:
  // a `?return=` arriving here is a leftover from a bounce something else has since answered, not
  // UX-38's mid-work expiry — that reader has no session and never reaches this line.
  const target = await destinationForHeldSession();
  redirect({ href: target.href, locale: targetLocale(target, input.locale) });
};
