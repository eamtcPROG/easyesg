'use client';

import { BUTTON_VARIANT, Button, CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { HISTORY_MESSAGES } from '../../shared/history-messages';
import styles from '../../styles/history.module.css';

/**
 * S-12's *error — recoverable* (§8.1): the history could not be read. NFR-79's three parts — what happened, that the
 * record itself is untouched, and the way to try again, which is this panel's own to offer.
 */
export function HistoryUnreachable({ onRetry }: { readonly onRetry: () => void }) {
  const t = useTranslations(`${HISTORY_MESSAGES}.unreachable`);
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
