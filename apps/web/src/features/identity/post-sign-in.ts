import type { AccountMembership } from '@easyesg/contracts';
import type { LocalizedPath } from '@/lib/locale-path';
import type { Locale } from '@easyesg/i18n';

/**
 * §4.3's post-sign-in branch (FR-12, UC-16) — task 25.4.
 *
 * The flow chart is three arrows from one decision: **no memberships → S-04**, create the first
 * organization; **exactly one → S-05**, the home it scopes; **several → S-05**, where the
 * global-tier switcher chooses (`design_spec.md` OQ-6 assigns the *switch* half of UC-16 there
 * rather than to a screen, and 30.5's row confirms both branches land on it).
 *
 * **The web branches on the count, and the API resolves the active organization. Decided
 * 25 Aug 2026.** `selectActiveMembership` in `apps/api` owns "one membership and no preference
 * resolves it", and this file owns "none/one/several sends you here" — they agree at sign-in by
 * construction, because a fresh session has chosen nothing. They are nonetheless two rules with two
 * owners: §4.3 is navigation and names URLs the API has no business knowing, AD-12 is authorization.
 * **If either moves, check the other**; that is the recorded cost of not putting a design_spec
 * concept into the wire contract.
 *
 * **`?return=` is honoured only when an organization resolves** (same decision). UX-38's deep-link
 * contract sends someone back where they were headed — but returning a member-of-nothing, or someone
 * who has not yet chosen among several, to a route inside `(app)` lands them on a screen that cannot
 * render without an organization. A preserved intention that cannot be honoured is not preserved.
 *
 * **This file carries no `server-only` and reaches no API**, which is why the branch has a spec at
 * all: `api-client` is server-only, and importing it here would make the whole module unloadable in
 * a test — so every arm below would have been exercised only through a browser journey, and the
 * three that are not the happy path would not have been exercised at all. `server/post-sign-in.ts`
 * is the seam that fetches; this is the rule that decides.
 */
export const POST_SIGN_IN = {
  /** S-04 (UC-49) — a verified account that belongs to nothing. Task 30.2 builds it. */
  CREATE_ORGANIZATION: '/create-organization',
  /** S-05. Both the "one" and "several" branches land here. Task 30.5 builds it. */
  HOME: '/home',
  /** S-35 — the membership read failed, so the branch could not be taken at all. */
  ORGANIZATION_UNAVAILABLE: '/organization-unavailable',
} as const;

export type PostSignInPath = (typeof POST_SIGN_IN)[keyof typeof POST_SIGN_IN];

export interface PostSignInTarget {
  /** One of `POST_SIGN_IN`, or the honoured `?return=` path — which is any same-app route. */
  readonly href: string;
  /** Present only when a `?return=` path was honoured — its own locale is authoritative (OQ-32). */
  readonly locale?: Locale;
}

/**
 * The branch itself: pure, so every arm is a line of spec rather than a browser journey.
 *
 * `memberships` is `null` when the read failed — distinct from `[]`, which is the real and ordinary
 * answer for a verified account that has not created or joined anything yet. Collapsing the two
 * would send someone whose organizations we could not load to "create your first organization",
 * which invites them to make a second one.
 */
export const postSignInTarget = (input: {
  readonly memberships: readonly AccountMembership[] | null;
  readonly returnTo: LocalizedPath | null;
}): PostSignInTarget => {
  if (input.memberships === null) return { href: POST_SIGN_IN.ORGANIZATION_UNAVAILABLE };
  if (input.memberships.length === 0) return { href: POST_SIGN_IN.CREATE_ORGANIZATION };

  // Exactly one membership is the only state in which an organization is already resolved, so it is
  // the only one where a deep link can be honoured.
  if (input.memberships.length === 1 && input.returnTo) {
    return { href: input.returnTo.href, locale: input.returnTo.locale };
  }
  return { href: POST_SIGN_IN.HOME };
};
