'use client';

import { PROBLEM_TYPE } from '@easyesg/contracts';
import { Button, Callout, Panel, TextLink } from '@easyesg/ui';
import { FormPasswordField, FormSummary, FormTextField } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { API_OUTCOME } from '@/lib/api-outcome';
import { Link } from '@/i18n/navigation';
import { signInAction } from '../actions';
import { rememberPendingVerification } from '../pending-verification-store';
import type { SignInFailure } from '../types/action-results';
import styles from './identity-screens.module.css';

/**
 * S-01 · Sign in (FR-4, UC-04) — email + password. Provider sign-in shares this surface per
 * S-01's content list and arrives with its adapters in task 24, exactly as registration left
 * that gap (task 20).
 *
 * States (§8.1 subset): rest · submitting · invalid (inline + UX-111 summary) · error —
 * recoverable, in four wire shapes the API distinguishes and this screen must too:
 *
 *  - the uniform 401 (unknown address and wrong password answer one document, NFR-64) and the
 *    429 throttle — rendered as received, no branch;
 *  - `email-unverified` (OQ-57: the password was CORRECT) — names verification as the blocker
 *    and routes to S-02's resend, with the address handed off the same way registration does;
 *  - `account-locked` — the reset link is the only release before Phase 8 (task 21), so the
 *    action slot routes there instead of a dead "try again".
 *
 * Success never renders: the action redirects (UX-38's `?return=` target, or the §4.3 landing
 * — task 25 owns the real membership branch).
 *
 * UX-108: no cognitive test, paste works, `autoComplete="username"`/`"current-password"` is
 * what hands the pair to a password manager.
 */
interface SignInInput {
  email: string;
  password: string;
}

/** Light shape check only — the API is authoritative, and NFR-64 keeps its answer uniform. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignInForm({ returnTo }: { returnTo?: string }) {
  const t = useTranslations('identity.signIn');
  const tCommon = useTranslations('identity');
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<SignInFailure>(undefined);

  const { control, handleSubmit } = useForm<SignInInput>({ mode: 'onTouched' });

  const submit = handleSubmit((input) => {
    setFailure(undefined);
    startTransition(async () => {
      const result = await signInAction({ ...input, returnTo });
      // `undefined` means the redirect won and this tree is already unmounting.
      if (!result) return;
      if (
        result.status === API_OUTCOME.Problem &&
        result.problem.type === PROBLEM_TYPE.EmailUnverified
      ) {
        // OQ-57's exit: the resend challenge needs the address, handed off exactly as
        // registration hands it (session storage, never the URL — constants.ts).
        rememberPendingVerification(input.email);
      }
      setFailure(result);
    });
  });

  const problem = failure?.status === API_OUTCOME.Problem ? failure.problem : null;
  const isUnverified = problem?.type === PROBLEM_TYPE.EmailUnverified;
  const isLocked = problem?.type === PROBLEM_TYPE.AccountLocked;

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className={styles.stack}>
      <FormSummary control={control} title={t('summaryTitle')} />

      {problem ? (
        <Callout
          intent={isUnverified ? 'warning' : 'error'}
          title={problem.title ?? t('problemTitle')}
          action={
            isUnverified ? (
              <TextLink asChild>
                <Link href="/verify">{t('unverifiedAction')}</Link>
              </TextLink>
            ) : isLocked ? (
              <TextLink asChild>
                <Link href="/reset">{t('lockedAction')}</Link>
              </TextLink>
            ) : (
              t('problemAction')
            )
          }
        >
          {problem.detail ?? t('problemBody')}
        </Callout>
      ) : null}

      {failure?.status === API_OUTCOME.Unreachable ? (
        <Callout
          intent="error"
          title={tCommon('unreachable.title')}
          action={tCommon('unreachable.action')}
        >
          {tCommon('unreachable.body')}
        </Callout>
      ) : null}

      <Panel className={styles.formPanel}>
        <div className={styles.fields}>
          <FormTextField
            control={control}
            name="email"
            label={t('emailLabel')}
            type="email"
            autoComplete="username"
            inputMode="email"
            rules={{
              required: t('emailMissing'),
              pattern: { value: EMAIL_SHAPE, message: t('emailInvalid') },
            }}
          />

          <FormPasswordField
            control={control}
            name="password"
            label={t('passwordLabel')}
            autoComplete="current-password"
            revealLabel={t('show')}
            concealLabel={t('hide')}
            rules={{ required: t('passwordMissing') }}
          />

          <Button type="submit" busy={pending}>
            {t('submit')}
          </Button>
        </div>
      </Panel>

      <p className={styles.altAction}>
        <TextLink asChild>
          <Link href="/reset">{t('forgot')}</Link>
        </TextLink>
      </p>

      <p className={styles.altAction}>
        {t('noAccount')}{' '}
        <TextLink asChild>
          <Link href="/register">{t('register')}</Link>
        </TextLink>
      </p>
    </form>
  );
}
