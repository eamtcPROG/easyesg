import { Button } from '@easyesg/ui';
import { FormPasswordField, FormSummary, FormTextField } from '@easyesg/ui/forms';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'use-intl';
import type { AdminChallengeRequest } from '@easyesg/contracts';

/**
 * A-01 step one — the credential that opens the sealed five-minute challenge (UC-68, FR-75).
 *
 * Everything this component owns is its own form. `SignInScreen` owns the flow and hands it a
 * submit, so the whole contract is "collect a well-shaped credential and give it to the caller" —
 * it knows nothing about challenges, mutations or what comes next.
 *
 * The submitted type is the **wire** type rather than a local mirror: a field added to
 * `AdminChallengeRequestDto` then fails `pnpm typecheck` here, instead of arriving `undefined` at
 * the api. It doubles as the form's field-name type, so `name="email"` is checked against the
 * DTO rather than being a string nobody validates.
 *
 * Validation here is field-level only — present, and shaped like an address. That is the split
 * §12.1 draws and not a shortcut: business rules are interpreted from `packages/validation`'s
 * definitions so the server verdict and the inline verdict cannot drift, and whether a credential
 * is *correct* is the api's answer — it arrives as the screen's failure, uniform and throttled.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function CredentialStep({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (command: AdminChallengeRequest) => void;
}) {
  const t = useTranslations('realm.signIn');
  const { control, handleSubmit } = useForm<AdminChallengeRequest>({ mode: 'onTouched' });

  const submit = handleSubmit(onSubmit);

  return (
    <form
      onSubmit={(event) => void submit(event)}
      noValidate
      className="flex flex-col gap-[var(--space-4)]"
    >
      <FormSummary control={control} title={t('summaryTitle')} />

      <FormTextField
        control={control}
        name="email"
        label={t('credential.emailLabel')}
        type="email"
        autoComplete="username"
        inputMode="email"
        rules={{
          required: t('credential.emailMissing'),
          pattern: { value: EMAIL_SHAPE, message: t('credential.emailInvalid') },
        }}
      />

      <FormPasswordField
        control={control}
        name="password"
        label={t('credential.passwordLabel')}
        autoComplete="current-password"
        revealLabel={t('credential.show')}
        concealLabel={t('credential.hide')}
        rules={{ required: t('credential.passwordMissing') }}
      />

      <Button type="submit" busy={busy}>
        {t('credential.submit')}
      </Button>
    </form>
  );
}
