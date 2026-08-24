import { Button, FormErrorSummary, PasswordField, TextField } from '@easyesg/ui';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'use-intl';
import type { AdminChallengeRequest } from '@easyesg/contracts';

/**
 * A-01 step one — the credential that opens the sealed five-minute challenge (UC-68, FR-75).
 *
 * Everything this component owns is its own form: the `useForm` instance, the field ids UX-111's
 * summary links to, and the field-level messages. `SignInScreen` owns the flow and hands it a
 * submit, so the whole contract is "collect a well-shaped credential and give it to the caller" —
 * it knows nothing about challenges, mutations or what comes next.
 *
 * The submitted type is the **wire** type rather than a local mirror: a field added to
 * `AdminChallengeRequestDto` then fails `pnpm typecheck` here, instead of arriving `undefined` at
 * the api.
 *
 * Validation here is field-level only — present, and shaped like an address. That is the split
 * §12.1 draws and not a shortcut: business rules are interpreted from `packages/validation`'s
 * definitions so the server verdict and the inline verdict cannot drift, and whether a credential
 * is *correct* is the api's answer — it arrives as the screen's failure, uniform and throttled.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMAIL_FIELD_ID = 'admin-sign-in-email';
const PASSWORD_FIELD_ID = 'admin-sign-in-password';

export function CredentialStep({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (command: AdminChallengeRequest) => void;
}) {
  const t = useTranslations('realm.signIn');
  const form = useForm<AdminChallengeRequest>({ mode: 'onTouched' });
  const { errors, submitCount } = form.formState;

  const submit = form.handleSubmit(onSubmit);

  const summary = [
    errors.email ? { fieldId: EMAIL_FIELD_ID, message: errors.email.message } : null,
    errors.password ? { fieldId: PASSWORD_FIELD_ID, message: errors.password.message } : null,
  ].filter((item) => item !== null);

  return (
    <form
      onSubmit={(event) => void submit(event)}
      noValidate
      className="flex flex-col gap-[var(--space-4)]"
    >
      {submitCount > 0 && summary.length > 0 ? (
        <FormErrorSummary title={t('summaryTitle')} items={summary} />
      ) : null}

      <TextField
        id={EMAIL_FIELD_ID}
        label={t('credential.emailLabel')}
        type="email"
        autoComplete="username"
        inputMode="email"
        error={errors.email?.message}
        {...form.register('email', {
          required: t('credential.emailMissing'),
          pattern: { value: EMAIL_SHAPE, message: t('credential.emailInvalid') },
        })}
      />

      <PasswordField
        id={PASSWORD_FIELD_ID}
        label={t('credential.passwordLabel')}
        autoComplete="current-password"
        revealLabel={t('credential.show')}
        concealLabel={t('credential.hide')}
        error={errors.password?.message}
        {...form.register('password', { required: t('credential.passwordMissing') })}
      />

      <Button type="submit" busy={busy}>
        {t('credential.submit')}
      </Button>
    </form>
  );
}
