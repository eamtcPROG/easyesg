import { SKELETON_SHAPE, Skeleton } from '@easyesg/ui';
import { useTranslations } from 'use-intl';

const PLACEHOLDER_ROWS = 6;

/** A-03's *loading — initial* (task 67.5): the heading and the list's rows, as placeholders. */
export function ContentLoading() {
  const t = useTranslations('platform.content');

  return (
    <div className="flex flex-col gap-[var(--space-5)]" aria-busy="true">
      <p role="status" className="sr-only">
        {t('loading')}
      </p>
      <Skeleton shape={SKELETON_SHAPE.HEADING} className="w-[18rem]" />
      <div className="flex flex-col gap-[var(--space-2)]">
        {Array.from({ length: PLACEHOLDER_ROWS }, (_, index) => (
          <Skeleton key={index} shape={SKELETON_SHAPE.BLOCK} className="w-full" />
        ))}
      </div>
    </div>
  );
}
