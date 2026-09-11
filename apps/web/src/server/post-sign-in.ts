import 'server-only';
import type { AccountMembership } from '@easyesg/contracts';
import { API_OUTCOME } from '@/lib/api-outcome';
import { sanitizeReturnPath } from '@/lib/locale-path';
import { postSignInTarget, type PostSignInTarget } from '@/features/identity/post-sign-in';
import { api } from './api-client';
import { readMemberships } from './memberships';

/**
 * The server seam for §4.3's branch: read the caller's memberships, then decide (task 25.4).
 *
 * **There are two of these and the difference is not the cache — it is which session is being asked
 * about** (11 Sep 2026, task 112's follow-on; `architecture.md` §12.5.6). `resolvePostSignIn` asks
 * about the session *this request has just created*; `destinationForHeldSession` asks about the one
 * *this request arrived with*. Only the second may use the memoized read, and the reason is below.
 *
 * **A failure is `null`, not an empty list.** `[]` means the account genuinely belongs to nothing
 * and belongs on S-04; `null` means we could not find out, and belongs on S-35. `api-client`'s
 * `unreachable` outcome — a timeout, a gateway failure, the API down — lands in the same arm as a
 * problem document, because to the person waiting they are one fact with one remedy. Both functions
 * below share that, through the one pure `postSignInTarget`.
 */

/**
 * For a caller that has **just established a session** — the password action, the factor step, the
 * provider callback.
 *
 * One place does both the read and the decision, so the password and provider flows exit
 * identically: a provider session is the same session (UC-05), and task 24 recorded its
 * `?return=`-or-`/home` landing as an interim naming this task as its owner. The access token comes
 * from the sealed cookie the caller has just written; `api-client` attaches it as ambient context
 * the way it attaches the locale, so nothing is threaded through here.
 *
 * **It reads uncached, and the reason is defensive rather than live.** React's `cache()` memoizes on
 * the function and its arguments and knows nothing about the cookie changing underneath it — so if
 * anything in this same request had already called `readMemberships()`, under the old session or
 * under none, the memoized answer would be handed back here and a person who had just signed in
 * would be sent to S-04 as a member of nothing.
 *
 * **Today no caller can reach that**, and saying so is more useful than implying a bug that exists:
 * `actions.ts` is `'use server'`, and a Server Action's body runs *before* Next re-renders the tree,
 * so nothing has read memberships yet; `social-flow.ts` is a Route Handler and renders nothing at
 * all. The separation is what keeps that true when a fourth caller arrives, or when one of these
 * three grows a reason to read memberships before establishing the session.
 *
 * **And it cannot be unit-tested — measured, not assumed.** React's `cache()` is a pass-through
 * without a request dispatcher, which vitest has no way to provide: a probe calling a cached
 * function twice recorded **two** invocations. So a spec asserting that these two functions disagree
 * would be green whether or not they did, which is the inert-check shape this repository refuses
 * everywhere else. Recorded as an uncoverable gap, like `account-menu.tsx`'s slotting hazard, rather
 * than papered over with a test that proves nothing.
 */
export const resolvePostSignIn = async (returnTo?: string): Promise<PostSignInTarget> => {
  const outcome = await api.getList<AccountMembership>('/memberships');
  return postSignInTarget({
    memberships: outcome.status === API_OUTCOME.Ok ? outcome.value.items : null,
    returnTo: sanitizeReturnPath(returnTo),
  });
};

/**
 * For a caller that **establishes nothing and only reads** — S-35 re-resolving on render, and
 * UX-136's guard on `(identity)/(session-issuing)`.
 *
 * Same branch, over `readMemberships()`'s request-scoped memoization. That is the whole of the
 * difference, and it is worth one function: `/organization-unavailable` sits inside `(app)`, whose
 * layout renders the global tier, so the page and the tier were issuing **two identical
 * `/memberships` calls in one render pass** — precisely what `server/memberships.ts` says its
 * `cache()` exists to prevent, arriving through the one screen that was not using it.
 *
 * **No `?return=`.** Neither caller has one to honour: a layout cannot see `searchParams`, and S-35
 * is a destination rather than a hand-off. Taking the parameter would be a seam nobody supplies,
 * which is the dead argument task 112's own review found here once already.
 */
export const destinationForHeldSession = async (): Promise<PostSignInTarget> =>
  postSignInTarget({ memberships: await readMemberships(), returnTo: null });
