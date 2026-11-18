import { Skeleton } from '@easyesg/ui';
import { useTranslations } from 'use-intl';

/** A-04's loading — initial (§8.1): the regions' place held while the first read is in flight. */
export function TaxonomyLoading() {
  const t = useTranslations('platform.taxonomy');
  return (
    <div role="status" aria-label={t('loading')} className="flex flex-col gap-[var(--space-4)]">
      <Skeleton />
      <Skeleton />
      <Skeleton />
    </div>
  );
}
