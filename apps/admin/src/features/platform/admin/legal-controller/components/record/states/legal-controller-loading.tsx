import { SKELETON_SHAPE, Skeleton } from '@easyesg/ui';
import { useTranslations } from 'use-intl';

/** One placeholder per fact the record holds — the registered name, the IDNO, the address and the contact. */
const PLACEHOLDER_FIELDS = 4;

/** A-21's *loading — initial* (task 75), announced once. */
export function LegalControllerLoading() {
  const t = useTranslations('platform.legalController');

  return (
    <div className="flex flex-col gap-[var(--space-5)]" aria-busy="true">
      <p role="status" className="sr-only">
        {t('loading')}
      </p>
      <Skeleton shape={SKELETON_SHAPE.HEADING} className="w-[18rem]" />
      <div className="flex flex-col gap-[var(--space-2)]">
        {Array.from({ length: PLACEHOLDER_FIELDS }, (_, index) => (
          <Skeleton key={index} shape={SKELETON_SHAPE.BLOCK} className="w-full" />
        ))}
      </div>
    </div>
  );
}
