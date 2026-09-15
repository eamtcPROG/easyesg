'use client';

import { Button, BUTTON_VARIANT } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { declineSupportAccessAction, grantSupportAccessAction } from '../../../actions/actions';
import { RefusalCallout } from '../../shared/refusal-callout';
import { SUPPORT_ACCESS_MESSAGES } from '../../shared/support-access-messages';
import { useSupportAccessAction } from '../../shared/use-support-access-action';
import styles from '../../styles/support-access.module.css';

/**
 * *Grant* and *Decline* (task 67.9). No confirmation dialogue: the banner above the buttons already states what a
 * grant does, and the grant's own label carries its length. **Both buttons wait on either answer**, because the
 * two cannot both be sent — the second would be refused as no longer waiting.
 *
 * **Its words are its own** (task 158), from the waiting request's keys; the banner passes only which request.
 */
export function AnswerControls({ requestId }: { readonly requestId: string }) {
  const t = useTranslations(`${SUPPORT_ACCESS_MESSAGES}.awaiting`);
  const { pending, refusal, run } = useSupportAccessAction();

  return (
    <div className={styles.controls}>
      <div className={styles.buttons}>
        <Button
          type="button"
          disabled={pending}
          onClick={() => run(() => grantSupportAccessAction({ requestId }))}
        >
          {t('grant')}
        </Button>
        <Button
          type="button"
          variant={BUTTON_VARIANT.SECONDARY}
          disabled={pending}
          onClick={() => run(() => declineSupportAccessAction({ requestId }))}
        >
          {t('decline')}
        </Button>
      </div>
      {refusal === null ? null : <RefusalCallout notice={refusal} />}
    </div>
  );
}
