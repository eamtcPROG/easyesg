import { SKELETON_SHAPE, Skeleton } from '@easyesg/ui';
import { useTranslations } from 'use-intl';

/** Enough rows to hold the table's place without a shift when the first page resolves (§8.1). */
const PLACEHOLDER_ROWS = 8;

/**
 * §8.1's *loading — initial* for A-02: a skeleton shaped like the heading, the search and the table,
 * so nothing moves when the first page arrives. Announced once as a status rather than drawn as text,
 * because the shapes are the visible half and a spinner beside them would say the same thing twice.
 */
export function RegisterLoading() {
  const t = useTranslations('platform.organizations');

  return (
    <div className="flex flex-col gap-[var(--space-5)] p-[var(--space-6)]" aria-busy="true">
      <p role="status" className="sr-only">
        {t('loading')}
      </p>
      <Skeleton shape={SKELETON_SHAPE.HEADING} className="w-[16rem]" />
      <Skeleton shape={SKELETON_SHAPE.BLOCK} className="w-full max-w-[28rem]" />
      <div className="flex flex-col gap-[var(--space-2)]">
        {Array.from({ length: PLACEHOLDER_ROWS }, (_, index) => (
          <Skeleton key={index} shape={SKELETON_SHAPE.BLOCK} className="w-full" />
        ))}
      </div>
    </div>
  );
}
