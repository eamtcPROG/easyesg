'use client';

import type { AccountSetup } from '@easyesg/contracts';
import { useTranslations } from 'next-intl';
import { setFirstPasswordAction } from '../../actions/actions';
import styles from '../../../shared/styles/identity-screens.module.css';
import { SETUP_MESSAGES } from '../shared/setup-messages';
import { SignOut } from '../shared/sign-out';
import { PasswordForm } from './password-form';

/**
 * S-36's password step for a signed-in account in setup (task 155) — the proof is the session's own
 * provider sign-in, which the API accepts for a quarter-hour.
 *
 * Its way on when that proof has lapsed is leaving: a fresh provider sign-in is what the API asks for,
 * and S-01 is closed to a reader who still holds a session (`SignOut` says why). **Signing out is on
 * offer at rest too** — S-36's controls — composed beside the form, which knows nothing of it.
 */
export function SessionPasswordStep({
  setup,
  returnTo,
}: {
  readonly setup: AccountSetup;
  readonly returnTo?: string;
}) {
  const t = useTranslations(SETUP_MESSAGES);
  // The account menu's own words for the same act — one sentence, wherever signing out is offered.
  const tAccount = useTranslations('chrome.accountMenu');

  return (
    <div className={styles.stack}>
      <PasswordForm
        intro={t('passwordIntro', { email: setup.email })}
        submit={(password) => setFirstPasswordAction({ password, returnTo })}
        staleAction={<SignOut label={t('signOutAgain')} />}
      />
      <SignOut label={tAccount('signOut')} />
    </div>
  );
}
