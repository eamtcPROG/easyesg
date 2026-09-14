import type { SupportAccessLogEntry } from '@easyesg/contracts';
import { EmptyState, SORT_DIRECTION, type IndexPage } from '@easyesg/ui';
import { useTranslations } from 'use-intl';
import { IndexView } from '~/shared/index-view';
import { LOG_COLUMN, useLogColumns } from './log-columns';

/** The log has one order — newest first — and no control to change it. */
const NEWEST_FIRST = { column: LOG_COLUMN.REQUESTED_AT, direction: SORT_DIRECTION.DESCENDING } as const;

/** Nothing to sort: no column offers a control, so no change can arrive. */
const noSortChange = () => undefined;

const entryKey = (entry: SupportAccessLogEntry): string => entry.id;

/**
 * A-07's log table on the Index archetype (task 67.9). **One empty state, not two**: the log has no filter, so
 * *nothing matched* cannot happen and *nothing yet* is the only way it is empty.
 */
export function LogList({
  page,
  onOpen,
  onPageChange,
}: {
  readonly page: IndexPage<SupportAccessLogEntry>;
  readonly onOpen: (entryId: string) => void;
  readonly onPageChange: (page: number) => void;
}) {
  const t = useTranslations('platform.supportAccess.log');
  const columns = useLogColumns({ onOpen });
  const empty = (
    <EmptyState title={t('empty.title')} action={null}>
      {t('empty.body')}
    </EmptyState>
  );

  return (
    <IndexView
      page={page}
      caption={t('caption')}
      columns={columns}
      rowKey={entryKey}
      sort={NEWEST_FIRST}
      onSortChange={noSortChange}
      onPageChange={onPageChange}
      empty={{ firstUse: empty, filtered: empty }}
    />
  );
}
