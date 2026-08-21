'use client';

import { evaluatePasswordPolicy, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@easyesg/validation';
import {
  Button,
  Callout,
  FormErrorSummary,
  Panel,
  PasswordField,
  RequirementList,
  TextLink,
} from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { API_OUTCOME } from '@/lib/api-outcome';
import { Link } from '@/i18n/navigation';
import { resetPasswordAction } from '../actions';
import type { ResetPasswordResult } from '../types/action-results';
import styles from './identity-screens.module.css';

/**
 * S-02 · Set a new password from a reset link (FR-6, UC-09) — `/set-password?token=…`.
 *
 * P5 binds here by name: consuming the link signs out EVERY existing session, and the screen
 * states that consequence before it happens — the info callout is not decoration, it is the
 * disclosure S-02's validation-behaviour row requires.
 *
 * The policy block reuses `identity.register`'s catalogue entries deliberately: it is the same
 * policy (§9.8 — one evaluation shared with the API), and a second authored copy of the same
 * five sentences in three locales is drift waiting for a rewording.
 *
 * States (§8.1 subset): rest · submitting · invalid · success (every session out, S-01
 * offered) · error — recoverable (expired/consumed link as received, the request route as the
 * way out) · unreachable (bundled catalogue).
 */
interface SetPasswordInput {
  password: string;
}

const PASSWORD_FIELD_ID = 'set-password-password';

export function SetPasswordForm({ token }: { token: string }) {
  const t = useTranslations('identity.setPassword');
  const tPolicy = useTranslations('identity.register');
  const tCommon = useTranslations('identity');
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ResetPasswordResult | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, submitCount },
  } = useForm<SetPasswordInput>({ mode: 'onTouched' });

  const password = watch('password') ?? '';
  const verdict = evaluatePasswordPolicy(password);

  const requirements = [
    {
      key: 'length',
      label: tPolicy('requirements.length', {
        minimum: PASSWORD_MIN_LENGTH,
        maximum: PASSWORD_MAX_LENGTH,
      }),
      met: verdict.length,
    },
    { key: 'lowercase', label: tPolicy('requirements.lowercase'), met: verdict.lowercase },
    { key: 'uppercase', label: tPolicy('requirements.uppercase'), met: verdict.uppercase },
    { key: 'digit', label: tPolicy('requirements.digit'), met: verdict.digit },
    { key: 'further', label: tPolicy('requirements.further'), met: verdict.further },
  ];

  const submit = handleSubmit((input) => {
    startTransition(async () => {
      setResult(await resetPasswordAction({ token, password: input.password }));
    });
  });

  if (result?.status === API_OUTCOME.Ok) {
    return (
      <Callout
        intent="success"
        title={t('successTitle')}
        action={
          <TextLink asChild>
            <Link href="/sign-in">{t('successAction')}</Link>
          </TextLink>
        }
      >
        {t('successBody')}
      </Callout>
    );
  }

  const summaryItems = errors.password
    ? [{ fieldId: PASSWORD_FIELD_ID, message: errors.password.message }]
    : [];

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className={styles.stack}>
      {submitCount > 0 && summaryItems.length > 0 ? (
        <FormErrorSummary title={t('summaryTitle')} items={summaryItems} />
      ) : null}

      {result?.status === API_OUTCOME.Problem ? (
        <Callout
          intent="error"
          title={result.problem.title ?? t('problemTitle')}
          action={
            <TextLink asChild>
              <Link href="/reset">{t('requestNew')}</Link>
            </TextLink>
          }
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

      <Callout intent="info" title={t('consequenceTitle')} action={t('consequenceAction')}>
        {t('consequenceBody')}
      </Callout>

      <Panel className={styles.formPanel}>
        <div className={styles.fields}>
          <div className={styles.passwordGroup}>
            <PasswordField
              id={PASSWORD_FIELD_ID}
              label={t('passwordLabel')}
              help={tPolicy('pasteHint')}
              autoComplete="new-password"
              revealLabel={tPolicy('show')}
              concealLabel={tPolicy('hide')}
              error={errors.password?.message}
              {...register('password', {
                validate: (value) =>
                  evaluatePasswordPolicy(value ?? '').satisfied ||
                  tPolicy('passwordPolicy', {
                    minimum: PASSWORD_MIN_LENGTH,
                    maximum: PASSWORD_MAX_LENGTH,
                  }),
              })}
            />
            <RequirementList
              items={requirements}
              metLabel={tPolicy('met')}
              unmetLabel={tPolicy('unmet')}
            />
          </div>

          <Button type="submit" busy={pending}>
            {t('submit')}
          </Button>
        </div>
      </Panel>
    </form>
  );
}
