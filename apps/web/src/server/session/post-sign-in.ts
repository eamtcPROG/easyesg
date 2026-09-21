import 'server-only';
import { ACCOUNT_STATUS, type AccountMembership, type AccountSetup } from '@easyesg/contracts';
import { API_OUTCOME, type ApiOutcome, type ListResult } from '@/lib/api-outcome';
import { sanitizeReturnPath } from '@/lib/locale-path';
import { outcomeEndsSession } from '@/lib/session-standing';
import { postSignInTarget, type PostSignInTarget } from '@/features/identity/shared/tools/post-sign-in';
import { observingApi } from '../api/api-client';
import { readAccountSetup } from '../data/account-setup';
import { readMembershipsOutcome } from '../data/memberships';
import { readSession } from './session';

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
 *
 * **Both ask the session first whether its account is still completing its setup** (task 155), and
 * read no memberships when it is: the API refuses such an account that read, and the refusal would
 * otherwise land it on S-35 as *organization unavailable* — a wrong screen stated as a fact. The
 * status comes from the sealed cookie, which for `resolvePostSignIn` is the one its caller has just
 * written and which a refresh keeps current for the other.
 *
 * **A session the api has ended is the branch's own answer here, or no answer at all** (tasks 160, 161;
 * §12.5.6's task-161 row). The api client sends every caller whose session has ended to sign in, from
 * inside the read — which is right for a screen and wrong for the callers that must *act* on the ending:
 * the sign-in gate, which would redirect to itself; S-02, which clears the cookie; S-03, which offers
 * sign-in beside the invitation; and the branch just after a sign-in. Those read through `observingApi`,
 * which hands the ending back, and the branch answers *session ended* for it. The one reading that follows
 * the rule instead is `destinationForHeldSession`, for the two screens inside `(app)`.
 */

const awaitingSetup = async (): Promise<boolean> =>
  (await readSession())?.account.status === ACCOUNT_STATUS.AWAITING_SETUP;

/**
 * For a caller that has **just established a session** — the password action, the factor step, the
 * provider callback, and S-36 once the account is active.
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
  const returnPath = sanitizeReturnPath(returnTo);
  if (await awaitingSetup()) {
    return postSignInTarget({
      sessionEnded: false,
      awaitingSetup: true,
      memberships: null,
      returnTo: returnPath,
    });
  }

  const outcome = await observingApi.getList<AccountMembership>('/memberships');
  return postSignInTarget({
    sessionEnded: outcomeEndsSession(outcome),
    awaitingSetup: false,
    memberships: outcome.status === API_OUTCOME.Ok ? outcome.value.items : null,
    returnTo: returnPath,
  });
};

/** The two reads the branch rests on for a session this request arrived with. */
interface HeldSessionReads {
  readonly memberships: () => Promise<ApiOutcome<ListResult<AccountMembership>>>;
  readonly setup: () => Promise<ApiOutcome<AccountSetup>>;
}

/**
 * The branch for the session this request arrived with, over whichever reads it is handed — the two
 * exported readings below differ in nothing else.
 *
 * **A session still completing setup is asked too, which it was not until task 160.** The branch sends it
 * to S-36 without reading memberships the api would refuse it, so nothing here could tell that it had
 * ended — and S-36 sends an ended session to sign in, which would bounce straight back to S-36 through the
 * gate. `GET /account/setup` admits every live session, active or in setup, so its refusal is the ending
 * itself. It costs a read only for such a session, which the proxy sends to S-36 rather than here.
 */
const heldSessionTarget = async (reads: HeldSessionReads): Promise<PostSignInTarget> => {
  if (await awaitingSetup()) {
    const setup = await reads.setup();
    return postSignInTarget({
      sessionEnded: outcomeEndsSession(setup),
      awaitingSetup: true,
      memberships: null,
      returnTo: null,
    });
  }

  const outcome = await reads.memberships();
  return postSignInTarget({
    sessionEnded: outcomeEndsSession(outcome),
    awaitingSetup: false,
    memberships: outcome.status === API_OUTCOME.Ok ? outcome.value.items : null,
    returnTo: null,
  });
};

/**
 * For a screen inside `(app)` that **follows** the branch — S-35 re-resolving on render, S-37's section.
 *
 * Over the chrome's own reads, through the ordinary client: the memberships read's request-scoped
 * memoization (`readMembershipsOutcome`, which the global tier's `readMemberships` is built on, so the two
 * share one call) and `readAccountSetup`. **So an ended session never comes back from here** — the read
 * sends the reader to sign in first, exactly as the chrome's does in the same render, and the two cannot
 * race to different addresses (task 161). The memoization was the reason for this function before that
 * was: `/organization-unavailable`'s page and the tier were issuing **two identical `/memberships` calls
 * in one render pass**, which is what `server/data/memberships.ts` says its `cache()` exists to prevent.
 *
 * **No `?return=`.** No caller has one to honour: S-35 is a destination rather than a hand-off, and S-37
 * carries its own. Taking the parameter would be a seam nobody supplies, which is the dead argument task
 * 112's own review found here once already.
 */
export const destinationForHeldSession = (): Promise<PostSignInTarget> =>
  heldSessionTarget({ memberships: readMembershipsOutcome, setup: readAccountSetup });

/**
 * For a caller that **acts on** the branch's answer, the ending included — UX-136's guard on
 * `(identity)/(session-issuing)`, which serves the form for it; S-02's `accountStillSignedIn`, which clears
 * the cookie for it; and S-03's two remedies, on render and on a refused acceptance, which offer sign-in
 * for it (task 161).
 *
 * Through `observingApi`, so the ending is handed back rather than answered with a redirect, and
 * **uncached** on purpose: none of these callers renders the chrome, so there is no second read in the
 * request to share with — and sharing the chrome's would hand its redirect to a caller that must not have
 * one. The same `?return=` reasoning as above: a layout cannot see `searchParams`, and S-03's and S-02's
 * remedies are the reader's home, not a way back.
 */
export const observeHeldSession = (): Promise<PostSignInTarget> =>
  heldSessionTarget({
    memberships: () => observingApi.getList<AccountMembership>('/memberships'),
    setup: () => observingApi.get<AccountSetup>('/account/setup'),
  });
