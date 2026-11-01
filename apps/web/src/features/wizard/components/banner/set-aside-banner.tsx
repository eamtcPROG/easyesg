'use client';

import { Banner, CALLOUT_INTENT } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useAutosaveContext } from '../providers/autosave-context';
import { SetAsideItem } from './set-aside-item';
import styles from './set-aside.module.css';

/**
 * What the api refused for each write's own sake, named (task 218; §12.5.6's task-218 row (3)) — the rest of the queue
 * having been stored. It stands for as long as anything is set aside, beside the indicator's *failed*, and each row
 * leads to its field or lets the change go. **It offers no retry**: the same write would be refused again, and the
 * reporter's answer to a refusal is a change to the field, which sends itself.
 */
export function SetAsideBanner() {
  const t = useTranslations('organization.wizard.queue');
  const { state, discard, reportId } = useAutosaveContext();
  const items = Object.values(state.setAside);
  if (items.length === 0) return null;

  return (
    <Banner intent={CALLOUT_INTENT.ERROR} title={t('setAsideTitle', { count: items.length })} action={null}>
      {t('setAsideBody')}
      <ul className={styles.list}>
        {items.map((item) => (
          <SetAsideItem key={item.key} item={item} reportId={reportId} onDiscard={discard} />
        ))}
      </ul>
    </Banner>
  );
}
