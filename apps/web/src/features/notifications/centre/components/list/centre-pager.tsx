'use client';

import { Pagination } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { useRouter } from '@/i18n/navigation';
import { ROUTES, withQuery } from '@/lib/routes';
import { CENTRE_PAGE_SIZE, centreViewQuery, type CentreView } from '../../tools/centre-view';

/**
 * S-26's pager (task 50.2.1) — `packages/ui`'s Pagination over this screen's address, with the Index chrome's own
 * words (`chrome.index.pagination`, which `IndexView` reads for the tables). It renders nothing for one page.
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
    }),
    [t],
  );

  return (
    <Pagination
      page={page}
      pageSize={CENTRE_PAGE_SIZE}
      total={matched}
      onPageChange={(next) => router.push(withQuery(ROUTES.NOTIFICATIONS, centreViewQuery({ ...view, page: next })))}
      labels={labels}
    />
  );
}
