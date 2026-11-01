'use client';

import { ExpiringCallout, useDismissible } from '@easyesg/ui';
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
 * next screen (`switch-state.ts`), or until it leaves on its own or is closed (`design_spec.md` §8.1, 28 Sep 2026).
 *
 * **Dismissed by the failure, not by the notice built from it.** The notice is a new object on every render — and
 * this renders whenever the provider's value moves, on an unsent count or a pending choice — so keyed on it a closed
 * refusal would come straight back. The failure is the reducer's, the same object until the next choice.
 */
export function OrganizationSwitchNotice() {
  const { failure } = useOrganizationSwitch();
  const t = useTranslations(SWITCH_MESSAGES);
  const tForms = useTranslations('forms');
  const [shown, dismiss] = useDismissible(failure);
  if (shown === null) return null;

  const notice = failureNotice({
    outcome: shown,
    unreachable: { title: t('unreachable.title'), body: t('unreachable.body') },
  });
  return (
    <div className={styles.notice}>
      <ExpiringCallout
        intent={notice.intent}
        title={notice.title}
        action={notice.action}
        dismissLabel={tForms('closeMessage')}
        onDismiss={dismiss}
      >
        {notice.body}
      </ExpiringCallout>
    </div>
  );
}
