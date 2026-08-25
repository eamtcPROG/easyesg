import type { AccountMembership } from '@easyesg/contracts';
import type { LocalizedPath } from '@/lib/locale-path';
import { rendersWithoutOrganization } from '@/lib/route-access';
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
 * need a session, which `rendersWithoutOrganization` reads from **the proxy's own list** rather
 * than from a second one: the closed-by-default gate and this branch must not disagree about which
 * routes those are.
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
  if (input.memberships.length === 0) {
    // Even here a session-free destination is honoured: the member-of-nothing arriving from an
    // invitation is going back to accept it, which is precisely how they stop being one.
    return input.returnTo && rendersWithoutOrganization(input.returnTo.href)
      ? { href: input.returnTo.href, locale: input.returnTo.locale }
      : { href: POST_SIGN_IN.CREATE_ORGANIZATION };
  }

  // Exactly one membership is the only state in which an organization is already resolved, so it is
  // the only one where a deep link INTO `(app)` can be honoured. A destination that renders without
  // a session renders without an organization too, so it is honoured from any arm — see the header.
  if (input.returnTo && (input.memberships.length === 1 || rendersWithoutOrganization(input.returnTo.href))) {
    return { href: input.returnTo.href, locale: input.returnTo.locale };
  }
  return { href: POST_SIGN_IN.HOME };
};
