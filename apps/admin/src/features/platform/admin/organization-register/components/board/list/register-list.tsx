import type { OrganizationRegisterRow } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button, EmptyState, type IndexPage, type SortDirection } from '@easyesg/ui';
import { useTranslations } from 'use-intl';
import { IndexView } from '~/shared/index-view';
import { isRegisterSort, type RegisterSort, type RegisterView } from '../../../tools/register-search';
import { useRegisterColumns } from './register-columns';

/**
 * A-02's table (task 67.3), on the Index archetype with the console's chrome bound (`shared/index-view.tsx`).
 *
 * **Both empty states, and they teach opposite things** (§4.6, `IndexShell`'s rule): *first use* —
 * no organization has registered, and the console does not create one, so its action reloads — and
 * *filtered*, where the search matched nothing and the action clears it.
 */
export function RegisterList({
  page,
  view,
  onOpen,
  onSortChange,
  onPageChange,
  onClearSearch,
  onReload,
}: {
  readonly page: IndexPage<OrganizationRegisterRow>;
  readonly view: RegisterView;
  readonly onOpen: (id: string) => void;
  readonly onSortChange: (sort: { readonly column: RegisterSort; readonly direction: SortDirection }) => void;
  readonly onPageChange: (page: number) => void;
  readonly onClearSearch: () => void;
  readonly onReload: () => void;
}) {
  const t = useTranslations('platform.organizations');
  const columns = useRegisterColumns({ onOpen });

  return (
    <IndexView
      page={page}
      caption={t('table.caption')}
      columns={columns}
      rowKey={(row) => row.id}
      sort={{ column: view.sort, direction: view.direction }}
      onSortChange={(sort) => {
        // Only an ordering column emits a sort; IDNO has no control, and this is where that is true.
        if (isRegisterSort(sort.column)) onSortChange({ column: sort.column, direction: sort.direction });
      }}
      onPageChange={onPageChange}
      empty={{
        firstUse: (
          <EmptyState
            title={t('empty.firstUse.title')}
            action={
              <Button type="button" variant={BUTTON_VARIANT.SECONDARY} onClick={onReload}>
                {t('empty.firstUse.action')}
              </Button>
            }
          >
            {t('empty.firstUse.body')}
          </EmptyState>
        ),
        filtered: (
          <EmptyState
            title={t('empty.filtered.title')}
            action={
              <Button type="button" variant={BUTTON_VARIANT.SECONDARY} onClick={onClearSearch}>
                {t('empty.filtered.action')}
              </Button>
            }
          >
            {t('empty.filtered.body', { search: view.search })}
          </EmptyState>
        ),
      }}
    />
  );
}
