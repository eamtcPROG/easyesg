import type { NoticeShow } from '@/features/notifications/shared/tools/notice-list-query';

/**
 * The keys the notification queries share (task 50.2.1; the panel's since 50.2.2).
 *
 * **One scope over all of them**, so a mark made anywhere — S-26's controls, the panel's *mark all* — invalidates the
 * band's count and the panel's list together with one call, rather than each writer having to know every reader.
 *
 * **Each key carries the organization it was read for.** An organization switch lands client-side, so the `(app)`
 * layout's query client outlives it: keyed without the organization, the band went on showing the organization left
 * until the next minute's poll, and the panel drew its list before reading the new one — one tenant's centre drawn
 * under another's name. The id comes from the server's render of the global tier and only **partitions the cache**;
 * it never chooses what is read, which is the session's active organization behind the pass-through (UX-2, AD-2).
 *
 * **A directive-free module of its own** because the hooks that read these carry `'use client'`, and a value exported
 * from a client module reaches a Server Component as a client reference, `undefined` — the root `CLAUDE.md`'s rule,
 * which lint holds.
 */
export const NOTIFICATIONS_QUERY_SCOPE = ['notifications'] as const;

/** The active organization's unread count. */
export const unreadCountQueryKey = (organizationId: string) =>
  [...NOTIFICATIONS_QUERY_SCOPE, organizationId, 'unread-count'] as const;

/** One of the panel's two lists — unread, or all — so switching tabs does not refetch the one already read. */
export const panelQueryKey = (input: { readonly organizationId: string; readonly show: NoticeShow }) =>
  [...NOTIFICATIONS_QUERY_SCOPE, input.organizationId, 'panel', input.show] as const;
