import {
  Button,
  Callout,
  FormErrorSummary,
  Panel,
  PasswordField,
  TextField,
} from '@easyesg/ui';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'use-intl';
import { API_OUTCOME, type AdminAccount, type ApiFailure } from '@easyesg/contracts';
import { signIn } from './session';

/**
 * A-01 · Admin sign-in (UC-68, FR-75) — email, password and the mandatory TOTP code, on the
 * Focus archetype like S-01, built from the same §11.5 inventory (UX-89).
 *
 * States (§8.1 subset): rest · submitting · invalid (inline + UX-111 summary) · error —
 * recoverable, as received: the api's resolved wording already distinguishes the uniform
 * credential refusal, the failed factor (disclosed only past the credential bar), the lockout
 * (whose release is an operator action, not a reset link) and the throttle — so unlike S-01
 * this screen branches on nothing. UX-108: paste and password managers work everywhere;
 * `one-time-code` is what surfaces platform autofill for the TOTP field.
 *
 * Success is handed UP (`onSignedIn`) rather than navigated here, so the screen stays free of
 * router context — the route wires navigation and the session cache, and the spec renders the
 * screen alone.
 */
interface AdminSignInInput {
  email: string;
  password: string;
  totpCode: string;
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMAIL_FIELD_ID = 'admin-sign-in-email';
const PASSWORD_FIELD_ID = 'admin-sign-in-password';
const TOTP_FIELD_ID = 'admin-sign-in-totp';

export function SignInScreen({ onSignedIn }: { onSignedIn: (account: AdminAccount) => void }) {
  const t = useTranslations('realm.signIn');
  const tCommon = useTranslations('realm');
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<ApiFailure | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, submitCount },
  } = useForm<AdminSignInInput>({ mode: 'onTouched' });

  const submit = handleSubmit((input) => {
    setFailure(null);
    startTransition(async () => {
      const outcome = await signIn(input);
      if (outcome.status === API_OUTCOME.Ok) {
        onSignedIn(outcome.value);
        return;
      }
      setFailure(outcome);
    });
  });

  const summaryItems = [
    errors.email ? { fieldId: EMAIL_FIELD_ID, message: errors.email.message } : null,
    errors.password ? { fieldId: PASSWORD_FIELD_ID, message: errors.password.message } : null,
    errors.totpCode ? { fieldId: TOTP_FIELD_ID, message: errors.totpCode.message } : null,
  ].filter((item) => item !== null);

  return (
    <form onSubmit={(event) => void submit(event)} noValidate>
      {submitCount > 0 && summaryItems.length > 0 ? (
        <FormErrorSummary title={t('summaryTitle')} items={summaryItems} />
      ) : null}

      {failure?.status === API_OUTCOME.Problem ? (
        <Callout
          intent="error"
          title={failure.problem.title ?? t('problemTitle')}
          action={t('problemAction')}
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

      <Panel>
        <TextField
          id={EMAIL_FIELD_ID}
          label={t('emailLabel')}
          type="email"
          autoComplete="username"
          inputMode="email"
          error={errors.email?.message}
          {...register('email', {
            required: t('emailMissing'),
            pattern: { value: EMAIL_SHAPE, message: t('emailInvalid') },
          })}
        />

        <PasswordField
          id={PASSWORD_FIELD_ID}
          label={t('passwordLabel')}
          autoComplete="current-password"
          revealLabel={t('show')}
          concealLabel={t('hide')}
          error={errors.password?.message}
          {...register('password', { required: t('passwordMissing') })}
        />

        <TextField
          id={TOTP_FIELD_ID}
          label={t('totpLabel')}
          help={t('totpHelp')}
          autoComplete="one-time-code"
          inputMode="numeric"
          error={errors.totpCode?.message}
          {...register('totpCode', { required: t('totpMissing') })}
        />

        <Button type="submit" busy={pending}>
          {t('submit')}
        </Button>
      </Panel>
    </form>
  );
}
