/**
 * The Notification item's own words — *unread*, the word for a notice with no title, *today* (task 50.2.1).
 *
 * **Its own namespace rather than S-26's**, because they are the item's and not the screen's: whatever draws the item
 * speaks them. Beside the list because the list and the item are its readers, both here.
 */
export const NOTICE_MESSAGES = 'notifications.item' as const;
