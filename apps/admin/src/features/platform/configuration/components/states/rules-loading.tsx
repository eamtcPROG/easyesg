import { Skeleton } from '@easyesg/ui';
import { useTranslations } from 'use-intl';

/** A-05's loading — initial (§8.1). */
export function RulesLoading() {
  const t = useTranslations('platform.rules');
  return (
    <div role="status" aria-label={t('loading')} className="flex flex-col gap-[var(--space-4)]">
      <Skeleton />
      <Skeleton />
    </div>
  );
}
