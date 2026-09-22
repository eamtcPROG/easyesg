/**
 * The panel's namespace, declared once (task 50.2.2): the header, the notices and their states, and the footer read it.
 * What the panel shares with S-26 — the views, *mark all*, the unread count in words — is
 * `shared/components/notice-messages.ts`'s.
 *
 * **In `components/shared/` on one test: is it read by more than one sibling?** Every region reads it.
 */
export const PANEL_MESSAGES = 'notifications.panel' as const;
