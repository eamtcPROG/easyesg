/**
 * S-16's namespace, declared once (task 134): the section, the loading state and every region of the
 * board read it, and its sub-namespaces (`roles`, `roleDescriptions`, `actions`, `invite`, `seats`)
 * are spelled off it.
 *
 * **In `components/shared/` on one test: is it read by more than one sibling?** `section/`,
 * `heading/`, `board/` and `invite/` all read it, and so does the route's `loading.tsx`.
 *
 * **Not narrowed per region, which `shared-namespace-declared-once` would otherwise ask for in the same
 * change as the split.** The catalogue's subtrees do not partition by region: `roles` is read by the
 * board's role cell and the invite form, and `seats` by the heading's counter and the invite panel's
 * arms. A namespace per region would reach across into a sibling's keys anyway, so narrowing needs the
 * catalogue restructured first — a change of its own, not a side effect of moving files.
 */
export const ACCESS_MESSAGES = 'organization.access' as const;
