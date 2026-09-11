'use client';

import { Button, BUTTON_VARIANT, EmptyState } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { IndexView } from '@/shared/index-view';
import { useAccess } from './access-context';
import { useAccessColumns } from './access-columns';
import type { AccessColumnKey } from '../access';
import { ACCESS_FILTER_ANY, accessRowKey, type AccessRow, type AccessSort } from '../access';

/**
 * S-16's list, as an instance of the Index archetype (§4.6).
 *
 * Everything that is not about *this* screen moved into `IndexShell` and the app's `IndexView`
 * binding: the empty-state choice and its rule, the table-and-pager composition, and the seven
 * chrome strings every Index needs. What is left is what only S-16 knows — its columns, its
 * caption, and two empty states that teach something specific.
 *
 * **The two empty states are still written here, and that is the point of them.** §4.6 requires an
 * Index to have "an empty state that teaches", which means naming the actual object: someone with
 * no colleagues yet is told to invite one, and someone whose filter matched nobody is told to clear
 * it. A shared component could only have offered a shrug.
 */
export function AccessList() {
  const t = useTranslations('organization.access');
  const { page, view, now, inviteAnchorId, setView } = useAccess();
  const columns = useAccessColumns(now);

  const clearFilters = useCallback(
    () => setView({ role: ACCESS_FILTER_ANY, standing: ACCESS_FILTER_ANY }),
    [setView],
  );

  return (
    <IndexView<AccessRow, AccessColumnKey>
      page={page}
      caption={t('caption')}
      columns={columns}
      rowKey={accessRowKey}
      sort={{ column: view.sort, direction: view.direction }}
      onSortChange={(sort) =>
        setView({ sort: sort.column as AccessSort, direction: sort.direction })
      }
      onPageChange={(next) => setView({ page: next })}
      empty={{
        firstUse: (
          <EmptyState
            title={t('empty.firstUse.title')}
            action={
              <Button asChild>
                <a href={`#${inviteAnchorId}`}>{t('empty.firstUse.action')}</a>
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
              <Button variant={BUTTON_VARIANT.SUBTLE} onClick={clearFilters}>
                {t('empty.filtered.action')}
              </Button>
            }
          >
            {t('empty.filtered.body')}
          </EmptyState>
        ),
      }}
    />
  );
}
