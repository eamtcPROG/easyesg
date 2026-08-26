'use client';

import { Button, DataTable, EmptyState, Pagination } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { useAccess } from './access-context';
import { useAccessColumns, type AccessColumnKey } from './access-columns';
import {
  ACCESS_FILTER_ANY,
  ACCESS_PAGE_SIZE,
  accessRowKey,
  type AccessRow,
  type AccessSort,
} from '../access';

/**
 * The list itself: both empty states, the table and the pager.
 *
 * **`matched` and `total` are two numbers because they are two screens.** `total === 0` is first
 * use — nobody has been invited yet, and the one action is to invite someone. `matched === 0` with
 * rows behind it is a filter that found nothing, and the one action is to clear it. Collapsing them
 * would tell an administrator with nine colleagues that they are alone.
 */
export function AccessList() {
  const t = useTranslations('organization.access');
  const { page, view, now, inviteAnchorId, setView } = useAccess();
  const columns = useAccessColumns(now);

  const clearFilters = useCallback(
    () => setView({ role: ACCESS_FILTER_ANY, standing: ACCESS_FILTER_ANY }),
    [setView],
  );

  if (page.matched === 0) {
    const firstUse = page.total === 0;
    return (
      <EmptyState
        title={firstUse ? t('empty.firstUse.title') : t('empty.filtered.title')}
        action={
          firstUse ? (
            <Button asChild>
              <a href={`#${inviteAnchorId}`}>{t('empty.firstUse.action')}</a>
            </Button>
          ) : (
            <Button variant="subtle" onClick={clearFilters}>
              {t('empty.filtered.action')}
            </Button>
          )
        }
      >
        {firstUse ? t('empty.firstUse.body') : t('empty.filtered.body')}
      </EmptyState>
    );
  }

  return (
    <>
      <DataTable<AccessRow, AccessColumnKey>
        caption={t('caption')}
        columns={columns}
        rows={page.rows}
        rowKey={accessRowKey}
        sort={{ column: view.sort, direction: view.direction }}
        onSortChange={(sort) =>
          setView({ sort: sort.column as AccessSort, direction: sort.direction })
        }
        sortLabels={{
          sortBy: (columnHeader) => t('sort.sortBy', { column: columnHeader }),
          ascending: t('sort.ascending'),
          descending: t('sort.descending'),
        }}
      />
      <Pagination
        page={page.page}
        pageSize={ACCESS_PAGE_SIZE}
        total={page.matched}
        onPageChange={(next) => setView({ page: next })}
        labels={{
          region: t('pagination.region'),
          previous: t('pagination.previous'),
          next: t('pagination.next'),
          position: (of) => t('pagination.position', of),
        }}
      />
    </>
  );
}
