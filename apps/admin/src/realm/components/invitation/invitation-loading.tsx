import { Panel, SKELETON_SHAPE, Skeleton } from '@easyesg/ui';
import { useTranslations } from 'use-intl';

/** A-20's *loading — initial*: the link is being read before anything is offered (task 67.4). */
export function InvitationLoading() {
  const t = useTranslations('realm.invitation');

  return (
    <Panel className="flex flex-col gap-[var(--space-4)]" aria-busy="true">
      <p role="status" className="sr-only">
        {t('loading')}
      </p>
      <Skeleton shape={SKELETON_SHAPE.HEADING} className="w-[16rem]" />
      <Skeleton shape={SKELETON_SHAPE.BLOCK} className="w-full" />
      <Skeleton shape={SKELETON_SHAPE.BLOCK} className="w-full" />
    </Panel>
  );
}
