'use client';

import { Callout, CALLOUT_INTENT, Checkbox, TextLink } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { setFirstPasswordByGrantAction } from '../../actions/actions';
import { SETUP_MESSAGES } from '../shared/setup-messages';
import { PasswordForm } from './password-form';

/**
 * S-36's password step on S-02's path (task 155) — the proof is the grant the confirmation held, and
 * the person is signed in once the password is set. Rendered at `/register/password`.
 *
 * **It asks whether to keep the person signed in on this device** — S-01's control and S-01's sentence
 * — because this step issues a session and is a form that can carry the answer (§12.5.6's task-155 row
 * (4)). One value nothing else moves with, so a `useState` read when the form submits, composed into the
 * shared form as its `children` rather than made a field of a form the other step has no such choice for.
 *
 * **Its ways on are S-01's**, and here they are open: the account holds no session yet, so sign-in
 * is reachable, and from there both a provider sign-in and a password link serve it. For the same
 * reason there is no sign-out here: nothing is signed in to leave.
 */
export function GrantPasswordStep({ email }: { readonly email: string }) {
  const t = useTranslations(SETUP_MESSAGES);
  // S-01's own words for the same choice (OQ-35): one control, one sentence.
  const tSignIn = useTranslations('identity.signIn');
  const [remember, setRemember] = useState(false);

  const toSignIn = (label: string) => (
    <TextLink asChild>
      <Link href={ROUTES.SIGN_IN}>{label}</Link>
    </TextLink>
  );

  return (
    <PasswordForm
      intro={t('passwordIntroGrant', { email })}
      submit={(password) => setFirstPasswordByGrantAction({ password, remember })}
      staleAction={toSignIn(t('signInAgain'))}
      lapsed={
        <Callout
          intent={CALLOUT_INTENT.WARNING}
          title={t('grantLapsedTitle')}
          action={toSignIn(t('grantLapsedAction'))}
        >
          {t('grantLapsedBody')}
        </Callout>
      }
    >
      <Checkbox
        name="remember"
        label={tSignIn('remember')}
        checked={remember}
        onChange={(event) => setRemember(event.currentTarget.checked)}
      />
    </PasswordForm>
  );
}
