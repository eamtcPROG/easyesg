'use client';

import { Skeleton, SKELETON_SHAPE } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { HISTORY_MESSAGES } from '../../shared/history-messages';
import styles from '../../styles/history.module.css';

/** S-12's *loading — initial* (§8.1, UX-90): the entries' place held while the first page is read, and said aloud. */
export function HistoryLoading() {
  const t = useTranslations(HISTORY_MESSAGES);
  return (
    <div className={styles.loading}>
      <p className={styles.assistive} role="status">
        {t('loading')}
      </p>
      <Skeleton shape={SKELETON_SHAPE.BLOCK} className={styles.loadingRow} />
      <Skeleton shape={SKELETON_SHAPE.BLOCK} className={styles.loadingRow} />
      <Skeleton shape={SKELETON_SHAPE.BLOCK} className={styles.loadingRow} />
    </div>
  );
}
