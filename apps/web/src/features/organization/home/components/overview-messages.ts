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
 */
export const OVERVIEW_MESSAGES = 'organization.home.overview';
