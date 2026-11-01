/**
 * Which arm a read list is in — the Index archetype's rule between its two empty states, stated once for the two
 * surfaces that compose the archetype's parts by hand (tasks 50.2.1, 50.2.2; §4.6).
 *
 * **In `shared/` on one test: is it read by more than one surface?** S-26's section and the panel's list.
 *
 * **`total` is the centre before the tab and `matched` after it, and a zero in each is a different screen**:
 * `IndexShell`'s docblock says why, and S-26 draws a list rather than the shell's table, so the rule it owns has to be
 * restated here — as a function with a spec, since a ternary in a section is where the fourth screen loses it.
 * *Nothing yet* teaches what the centre is for; *nothing unread* has one action, the other tab.
 */
export const NOTICE_ARM = {
  LIST: 'list',
  FIRST_USE: 'first-use',
  NOTHING_UNREAD: 'nothing-unread',
} as const;

export type NoticeArm = (typeof NOTICE_ARM)[keyof typeof NOTICE_ARM];

export const noticeArm = (page: { readonly matched: number; readonly total: number }): NoticeArm =>
  page.matched > 0 ? NOTICE_ARM.LIST : page.total === 0 ? NOTICE_ARM.FIRST_USE : NOTICE_ARM.NOTHING_UNREAD;
