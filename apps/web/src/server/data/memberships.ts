import 'server-only';
import { cache } from 'react';
import { MEMBERSHIP_ROLE, type AccountMembership } from '@easyesg/contracts';
import { API_OUTCOME } from '@/lib/api-outcome';
import { api } from '../api/api-client';

/**
 * The caller's memberships, read once per request (task 30.1).
 *
 * **`cache()` is the point of this module.** The global tier names the active organization on every
 * authenticated screen, and S-05 lists the same collection as its own content (task 30.5) — a
 * layout and a page render in the same pass, so without this the product's most-rendered read would
 * go out twice on every navigation. React's per-request memoization is the idiom for exactly that;
 * it is scoped to one render, so it is not a cache in the §14.2 sense and cannot serve one tenant's
 * answer to another.
 *
 * **A failure is `null`, not an empty list**, which is `server/post-sign-in.ts`'s distinction and
 * the same one for the same reason: `[]` means the account genuinely belongs to nothing and is what
 * sends someone to S-04, while `null` means we could not find out. The global tier renders without
 * its organization region in both cases and states nothing it does not know; sign-in's own failure
 * has a screen (S-35) because there the answer decides where the person goes.
 */
export const readMemberships = cache(async (): Promise<AccountMembership[] | null> => {
  const outcome = await api.getList<AccountMembership>('/memberships');
  return outcome.status === API_OUTCOME.Ok ? outcome.value.items : null;
});

/**
 * The organization this request is acting for, or `null`.
 *
 * The `active` flag is the API's own resolution — `AuthGuard`'s `selectActiveMembership`, projected
 * onto the read (task 30.1). This app never computes it: UX-2 makes the active organization a
 * property of the session, and a second answer derived here — "the only membership", say — would be
 * right until the day someone holds two, and wrong invisibly.
 */
export const readActiveMembership = async (): Promise<AccountMembership | null> =>
  (await readMemberships())?.find((membership) => membership.active) ?? null;

/**
 * Whether this membership may write in the organization it names — FR-25's *"a view-only member
 * sees the same entries and no edit affordances"*, as one predicate (extracted 7 Sep 2026, task
 * 32.4's review).
 *
 * **Beside the read rather than at each screen**, which is the root file's rule that an operation
 * over a vocabulary belongs with the vocabulary: `MEMBERSHIP_ROLE` is `@easyesg/contracts`' and the
 * narrowing *is this membership one of the writing roles* is derived from it. It had been written
 * twice in two different orders — `membership?.role !== VIEWER && membership !== null` on S-06 and
 * `membership !== null && membership.role !== VIEWER` on S-05 — which are equivalent only because
 * of the null conjunct, so a reader cannot see that they are one rule and nothing fails if one
 * drifts.
 *
 * **`null` reads as view-only, and that is the safe direction**: the affordance disappears and the
 * screen still renders, where guessing *editor* would offer a write the API refuses. A caller
 * holding several memberships with no active one resolves nothing, which is task 83's to end.
 *
 * It takes the membership rather than the role so a caller cannot reach for `.role` on a `null`
 * and get the answer by accident.
 */
export const mayWrite = (membership: AccountMembership | null): boolean =>
  membership !== null && membership.role !== MEMBERSHIP_ROLE.VIEWER;
