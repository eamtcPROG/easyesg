import { Button, TextLink } from '@easyesg/ui';
import { FormPasswordField, FormSummary, FormTextField } from '@easyesg/ui/forms';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'use-intl';
import type { AdminRecoveryRequest } from '@easyesg/contracts';
import { EMAIL_SHAPE } from '../../tools/email-shape';

/**
 * A-01's third step (task 151) — the recovery sign-in: the address, the password again and one
 * recovery code, together (UC-212; `architecture.md` §12.5.6's task-144 row). It is the way back
 * when the authenticator is lost, and the one release from a lock that needs no other operator.
 *
 * **The address arrives prefilled and stays editable**, from whichever way in opened the step: the
 * one the factor challenge verified, or the one a lockout refusal answered. What is sent is the
 * form's own value, because the api judges the three together and answers one refusal for any of
 * them wrong — a prefill the operator could not correct would make a mistyped address unrecoverable
 * here. It never reaches the URL.
 *
 * **The password is asked again, not carried.** The credential step's form unmounted with its step,
 * which `sign-in-screen.tsx` records as a decision, and the factor step's challenge holds no password
 * the browser could read.
 *
 * Validation is field-level only, as the credential step's is: whether the code is unspent, the
 * password right and the address an operator's is the api's answer, arriving as the screen's failure.
 */
export function RecoveryStep({
  email,
  busy,
  onSubmit,
  onChangeAccount,
}: {
  readonly email: string;
  readonly busy: boolean;
  readonly onSubmit: (command: AdminRecoveryRequest) => void;
  readonly onChangeAccount: () => void;
}) {
  const t = useTranslations('realm.signIn');
  const { control, handleSubmit } = useForm<AdminRecoveryRequest>({
    mode: 'onTouched',
    defaultValues: { email, password: '', recoveryCode: '' },
  });

  const submit = handleSubmit(onSubmit);

  return (
    <form
      method="post"
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

      {/* Not a `CodeField`: a recovery code is sixteen characters in four groups rather than six
          digits, and nothing autofills it — so no `one-time-code`, and the browser is asked neither to
          remember, correct nor translate it. */}
      <FormTextField
        control={control}
        name="recoveryCode"
        label={t('recovery.codeLabel')}
        help={t('recovery.codeHelp')}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        translate="no"
        rules={{ required: t('recovery.codeMissing') }}
      />

      <Button type="submit" busy={busy}>
        {t('recovery.submit')}
      </Button>

      <p className="t-caption">
        <TextLink asChild>
          <button type="button" onClick={onChangeAccount} className="cursor-pointer">
            {t('changeAccount')}
          </button>
        </TextLink>
      </p>
    </form>
  );
}
