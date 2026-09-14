import { SOCIAL_PROVIDER } from '@easyesg/contracts';
import { SKELETON_SHAPE, Skeleton } from '@easyesg/ui';
import { useTranslations } from 'use-intl';

/** One placeholder row per provider FR-2 names — derived, so a provider added to the vocabulary gains its row. */
const PLACEHOLDER_ROWS = Object.values(SOCIAL_PROVIDER).length;

/** A-18's *loading — initial* (task 67.11), announced once. */
export function ProvidersLoading() {
  const t = useTranslations('platform.identityProviders');

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
