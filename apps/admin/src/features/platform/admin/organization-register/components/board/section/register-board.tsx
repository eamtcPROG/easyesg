import type { OrganizationRegisterRow } from '@easyesg/contracts';
import type { IndexPage } from '@easyesg/ui';
import { useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';
import { useTranslations } from 'use-intl';
import {
  withPage,
  withPageSize,
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
 * account-level record in a dialogue over it (task 170; `design_spec.md` §5.2's preamble).
 *
 * **Every change is a navigation**, through `register-search.ts`'s transitions, so the view the
 * operator sees is always the view the address holds (UX-4): a reload, a bookmark or a link pasted
 * into a support ticket reopens the same search, order, page, page size and record.
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
  const navigate = useNavigate();
  const selected =
    view.selected === null ? null : (page.rows.find((row) => row.id === view.selected) ?? null);

  // Stable, because the columns memoise on them — and `reactCompiler` is off (AD-9).
  const onOpen = useCallback(
    (id: string) => onSearchChange(withSelected(search, id)),
    [onSearchChange, search],
  );
  const onRequestAccess = useCallback(
    (id: string) => void navigate({ to: '/support-access', search: { organization: id } }),
    [navigate],
  );
  const onPageSizeChange = useCallback(
    (size: number) => onSearchChange(withPageSize(search, size)),
    [onSearchChange, search],
  );

  return (
    <div className="flex flex-col gap-[var(--space-6)] p-[var(--space-6)]" aria-busy={refreshing}>
      <header className="flex flex-col gap-[var(--space-2)]">
        <h1 className="t-heading-1">{t('title')}</h1>
        <p className="t-body text-[var(--text-muted)]">{t('lede')}</p>
        <p className="t-caption text-[var(--text-muted)]">{t('summary', { total: page.total })}</p>
      </header>

      <RegisterSearchForm
        value={view.search}
        onSubmit={(q) => onSearchChange(withSearch(search, q))}
      />

      <RegisterList
        page={page}
        view={view}
        onOpen={onOpen}
        onRequestAccess={onRequestAccess}
        onSortChange={(sort) => onSearchChange(withSort(search, sort))}
        onPageChange={(next) => onSearchChange(withPage(search, next))}
        onPageSizeChange={onPageSizeChange}
        onClearSearch={() => onSearchChange(withSearch(search, ''))}
        onReload={onReload}
      />

      {selected === null ? null : (
        <OrganizationRecord row={selected} onClose={() => onSearchChange(withSelected(search, null))} />
      )}
    </div>
  );
}
