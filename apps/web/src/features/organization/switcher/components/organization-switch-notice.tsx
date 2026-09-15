'use client';

import { Callout } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { failureNotice } from '@/lib/notice';
import { useOrganizationSwitch } from './organization-switch-provider';
import { SWITCH_MESSAGES } from './switch-messages';
import styles from './switch.module.css';

/**
 * A refused switch, said below the band (task 83.2; NFR-79).
 *
 * **Below the band rather than in the menu that made the choice**, because that menu has closed by the time
 * the api answers — and in the compact frame so has the drawer around it. The refusal is the api's own three
 * parts, as received; the bundled words only when no answer arrived. It stands until the next choice or the
 * next screen (`switch-state.ts`).
 */
export function OrganizationSwitchNotice() {
  const { failure } = useOrganizationSwitch();
  const t = useTranslations(SWITCH_MESSAGES);
  if (failure === null) return null;

  const notice = failureNotice({
    outcome: failure,
    unreachable: { title: t('unreachable.title'), body: t('unreachable.body') },
  });
  return (
    <div className={styles.notice}>
      <Callout intent={notice.intent} title={notice.title} action={notice.action}>
        {notice.body}
      </Callout>
    </div>
  );
}
