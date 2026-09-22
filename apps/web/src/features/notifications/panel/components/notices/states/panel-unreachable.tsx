'use client';

import { BUTTON_VARIANT, Button, CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { PANEL_MESSAGES } from '../../shared/panel-messages';
import styles from '../../styles/panel.module.css';

/**
 * The panel's *error — recoverable* (task 50.2.2): the list did not answer. It says nothing is lost, and its remedy is
 * to ask again — here, rather than a reload, because the panel's read is its own and a reload would close it.
 */
export function PanelUnreachable({ onRetry }: { readonly onRetry: () => void }) {
  const t = useTranslations(`${PANEL_MESSAGES}.unreachable`);
  return (
    <div className={styles.state}>
      <Callout
        intent={CALLOUT_INTENT.ERROR}
        title={t('title')}
        action={
          <Button type="button" variant={BUTTON_VARIANT.SUBTLE} onClick={onRetry}>
            {t('action')}
          </Button>
        }
      >
        {t('body')}
      </Callout>
    </div>
  );
}
