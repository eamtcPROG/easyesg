'use client';

import type { HistorySubject } from '@/client/history/history-subject';
import { useChangeHistory } from '@/client/history/use-change-history';
import { HistoryList } from '../list/history-list';
import { HistoryEmpty } from '../states/history-empty';
import { HistoryLoading } from '../states/history-loading';
import { HistoryUnreachable } from '../states/history-unreachable';

/**
 * S-12's entries for the subject open (task 84.2): the read, and which of §8.1's arms applies — *loading — initial*,
 * *error — recoverable*, *empty — first use* (no changes yet), or the list, a page at a time.
 *
 * **Mounted only while the panel is open**, keyed on the subject, so the read happens when the history is asked for and
 * a different field starts its own list. An earlier page that fails keeps the pages already read and says so beneath
 * them, with the same way to try again.
 */
export function HistoryEntries({
  subject,
  organizationId,
  readerAccountId,
  markCurrent,
}: {
  readonly subject: HistorySubject;
  readonly organizationId: string;
  readonly readerAccountId: string;
  /** A field's newest entry holds its current answer, and says so; a record's entries are several fields' changes. */
  readonly markCurrent: boolean;
}) {
  const history = useChangeHistory({ organizationId, subject });

  if (history.data === undefined) {
    return history.isError ? <HistoryUnreachable onRetry={() => void history.refetch()} /> : <HistoryLoading />;
  }
  const entries = history.data.pages.flatMap((page) => page.entries);
  if (entries.length === 0) return <HistoryEmpty />;

  return (
    <HistoryList
      entries={entries}
      readerAccountId={readerAccountId}
      markCurrent={markCurrent}
      earlier={
        history.hasNextPage
          ? { pending: history.isFetchingNextPage, onShow: () => void history.fetchNextPage() }
          : null
      }
      failed={history.isFetchNextPageError ? () => void history.fetchNextPage() : null}
    />
  );
}
