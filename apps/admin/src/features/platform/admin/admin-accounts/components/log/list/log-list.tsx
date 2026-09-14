import type { SystemAuditLogEntry } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button, EmptyState, SORT_DIRECTION, type IndexPage } from '@easyesg/ui';
import { useTranslations } from 'use-intl';
import { IndexView } from '~/shared/index-view';
import { LOG_COLUMN, useLogColumns } from './log-columns';

/** The log has one order — newest first — and no control to change it. */
const NEWEST_FIRST = { column: LOG_COLUMN.TIME, direction: SORT_DIRECTION.DESCENDING } as const;

/** Nothing to sort: no column offers a control, so no change can arrive. */
const noSortChange = () => undefined;

const entryKey = (entry: SystemAuditLogEntry): string => entry.id;

/**
 * A-08's log table on the Index archetype (task 67.4), with its two empty states — **first use**, when
 * nothing has been recorded, and **filtered**, when the filters admitted nothing — told apart by the
 * page's `total` against `matched`.
 */
export function LogList({
  page,
  filtered,
  onPageChange,
  onClearFilters,
}: {
  readonly page: IndexPage<SystemAuditLogEntry>;
  readonly filtered: boolean;
  readonly onPageChange: (page: number) => void;
  readonly onClearFilters: () => void;
}) {
  const t = useTranslations('platform.accounts.log');
  const columns = useLogColumns();

  return (
    <IndexView
      page={page}
      caption={t('caption')}
      columns={columns}
      rowKey={entryKey}
      sort={NEWEST_FIRST}
      onSortChange={noSortChange}
      onPageChange={onPageChange}
      empty={{
        // Nothing to do about a log nothing has written to yet — the first sign-in writes to it.
        firstUse: (
          <EmptyState title={t('empty.firstUse.title')} action={null}>
            {t('empty.firstUse.body')}
          </EmptyState>
        ),
        filtered: (
          <EmptyState
            title={t('empty.filtered.title')}
            action={
              filtered ? (
                <Button type="button" variant={BUTTON_VARIANT.SECONDARY} onClick={onClearFilters}>
                  {t('empty.filtered.action')}
                </Button>
              ) : null
            }
          >
            {t('empty.filtered.body')}
          </EmptyState>
        ),
      }}
    />
  );
}
