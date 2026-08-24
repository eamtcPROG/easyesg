'use client';

import { evaluatePasswordPolicy, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@easyesg/validation';
import { Button, Callout, Panel, RequirementList, TextLink } from '@easyesg/ui';
import { FormPasswordField, FormSummary, FormTextField } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { API_OUTCOME, type ApiFailure } from '@/lib/api-outcome';
import { Link, useRouter } from '@/i18n/navigation';
import { registerAction } from '../actions';
import { rememberPendingVerification } from '../pending-verification-store';
import styles from './identity-screens.module.css';

/**
 * S-01 · Register (UC-01) — email + password per the S-01 content list and the task-19 API.
 * The prototype's extra captures (full name, consent) are design_spec OQ-16, deliberately not
 * closed here.
 *
 * States (§8.1 subset for this surface): rest · submitting (busy button, pending-async) ·
 * invalid (inline errors + UX-111 summary) · error — recoverable (problem+json rendered as
 * received; unreachable from the bundled catalogue) · success (exit to the S-02 challenge).
 *
 * The password policy is displayed before entry and answers itself while typing (S-02's
 * "enforced on entry", via `@easyesg/validation` — the same evaluation the API runs, §9.8).
 * UX-108: nothing here blocks paste or autofill; `autoComplete="new-password"` invites the
 * password manager.
 */
interface RegisterInput {
  email: string;
  password: string;
}

/** Light shape check only — deliverability is unknowable client-side; the API is authoritative. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function RegisterForm() {
  const t = useTranslations('identity.register');
  const tCommon = useTranslations('identity');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<ApiFailure | null>(null);

  const { control, handleSubmit } = useForm<RegisterInput>({ mode: 'onTouched' });

  // `useWatch`, not `watch()`: it subscribes to this one field instead of re-rendering the form
  // on every change, and it is the API React Compiler can memoize — `watch()` is what
  // `react-hooks/incompatible-library` was warning about here.
  const password = useWatch({ control, name: 'password' }) ?? '';
  const verdict = evaluatePasswordPolicy(password);

  const requirements = [
    {
      key: 'length',
      label: t('requirements.length', {
        minimum: PASSWORD_MIN_LENGTH,
        maximum: PASSWORD_MAX_LENGTH,
      }),
      met: verdict.length,
    },
    { key: 'lowercase', label: t('requirements.lowercase'), met: verdict.lowercase },
    { key: 'uppercase', label: t('requirements.uppercase'), met: verdict.uppercase },
    { key: 'digit', label: t('requirements.digit'), met: verdict.digit },
    { key: 'further', label: t('requirements.further'), met: verdict.further },
  ];

  const submit = handleSubmit((input) => {
    setFailure(null);
    startTransition(async () => {
      const result = await registerAction(input);
      if (result.status === API_OUTCOME.Ok) {
        // The S-02 challenge screen states the address it was sent to. Session storage, not the
        // URL: an email address in a query string reaches server logs and history (constants.ts).
        rememberPendingVerification(result.value.email);
        router.push('/verify');
        return;
      }
      setFailure(result);
    });
  });

  const isConflict = failure?.status === API_OUTCOME.Problem && failure.problem.status === 409;

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className={styles.stack}>
      <FormSummary control={control} title={t('summaryTitle')} />

      {failure?.status === API_OUTCOME.Problem ? (
        <Callout
          intent="error"
          title={failure.problem.title ?? t('problemTitle')}
          action={
            isConflict ? (
              <TextLink asChild>
                <Link href="/sign-in">{t('signIn')}</Link>
              </TextLink>
            ) : (
              t('problemAction')
            )
          }
        >
          {failure.problem.detail ?? t('problemBody')}
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
            help={t('emailHelp')}
            type="email"
            autoComplete="email"
            inputMode="email"
            rules={{
              required: t('emailMissing'),
              pattern: { value: EMAIL_SHAPE, message: t('emailInvalid') },
            }}
          />

          <div className={styles.passwordGroup}>
            <FormPasswordField
              control={control}
              name="password"
              label={t('passwordLabel')}
              help={t('pasteHint')}
              autoComplete="new-password"
              revealLabel={t('show')}
              concealLabel={t('hide')}
              rules={{
                validate: (value) =>
                  evaluatePasswordPolicy(value ?? '').satisfied ||
                  t('passwordPolicy', {
                    minimum: PASSWORD_MIN_LENGTH,
                    maximum: PASSWORD_MAX_LENGTH,
                  }),
              }}
            />
            <RequirementList
              items={requirements}
              metLabel={t('met')}
              unmetLabel={t('unmet')}
            />
          </div>

          <Button type="submit" busy={pending}>
            {t('submit')}
          </Button>
        </div>
      </Panel>

      <p className={styles.altAction}>
        {t('alreadyHave')}{' '}
        <TextLink asChild>
          <Link href="/sign-in">{t('signIn')}</Link>
        </TextLink>
      </p>
    </form>
  );
}
