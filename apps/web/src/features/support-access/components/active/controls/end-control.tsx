'use client';

import { Button, BUTTON_VARIANT } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { endSupportAccessAction } from '../../../actions/actions';
import { RefusalCallout } from '../../shared/refusal-callout';
import { SUPPORT_ACCESS_MESSAGES } from '../../shared/support-access-messages';
import { useSupportAccessAction } from '../../shared/use-support-access-action';
import styles from '../../styles/support-access.module.css';

/**
 * *End access now*, an Organization Administrator's (task 67.9). No confirmation: ending takes nothing from the
 * organization and gives nothing away — the operator can ask again, with a new reason, which needs a new grant.
 *
 * **Its words are its own** (task 158), from the running request's keys; the banner passes only which request.
 */
export function EndControl({ requestId }: { readonly requestId: string }) {
  const t = useTranslations(`${SUPPORT_ACCESS_MESSAGES}.active`);
  const { pending, refusal, run } = useSupportAccessAction();

  return (
    <div className={styles.controls}>
      <Button
        type="button"
        variant={BUTTON_VARIANT.SECONDARY}
        busy={pending}
        onClick={() => run(() => endSupportAccessAction({ requestId }))}
      >
        {t('end')}
      </Button>
      {refusal === null ? null : <RefusalCallout notice={refusal} />}
    </div>
  );
}
