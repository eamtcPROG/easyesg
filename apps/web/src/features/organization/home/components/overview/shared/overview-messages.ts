/**
 * S-05's overview namespace, declared once.
 *
 * **It was already written twice before this split** — `overview-section.tsx` and `filing-list.tsx`
 * each carried a private `MESSAGES` const — and the split would have made it six. Six is also where
 * `sonarjs/no-duplicate-string` would finally have noticed: the literal carries separators, so it is
 * not one of the bare `\w`-only tokens that rule is blind to, and it would have fired at three.
 *
 * A plain module rather than a member of some larger object: a namespace is not a closed vocabulary
 * with alternatives to choose between, it is one value several files must spell identically.
 *
 * **In `shared/` because all three sibling folders read it** — `section/`, `regions/` and
 * `states/` — which is the folder's whole admission test. Seven files import it; that they share
 * one declaration is the point, and where that declaration sits follows from who reads it rather
 * than from what kind of thing it is.
 *
 * **It is the only file here since task 128**, when the region shell it used to sit beside rose to
 * `components/shared/` — two regions read that, and only the overview reads this. The test is the
 * same at both levels and that is why the folders share a name: *is it read by more than one
 * sibling?* — answered against different siblings.
 */
export const OVERVIEW_MESSAGES = 'organization.home.overview';
