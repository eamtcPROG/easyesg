import { SKELETON_SHAPE, Skeleton } from '@easyesg/ui';
import { useTranslations } from 'use-intl';

const PLACEHOLDER_ROWS = 3;

/**
 * A-07's *loading — initial* for a region (task 67.9), announced once.
 *
 * **In `components/shared/` on its readers**: the request region's organization read, the in-progress and log
 * sections, and the grant region's three reads — every region that waits on an answer draws the same wait.
 */
export function SupportAccessLoading() {
  const t = useTranslations('platform.supportAccess');

  return (
    <div className="flex flex-col gap-[var(--space-3)]" aria-busy="true">
      <p role="status" className="sr-only">
        {t('loading')}
      </p>
      {Array.from({ length: PLACEHOLDER_ROWS }, (_, index) => (
        <Skeleton key={index} shape={SKELETON_SHAPE.BLOCK} className="w-full" />
      ))}
    </div>
  );
}
