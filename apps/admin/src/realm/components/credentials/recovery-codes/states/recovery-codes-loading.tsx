import { SKELETON_SHAPE, Skeleton } from '@easyesg/ui';
import { useTranslations } from 'use-intl';

/** A-19's *loading — initial*, for the recovery-code region only (task 151), announced once. */
export function RecoveryCodesLoading() {
  const t = useTranslations('realm.credentials.recoveryCodes');

  return (
    <div className="flex flex-col gap-[var(--space-3)]" aria-busy="true">
      <p role="status" className="sr-only">
        {t('loading')}
      </p>
      <Skeleton shape={SKELETON_SHAPE.BLOCK} className="w-[20rem]" />
      <Skeleton shape={SKELETON_SHAPE.BLOCK} className="w-[12rem]" />
    </div>
  );
}
