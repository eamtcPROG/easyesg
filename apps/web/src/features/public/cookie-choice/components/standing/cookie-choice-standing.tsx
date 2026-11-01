'use client';

import { BUTTON_VARIANT, Button } from '@easyesg/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { answersPolicyInForce } from '../../tools/cookie-choice-cookie';
import { useCookieRecord } from '../shared/use-cookie-record';
import { COOKIE_CHOICE_MESSAGES } from '../shared/cookie-choice-messages';
import { requestCookieSettings } from '../shared/cookie-settings-request';
import styles from './cookie-choice-standing.module.css';

/**
 * The reader's answer as the cookie policy states it (task 223; `design_spec.md` S-30's controls, S-31's entry points):
 * when they answered the policy in force, or that they have not, and the button that opens the settings. **Read in the
 * browser**, from the same cookie the banner reads, so it changes the moment an answer lands — on this page too.
 *
 * Nothing until the browser's read is in, so the page never states an answer it has not seen.
 */
export function CookieChoiceStanding() {
  const t = useTranslations(COOKIE_CHOICE_MESSAGES);
  const format = useFormatter();
  const { known, record } = useCookieRecord();

  return (
    <div className={styles.standing}>
      {known ? (
        <p aria-live="polite">
          {answersPolicyInForce(record)
            ? t('standing.answered', { date: format.dateTime(new Date(record.chosenAt), 'long') })
            : t('standing.unanswered')}
        </p>
      ) : null}
      <Button variant={BUTTON_VARIANT.SECONDARY} onClick={requestCookieSettings}>
        {t('settingsButton')}
      </Button>
    </div>
  );
}
