import type { OrganizationRegisterRow } from '@easyesg/contracts';
import type { IndexPage } from '@easyesg/ui';
import { useCallback } from 'react';
import { useTranslations } from 'use-intl';
import {
  withPage,
  withSearch,
  withSelected,
  withSort,
  type RegisterSearch,
  type RegisterView,
} from '../../../tools/register-search';
import { RegisterList } from '../list/register-list';
import { OrganizationRecord } from '../record/organization-record';
import { RegisterSearchForm } from '../search/register-search-form';

/**
 * A-02's ready arm (task 67.3): the heading, the search, the table and — when one is chosen — the
 * account-level record beside it.
 *
 * **Every change is a navigation**, through `register-search.ts`'s transitions, so the view the
 * operator sees is always the view the address holds (UX-4): a reload, a bookmark or a link pasted
 * into a support ticket reopens the same search, order, page and record.
 *
 * **Busy while the next page loads**, and still readable: `aria-busy` says a refresh is in flight,
 * over the previous page `keepPreviousData` keeps on screen.
 */
export function RegisterBoard({
  search,
  view,
  page,
  refreshing,
  onSearchChange,
  onReload,
}: {
  readonly search: RegisterSearch;
  readonly view: RegisterView;
  readonly page: IndexPage<OrganizationRegisterRow>;
  readonly refreshing: boolean;
  readonly onSearchChange: (next: RegisterSearch) => void;
  readonly onReload: () => void;
}) {
  const t = useTranslations('platform.organizations');
  const selected =
    view.selected === null ? null : (page.rows.find((row) => row.id === view.selected) ?? null);

  // Stable, because the columns memoise on it — and `reactCompiler` is off (AD-9).
  const onOpen = useCallback(
    (id: string) => onSearchChange(withSelected(search, id)),
    [onSearchChange, search],
  );

  return (
    <div className="flex flex-col gap-[var(--space-5)] p-[var(--space-6)]" aria-busy={refreshing}>
      <header className="flex flex-col gap-[var(--space-2)]">
        <h1 className="t-heading-1">{t('title')}</h1>
        <p className="t-body text-[var(--text-muted)]">{t('lede')}</p>
        <p className="t-caption text-[var(--text-muted)]">{t('summary', { total: page.total })}</p>
      </header>

      <RegisterSearchForm
        value={view.search}
        onSubmit={(q) => onSearchChange(withSearch(search, q))}
      />

      <div
        className={
          selected === null
            ? 'min-w-0'
            : 'grid grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] items-start gap-[var(--space-5)]'
        }
      >
        <RegisterList
          page={page}
          view={view}
          onOpen={onOpen}
          onSortChange={(sort) => onSearchChange(withSort(search, sort))}
          onPageChange={(next) => onSearchChange(withPage(search, next))}
          onClearSearch={() => onSearchChange(withSearch(search, ''))}
          onReload={onReload}
        />
        {selected === null ? null : (
          <OrganizationRecord
            row={selected}
            onClose={() => onSearchChange(withSelected(search, null))}
          />
        )}
      </div>
    </div>
  );
}
