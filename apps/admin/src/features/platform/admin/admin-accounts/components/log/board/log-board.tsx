import type { AdminRosterRow, SystemAuditLogEntry } from '@easyesg/contracts';
import type { IndexPage } from '@easyesg/ui';
import { useCallback, useId } from 'react';
import { useTranslations } from 'use-intl';
import {
  NO_LOG_FILTERS,
  logIsFiltered,
  withLogFilters,
  withLogPage,
  withLogPageSize,
  type AccountsSearch,
  type LogFilters,
  type LogView,
} from '../../../tools/accounts-search';
import { LogFiltersForm } from '../filters/log-filters-form';
import { LogList } from '../list/log-list';

/**
 * A-08's log, ready (task 67.4) — its heading, its filters and its page. **Read-only by construction**:
 * nothing here writes, and §5.2's *read-only (the log)* state is the absence of any control on an entry —
 * which is also why its table has no action column (task 170; §5.2's preamble: *a row with nothing to
 * open carries none*). **Its page size is the operator's since task 170**, in the address like the rest.
 */
export function LogBoard({
  page,
  view,
  search,
  operators,
  refreshing,
  onSearchChange,
}: {
  readonly page: IndexPage<SystemAuditLogEntry>;
  readonly view: LogView;
  readonly search: AccountsSearch;
  readonly operators: readonly AdminRosterRow[];
  readonly refreshing: boolean;
  readonly onSearchChange: (next: AccountsSearch) => void;
}) {
  const t = useTranslations('platform.accounts.log');
  const titleId = useId();

  const applyFilters = useCallback(
    (filters: LogFilters) => onSearchChange(withLogFilters(search, filters)),
    [onSearchChange, search],
  );
  const clearFilters = useCallback(
    () => onSearchChange(withLogFilters(search, NO_LOG_FILTERS)),
    [onSearchChange, search],
  );
  // Stable, because `IndexView` memoises the size offer on it — and `reactCompiler` is off (AD-9).
  const changePageSize = useCallback(
    (size: number) => onSearchChange(withLogPageSize(search, size)),
    [onSearchChange, search],
  );

  return (
    <section aria-labelledby={titleId} aria-busy={refreshing} className="flex flex-col gap-[var(--space-4)]">
      <header className="flex flex-col gap-[var(--space-2)]">
        <h2 id={titleId} className="t-heading-2">
          {t('title')}
        </h2>
        <p className="t-body text-[var(--text-muted)]">{t('lede')}</p>
      </header>

      <LogFiltersForm view={view} operators={operators} onSubmit={applyFilters} onClear={clearFilters} />

      <LogList
        page={page}
        filtered={logIsFiltered(view)}
        onPageChange={(next) => onSearchChange(withLogPage(search, next))}
        onPageSizeChange={changePageSize}
        onClearFilters={clearFilters}
      />
    </section>
  );
}
