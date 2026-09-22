'use client';

import { BUTTON_VARIANT, Button, EmptyState } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { PANEL_MESSAGES } from '../../shared/panel-messages';
import styles from '../../styles/panel.module.css';

/**
 * The panel's *empty — filtered* (task 50.2.2): the centre holds notices and none is unread. Its one action clears the
 * filter — the *All* view, inside the panel, where every read notice still is.
 */
export function PanelNothingUnread({ onShowAll }: { readonly onShowAll: () => void }) {
  const t = useTranslations(`${PANEL_MESSAGES}.empty.nothingUnread`);
  return (
    <div className={styles.state}>
      <EmptyState
        title={t('title')}
        action={
          <Button type="button" variant={BUTTON_VARIANT.SUBTLE} onClick={onShowAll}>
            {t('action')}
          </Button>
        }
      >
        {t('body')}
      </EmptyState>
    </div>
  );
}
