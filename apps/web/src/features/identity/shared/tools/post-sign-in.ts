import type { AccountMembership } from '@easyesg/contracts';
import type { LocalizedPath } from '@/lib/locale-path';
import { isReturnableAfterSignIn, needsOrganization, requiresSession } from '@/lib/route-access';
import type { Locale } from '@easyesg/i18n';
import { ROUTES, chooseOrganizationRoute, completeAccountRoute } from '@/lib/routes';

/**
 * **In `identity/shared/tools/` on one test — read by more than one journey: `sign-in/`, `invitation/` and `social/`, and by two `server/session/` seams.**
 *
 * §4.3's post-sign-in branch (FR-12, UC-16) — task 25.4.
 *
 * The flow chart is three arrows from one decision: **no memberships → S-04**, create the first
 * organization; **exactly one → S-05**, the home it scopes; **several → S-37**, to choose which of
 * them to act for, unless the session has chosen one already. Until task 83.3 the several arm landed
 * on S-05 too, for the global-tier switcher to choose; the project owner gave §4.3's *Choose
 * organization* step a screen of its own instead (`design_spec.md` S-37, 15 Sep 2026).
 *
 * **The web branches on the count, and the API resolves the active organization. Decided
 * 25 Aug 2026.** `selectActiveMembership` in `apps/api` owns "one membership and no preference
 * resolves it", and this file owns "none/one/several sends you here" — they agree at sign-in by
 * construction, because a fresh session has chosen nothing. They are nonetheless two rules with two
 * owners: §4.3 is navigation and names URLs the API has no business knowing, AD-12 is authorization.
 * **If either moves, check the other**; that is the recorded cost of not putting a design_spec
 * concept into the wire contract.
 *
 * **Since task 83.3 the several arm also reads which organization the API resolved** — its `active`
 * marker, never a guess of this file's — because several memberships resolve only through a choice, and
 * a held session may already carry one. `awaitsOrganizationChoice` below is that one reading.
 *
 * **`?return=` is honoured when the destination can actually render** — refined 25 Aug 2026 (task
 * 26.3, project owner), from "only when an organization resolves". UX-38's deep-link contract sends
 * someone back where they were headed, and the original override existed for a concrete reason:
 * returning a member-of-nothing to a route inside `(app)` lands them on a screen that cannot render
 * without an organization, and a preserved intention that cannot be honoured is not preserved.
 *
 * What that reasoning did **not** cover is a destination outside `(app)`. S-03 is the case that
 * found it: `/invitation/<token>` renders perfectly for someone who belongs to nowhere, and is the
 * one deep link such a person must be returned to — a registration handed off from an invitation
 * was landing on S-04 with the invitation lost. So the override is now scoped to destinations that
 * need a session, which `isReturnableAfterSignIn` reads from **the proxy's own list** rather than
 * from a second one: the closed-by-default gate and this branch must not disagree about which routes
 * those are. That predicate additionally excludes the credential entry points — `/sign-in`,
 * `/register`, `/reset`, `/set-password` — which render without an organization and are nonetheless
 * absurd places to send someone who has just signed in (narrowed 26 Aug 2026, after review).
 *
 * **This file carries no `server-only` and reaches no API**, which is why the branch has a spec at
 * all: `api-client` is server-only, and importing it here would make the whole module unloadable in
 * a test — so every arm below would have been exercised only through a browser journey, and the
 * three that are not the happy path would not have been exercised at all. `server/post-sign-in.ts`
 * is the seam that fetches; this is the rule that decides.
 */
/**
 * The three destinations, spelled by `ROUTES` and named by what the branch means.
 *
 * Both objects, deliberately: `ROUTES` owns how an address is written, and this owns which arm of
 * §4.3 it answers — "the account belongs to nothing", not "the create-organization page". Folding
 * them together would lose the second, and duplicating the strings would let the two disagree.
 */
export const POST_SIGN_IN = {
  /** S-04 (UC-49) — a verified account that belongs to nothing. Task 30.2 builds it. */
  CREATE_ORGANIZATION: ROUTES.CREATE_ORGANIZATION,
  /** S-05 — one membership, or several with one chosen. Task 30.5 builds it. */
  HOME: ROUTES.HOME,
  /** S-37 — several memberships, and none chosen for this session (task 83.3). */
  CHOOSE_ORGANIZATION: ROUTES.CHOOSE_ORGANIZATION,
  /** S-35 — the membership read failed, so the branch could not be taken at all. */
  ORGANIZATION_UNAVAILABLE: ROUTES.ORGANIZATION_UNAVAILABLE,
  /** S-36 — the account is still completing its setup, so no other arm applies yet (task 155). */
  COMPLETE_ACCOUNT: ROUTES.COMPLETE_ACCOUNT,
} as const;

export type PostSignInPath = (typeof POST_SIGN_IN)[keyof typeof POST_SIGN_IN];

export interface PostSignInTarget {
  /** One of `POST_SIGN_IN`, or the honoured `?return=` path — which is any same-app route. */
  readonly href: string;
  /** Present only when a `?return=` path was honoured — its own locale is authoritative (OQ-32). */
  readonly locale?: Locale;
}

/**
 * The locale a `PostSignInTarget` is reached in — the honoured `?return=` path's own where it named
 * one, and the caller's fallback otherwise.
 *
 * **Five call sites wrote this `??` themselves, with two different fallbacks and nothing anywhere
 * saying there were two** (task 112's parent-close convention review, 11 Sep 2026). It is the shape
 * the root file's `LOCALES` / `toLocale` case describes exactly: the vocabulary was shared and the
 * *operation over it* was retyped per caller, so every copy was locally correct and no test could
 * see the divergence.
 *
 * Both fallbacks are right, and the test that separates them is **whether a session is being issued
 * by this very call**:
 *
 * - **The account's profile locale**, where this is the exit from sign-in — the password action,
 *   the factor step, the provider callback. A branch destination carries no locale of its own, so
 *   OQ-32's profile preference decides, and it is the preference `establishSession` has just
 *   written to `NEXT_LOCALE` in the same breath.
 * - **The address's own locale**, where no session is issued — S-35 re-resolving on render, and
 *   UX-136's guard turning a signed-in reader away. That reader is already navigating, in a
 *   language they chose; answering in their profile's instead would move them mid-journey, and on
 *   the guard's path there is no fresh `NEXT_LOCALE` write to agree with.
 *
 * A sixth caller picks by that test rather than by copying whichever neighbour it happened to read.
 */
export const targetLocale = (target: PostSignInTarget, fallback: Locale): Locale =>
  target.locale ?? fallback;

/**
 * Several memberships, and none of them the organization this session acts for — the state S-37
 * resolves (task 83.3). **Read by this branch and by the gate on the workspace and the wizard**, so the
 * two cannot disagree about when a choice is owed.
 *
 * It reads the API's `active` marker rather than counting alone: one membership resolves by itself, so
 * its row is marked; several resolve only through a choice, and an unmarked list is exactly what a
 * choice left stale by a removal looks like too.
 */
export const awaitsOrganizationChoice = (memberships: readonly AccountMembership[]): boolean =>
  memberships.length > 1 && !memberships.some((membership) => membership.active);

/**
 * The branch itself: pure, so every arm is a line of spec rather than a browser journey.
 *
 * `memberships` is `null` when the read failed — distinct from `[]`, which is the real and ordinary
 * answer for a verified account that has not created or joined anything yet. Collapsing the two
 * would send someone whose organizations we could not load to "create your first organization",
 * which invites them to make a second one.
 */
export const postSignInTarget = (input: {
  /**
   * The session's account is still completing its setup (task 155). Decided first, and the seam does
   * not read memberships at all when it is true: the API refuses such an account that read.
   */
  readonly awaitingSetup: boolean;
  readonly memberships: readonly AccountMembership[] | null;
  readonly returnTo: LocalizedPath | null;
}): PostSignInTarget => {
  // §12.5.6's task-155 row: an account in setup reaches S-36 and nothing else. A deep link rides
  // along unjudged — whether it is honoured is this function's question once setup is done, when
  // S-36 asks it again — and its locale is kept, so S-36 speaks the language the reader arrived in.
  if (input.awaitingSetup) {
    return input.returnTo
      ? { href: completeAccountRoute(input.returnTo.href), locale: input.returnTo.locale }
      : { href: POST_SIGN_IN.COMPLETE_ACCOUNT };
  }

  if (input.memberships === null) return { href: POST_SIGN_IN.ORGANIZATION_UNAVAILABLE };
  if (input.memberships.length === 0) {
    // Even here a session-free destination is honoured: the member-of-nothing arriving from an
    // invitation is going back to accept it, which is precisely how they stop being one.
    return input.returnTo && isReturnableAfterSignIn(input.returnTo.href)
      ? { href: input.returnTo.href, locale: input.returnTo.locale }
      : { href: POST_SIGN_IN.CREATE_ORGANIZATION };
  }

  // A destination that renders without a session renders without an organization too, so it is
  // honoured from any arm — see the header.
  if (input.returnTo && isReturnableAfterSignIn(input.returnTo.href)) {
    return { href: input.returnTo.href, locale: input.returnTo.locale };
  }

  // Several, and none chosen (task 83.3): S-37 asks. A deep link needing an organization rides along for
  // it to honour once one is in scope. **One to the account's own screens needs none and is honoured now**
  // — S-37's gate lets those screens render in this state, and until task 83's parent close the branch sent
  // the reader through S-37 to reach one. Anything else was answered above or is a credential entry point.
  if (awaitsOrganizationChoice(input.memberships)) {
    if (input.returnTo && requiresSession(input.returnTo.href)) {
      return needsOrganization(input.returnTo.href)
        ? { href: chooseOrganizationRoute(input.returnTo.href), locale: input.returnTo.locale }
        : { href: input.returnTo.href, locale: input.returnTo.locale };
    }
    return { href: POST_SIGN_IN.CHOOSE_ORGANIZATION };
  }

  // An organization is resolved — one membership, or several with one chosen — so a deep link into
  // `(app)` can render. **Only one that needs a session**: a credential entry point also renders
  // without an organization, and until task 83.3 a single membership sent `?return=/sign-in` back to
  // the sign-in form, because this arm honoured any return path at all.
  return input.returnTo && requiresSession(input.returnTo.href)
    ? { href: input.returnTo.href, locale: input.returnTo.locale }
    : { href: POST_SIGN_IN.HOME };
};
