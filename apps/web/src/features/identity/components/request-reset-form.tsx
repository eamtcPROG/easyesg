'use client';

import { Button, Callout, Panel, TextLink } from '@easyesg/ui';
import { FormSummary, FormTextField } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { API_OUTCOME } from '@/lib/api-outcome';
import { Link } from '@/i18n/navigation';
import { requestPasswordResetAction } from '../actions';
import type { RequestResetResult } from '../types/action-results';
import styles from './identity-screens.module.css';
import { ROUTES } from '@/lib/routes';

/**
 * S-02 · Request a password reset (FR-6, UC-08) — the reset-request route from S-01.
 *
 * The answer is identical whether or not the address is registered (NFR-64), so the success
 * state asserts only the conditional fact the API asserted: IF an account exists, a link is on
 * its way. A locked account may always request one — the link is what releases the lock
 * (task 21) — which is why S-01's locked state routes here.
 *
 * States (§8.1 subset): rest · submitting · invalid · success (uniform) · error — recoverable
 * (the 429 throttle as received) · unreachable (bundled catalogue).
 */
interface RequestResetInput {
  email: string;
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function RequestResetForm() {
  const t = useTranslations('identity.resetRequest');
  const tCommon = useTranslations('identity');
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<RequestResetResult | null>(null);

  const { control, handleSubmit } = useForm<RequestResetInput>({ mode: 'onTouched' });

  const submit = handleSubmit((input) => {
    startTransition(async () => {
      setResult(await requestPasswordResetAction(input));
    });
  });

  if (result?.status === API_OUTCOME.Ok) {
    return (
      <Callout
        intent="success"
        title={t('sentTitle')}
        action={
          <TextLink asChild>
            <Link href={ROUTES.SIGN_IN}>{t('sentAction')}</Link>
          </TextLink>
        }
      >
        {t('sentBody')}
      </Callout>
    );
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className={styles.stack}>
      <FormSummary control={control} title={t('summaryTitle')} />

      {result?.status === API_OUTCOME.Problem ? (
        <Callout
          intent="error"
          title={result.problem.title ?? t('problemTitle')}
          action={t('problemAction')}
        >
          {result.problem.detail ?? t('problemBody')}
        </Callout>
      ) : null}

      {result?.status === API_OUTCOME.Unreachable ? (
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
            help={t('emailHelp')}
            type="email"
            autoComplete="username"
            inputMode="email"
            rules={{
              required: t('emailMissing'),
              pattern: { value: EMAIL_SHAPE, message: t('emailInvalid') },
            }}
          />

          <Button type="submit" busy={pending}>
            {t('submit')}
          </Button>
        </div>
      </Panel>

      <p className={styles.altAction}>
        <TextLink asChild>
          <Link href={ROUTES.SIGN_IN}>{t('backToSignIn')}</Link>
        </TextLink>
      </p>
    </form>
  );
}
