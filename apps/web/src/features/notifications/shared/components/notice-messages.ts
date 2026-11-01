/**
 * The words every notification surface shares (tasks 50.2.1, 50.2.2) — declared once, beside the item and the action
 * hook that read them.
 *
 * - `notifications.item` — the Notification item's own: *unread*, the word for a notice with no title, *today*.
 *   Whatever draws the item speaks them: S-26's list and the panel.
 * - `notifications.action` — a mark or dismissal that did not reach the API, wherever it was pressed.
 * - `notifications.lists` — what S-26 and the panel both say about a list: the two views, *mark all as read*, and the
 *   unread count in words. One copy, so the page and the panel cannot word the same control two ways.
 * - `chrome.notifications` — the band's words for the way in: the bell's name, and its name with the count. The
 *   bell's panel and the compact drawer's row both say them, so the two entries cannot name one centre two ways;
 *   the namespace is `chrome`'s because the band is.
 *
 * **In `shared/` on one test: is it read by more than one surface?** Each is read by two: S-26 and the panel, or the
 * bell and the drawer's row.
 */
export const NOTICE_MESSAGES = 'notifications.item' as const;
export const NOTICE_ACTION_MESSAGES = 'notifications.action' as const;
export const NOTICE_LIST_MESSAGES = 'notifications.lists' as const;
export const NOTICE_ENTRY_MESSAGES = 'chrome.notifications' as const;
