'use client';

import { EmptyState } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { PANEL_MESSAGES } from '../../shared/panel-messages';
import styles from '../../styles/panel.module.css';

/**
 * The panel's *empty — first use* (task 50.2.2): nothing has reached this reader's centre. **No action of its own**:
 * nothing here can make a notice arrive, and the one way on — the centre itself — is the footer's link beneath it, so
 * a second copy of it here would offer the same place twice.
 */
export function PanelFirstUse() {
  const t = useTranslations(`${PANEL_MESSAGES}.empty.firstUse`);
  return (
    <div className={styles.state}>
      <EmptyState title={t('title')} action={null}>
        {t('body')}
      </EmptyState>
    </div>
  );
}
