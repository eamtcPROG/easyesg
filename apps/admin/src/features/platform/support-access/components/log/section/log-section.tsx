import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'use-intl';
import { REALM_READ } from '~/realm/tools/realm-read';
import { supportAccessLogQuery } from '../../../queries/support-access';
import { readLogOutcome } from '../../../tools/support-access-read';
import {
  withEntry,
  withLogPage,
  type SupportAccessSearch,
} from '../../../tools/support-access-search';
import { SupportAccessLoading } from '../../shared/support-access-loading';
import { SupportAccessUnavailable } from '../../shared/support-access-unavailable';
import { LogList } from '../list/log-list';
import { LogRecord } from '../record/log-record';

/**
 * A-07's log (task 67.9; UC-86; FR-79) — the Index half: every request by every operator, newest first, and the
 * open entry's record beside it. **Every Platform Administrator reads the whole of it** (project owner, 14 Sep 2026),
 * and nothing here edits an entry. **A session that ended and a refused role draw nothing here**: the in-progress
 * region reads the same realm and already says so.
 */
export function LogSection({
  search,
  onSearchChange,
}: {
  readonly search: SupportAccessSearch;
  readonly onSearchChange: (next: SupportAccessSearch) => void;
}) {
  const t = useTranslations('platform.supportAccess.log');
  const page = search.page ?? 1;
  const query = useQuery(supportAccessLogQuery(page));

  if (query.data === undefined) {
    return query.isError ? (
      <SupportAccessUnavailable onRetry={() => void query.refetch()} />
    ) : (
      <SupportAccessLoading />
    );
  }

  const read = readLogOutcome({ outcome: query.data, page });
  switch (read.kind) {
    case REALM_READ.SIGNED_OUT:
    case REALM_READ.FORBIDDEN:
      return null;
    case REALM_READ.UNAVAILABLE:
      return <SupportAccessUnavailable onRetry={() => void query.refetch()} />;
    case REALM_READ.READY: {
      const selected = read.page.rows.find((row) => row.id === search.entry) ?? null;
      return (
        <section aria-label={t('region')} className="flex flex-col gap-[var(--space-4)]">
          <h2 className="t-heading-2">{t('title')}</h2>
          <div className="grid items-start gap-[var(--space-5)] lg:grid-cols-[minmax(0,1fr)_24rem]">
            <LogList
              page={read.page}
              onOpen={(entryId) => onSearchChange(withEntry(search, entryId))}
              onPageChange={(next) => onSearchChange(withLogPage(search, next))}
            />
            {selected === null ? null : (
              <LogRecord entry={selected} onClose={() => onSearchChange(withEntry(search, null))} />
            )}
          </div>
        </section>
      );
    }
  }
}
