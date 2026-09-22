'use client';

import { Skeleton, SKELETON_SHAPE } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { PANEL_MESSAGES } from '../../shared/panel-messages';
import styles from '../../styles/panel.module.css';

/**
 * The panel's *loading — initial* (task 50.2.2; UX-115): three rows in the list's shape, hidden from assistive
 * technology, with one status line saying what is being waited for.
 */
export function PanelLoading() {
  const t = useTranslations(PANEL_MESSAGES);
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
