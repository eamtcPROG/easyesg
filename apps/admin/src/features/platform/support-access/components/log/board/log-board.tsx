import type { SupportAccessLogEntry } from '@easyesg/contracts';
import type { IndexPage } from '@easyesg/ui';
import { useCallback } from 'react';
import { useTranslations } from 'use-intl';
import {
  withEntry,
  withLogPage,
  withLogPageSize,
  type SupportAccessSearch,
} from '../../../tools/support-access-search';
import { LogList } from '../list/log-list';
import { LogRecord } from '../record/log-record';

/**
 * A-07's log, ready (task 67.9; UC-86; FR-79): its heading, the table at the full width of the screen, and — when
 * the address names one — the open entry in a dialogue over it (task 170; `design_spec.md` §5.2's preamble). Until
 * then the record sat in a second grid track that was reserved whether or not an entry was open.
 *
 * **The entry is looked up on the page being shown**, which is why a new page or page size closes it
 * (`support-access-search.ts`) rather than leaving an address that names nothing on screen.
 *
 * **Busy while another page or size loads**, and still readable: `aria-busy` says a refresh is in flight over the
 * page `keepPreviousData` keeps on screen — A-02's board's reading. The poll that runs while the log is moving
 * refreshes the same page in place and does not mark it busy.
 */
export function LogBoard({
  search,
  page,
  refreshing,
  onSearchChange,
}: {
  readonly search: SupportAccessSearch;
  readonly page: IndexPage<SupportAccessLogEntry>;
  readonly refreshing: boolean;
  readonly onSearchChange: (next: SupportAccessSearch) => void;
}) {
  const t = useTranslations('platform.supportAccess.log');
  const selected = search.entry === undefined ? null : (page.rows.find((row) => row.id === search.entry) ?? null);

  // Stable, because the columns memoise on `onOpen` and the pager's sizes on `onPageSizeChange` — and
  // `reactCompiler` is off (AD-9).
  const onOpen = useCallback(
    (entryId: string) => onSearchChange(withEntry(search, entryId)),
    [onSearchChange, search],
  );
  const onPageSizeChange = useCallback(
    (size: number) => onSearchChange(withLogPageSize(search, size)),
    [onSearchChange, search],
  );

  return (
    <section aria-label={t('region')} aria-busy={refreshing} className="flex flex-col gap-[var(--space-4)]">
      <h2 className="t-heading-2">{t('title')}</h2>
      <LogList
        page={page}
        onOpen={onOpen}
        onPageChange={(next) => onSearchChange(withLogPage(search, next))}
        onPageSizeChange={onPageSizeChange}
      />
      {selected === null ? null : (
        <LogRecord entry={selected} onClose={() => onSearchChange(withEntry(search, null))} />
      )}
    </section>
  );
}
