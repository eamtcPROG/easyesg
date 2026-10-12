'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import type { HistorySubject } from './history-subject';
import { HISTORY_PAGE_SIZE, readHistory, type HistoryPage } from './read-history';

/** The read could not be answered — thrown so the infinite query stops on it and the panel draws its retry. */
class HistoryUnreadable extends Error {}

/**
 * S-12's entries for one subject, a page at a time (task 84.2; `design_spec.md` S-12's *navigate entries*): the newest
 * page when the panel opens, and each earlier one when the reader asks for it.
 *
 * **Fresh on every opening** (the notification panel's rule): stale at once and refetched on mount, so a panel opened
 * after an edit shows it. **Keyed by the organization the screen was rendered for**, as every client read here is: a
 * switch lands client-side and the query client outlives it, so a key without it would draw the organization left.
 */
export function useChangeHistory(input: { readonly organizationId: string; readonly subject: HistorySubject }) {
  return useInfiniteQuery({
    queryKey: ['change-history', input.organizationId, input.subject] as const,
    queryFn: async ({ pageParam }): Promise<HistoryPage> => {
      const page = await readHistory({ subject: input.subject, page: pageParam });
      if (page === null) throw new HistoryUnreadable('The change history could not be read');
      return page;
    },
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (pages.length * HISTORY_PAGE_SIZE < last.total ? pages.length + 1 : undefined),
    staleTime: 0,
    refetchOnMount: 'always',
  });
}
