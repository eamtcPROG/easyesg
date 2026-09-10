import { ROUTES } from '@/lib/routes';

/**
 * §4.2's workspace sections, declared once (task 108).
 *
 * **Extracted from `workspace-navigation.tsx` when the compact drawer became the second reader.**
 * The band and the drawer are one tier at two frames — `EasyESG Workspace.dc.html` draws the same
 * destinations inline at 834 and 1440 and as a panel at 390 — so a second copy of the list would
 * be two navigations that could disagree about where the product's sections are.
 *
 * `key` is the catalogue key as well as the React key; `href` is a `ROUTES` member. The label is
 * not here because it is localized, and resolving it is the caller's (UX-79).
 */
export const WORKSPACE_SECTIONS = [
  // S-05, added with task 104 — §4.2 opens the tier with *Home*, and every Workspace artboard draws
  // it first at every width, carrying the current-item underline on the home screen itself. It was
  // absent for four tasks because §4.2's table listed five entries where the prototype draws six,
  // and the table is what 26.4 … 32.2.2 read. The amendment records which of the two governs.
  { key: 'home', href: ROUTES.HOME },
  // S-06, added with task 32.2.2 — it could not ship earlier: the Index's only exit is the wizard
  // (§4.4 has no report record screen), and `reports/[reportId]` was a redirector returning nothing
  // until tasks 35.1 … 36.2 made S-07 real. That is this tier's own rule — the set holds the
  // sections that render — applied to the screen rather than to the link.
  { key: 'reports', href: ROUTES.REPORTS },
  // S-13, added with task 30.4.2. §4.2 calls this section *Entities & periods*; periods are task
  // 31's, so the label names what the section actually holds and gains its other half then.
  //
  // **It precedes *Organization*, corrected by task 104.** Both §4.2 and the artboards order the
  // tier entity-then-organization, and this sat the other way round from task 30.3 — surviving
  // because nothing asserted the order, which `workspace-navigation.spec.tsx` now does.
  { key: 'entities', href: ROUTES.ENTITIES },
  // S-15, added with task 30.3 — §4.2's *Organization*, and before *Users & access* because the
  // reading order is the object and then its people.
  { key: 'organization', href: ROUTES.ORGANIZATION },
  // S-16, task 26.4 — the first screen in this group, and the reason this tier was built at all.
  { key: 'users', href: ROUTES.ORGANIZATION_USERS },
] as const;
