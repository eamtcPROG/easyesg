/**
 * Which of S-26's arms a read page is in — the Index archetype's rule between its two empty states, stated once for
 * a screen that composes the archetype's parts by hand (task 50.2.1; §4.6).
 *
 * **`total` is the centre before the tab and `matched` after it, and a zero in each is a different screen**:
 * `IndexShell`'s docblock says why, and S-26 draws a list rather than the shell's table, so the rule it owns has to be
 * restated here — as a function with a spec, since a ternary in a section is where the fourth screen loses it.
 * *Nothing yet* teaches what the centre is for; *nothing unread* has one action, the other tab.
 */
export const CENTRE_ARM = {
  LIST: 'list',
  FIRST_USE: 'first-use',
  NOTHING_UNREAD: 'nothing-unread',
} as const;

export type CentreArm = (typeof CENTRE_ARM)[keyof typeof CENTRE_ARM];

export const centreArm = (page: { readonly matched: number; readonly total: number }): CentreArm =>
  page.matched > 0 ? CENTRE_ARM.LIST : page.total === 0 ? CENTRE_ARM.FIRST_USE : CENTRE_ARM.NOTHING_UNREAD;
