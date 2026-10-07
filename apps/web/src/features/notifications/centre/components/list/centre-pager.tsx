'use client';

import { DEFAULT_PAGE_SIZE, PAGE_SIZES, Pagination, readPageSize } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { useRouter } from '@/i18n/navigation';
import { ROUTES, withQuery } from '@/lib/routes';
import { centreViewQuery, type CentreView } from '../../tools/centre-view';

/**
 * S-26's pager (task 50.2.1) — `packages/ui`'s Pagination over this screen's address, with the Index chrome's own
 * words (`chrome.index.pagination`, which `IndexView` reads for the tables). **It offers UX-141's page size since task
 * 203.1**, so it is drawn for one page too — the size is a choice even when every notice fits.
 */
export function CentrePager({
  page,
  matched,
  view,
}: {
  readonly page: number;
  readonly matched: number;
  readonly view: CentreView;
}) {
  const t = useTranslations('chrome.index.pagination');
  const router = useRouter();

  // A fresh object each render otherwise, reaching `Pagination` as a prop; `reactCompiler` is off (AD-9).
  const labels = useMemo(
    () => ({
      region: t('region'),
      previous: t('previous'),
      next: t('next'),
      position: (of: { from: number; to: number; total: number }) => t('position', of),
      page: (page: number) => t('page', { page }),
    }),
    [t],
  );

  // The same reasons as `labels`. A size change returns to the first page, as every other change of view does.
  const sizes = useMemo(
    () => ({
      options: PAGE_SIZES,
      label: t('pageSize'),
      onChange: (size: number) =>
        router.push(
          withQuery(
            ROUTES.NOTIFICATIONS,
            centreViewQuery({ ...view, page: 1, pageSize: readPageSize(size).onpage ?? DEFAULT_PAGE_SIZE }),
          ),
        ),
    }),
    [router, t, view],
  );

  return (
    <Pagination
      page={page}
      pageSize={view.pageSize}
      total={matched}
      onPageChange={(next) => router.push(withQuery(ROUTES.NOTIFICATIONS, centreViewQuery({ ...view, page: next })))}
      sizes={sizes}
      labels={labels}
    />
  );
}
