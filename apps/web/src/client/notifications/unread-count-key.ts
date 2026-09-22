/**
 * The key every reader of the unread count shares (task 50.2.1) — the band's bell, the compact drawer's row, and
 * S-26's controls, which invalidate it after a mark so the badge follows the reader's own action rather than the next
 * poll.
 *
 * **A directive-free module of its own** because the hook beside it carries `'use client'`, and a value exported from
 * a client module reaches a Server Component as a client reference, `undefined` — the root `CLAUDE.md`'s rule, which
 * lint holds.
 */
export const UNREAD_COUNT_QUERY_KEY = ['notifications', 'unread-count'] as const;
