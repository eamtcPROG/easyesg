import { NOTIFICATION_CATEGORY } from '@easyesg/contracts';
import { SKELETON_SHAPE, Skeleton } from '@easyesg/ui';
import { useTranslations } from 'use-intl';

/** One placeholder row per category the release raises — derived, so a category added to the vocabulary gains its row. */
const PLACEHOLDER_ROWS = Object.values(NOTIFICATION_CATEGORY).length;

/** A-17's *loading — initial* (task 67.10), announced once. */
export function CategoriesLoading() {
  const t = useTranslations('platform.notificationCategories');

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
