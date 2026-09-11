/**
 * The membership region's namespace, declared once.
 *
 * **Extracted by the split rather than after it** (task 128). The section spelled
 * `'organization.home'` and reached its keys through a `memberships.` prefix; splitting it into five
 * files would have written that literal five times, which is the shape `overview-messages.ts`
 * records for the overview — the namespace duplicated *before* the split, and the split making it
 * six. Narrowing to `organization.home.memberships` drops the prefix from every key as well, so a
 * reader of `membership-row.tsx` sees `t('active')` rather than `t('memberships.active')` and cannot
 * reach a sibling region's copy by accident.
 *
 * **In `shared/` on this folder's one admission test**: read by `section/`, `list/` and `states/` —
 * all three siblings. `home-region.tsx` states the test one level up, where the same rule put the
 * region shell.
 *
 * A plain module rather than a member of some larger object: a namespace is not a closed vocabulary
 * with alternatives to choose between, it is one value several files must spell identically.
 */
export const MEMBERSHIPS_MESSAGES = 'organization.home.memberships';
