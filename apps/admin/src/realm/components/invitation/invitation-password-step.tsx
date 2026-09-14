import { Button } from '@easyesg/ui';
import { FormPasswordField, FormSummary } from '@easyesg/ui/forms';
import { passwordMeetsPolicy } from '@easyesg/validation';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslations } from 'use-intl';
import { PasswordRequirements } from '../shared/password-requirements';

interface PasswordInput {
  password: string;
}

/**
 * A-20's first step (task 67.4): the password the account will hold, with OQ-51's requirements shown
 * as it is typed — `PasswordRequirements`, the policy's own evaluation, which A-19's password section
 * reads too since task 151. The api still refuses on its own.
 *
 * `useWatch` for the one field the list reads, as S-02's form does, rather than a whole-form `watch()`.
 */
export function InvitationPasswordStep({
  busy,
  onSubmit,
}: {
  readonly busy: boolean;
  readonly onSubmit: (password: string) => void;
}) {
  const t = useTranslations('realm.invitation');
  const { control, handleSubmit } = useForm<PasswordInput>({ mode: 'onTouched' });

  const password = useWatch({ control, name: 'password' }) ?? '';

  const submit = handleSubmit((input) => onSubmit(input.password));

  return (
    <form
      method="post"
      onSubmit={(event) => void submit(event)}
      noValidate
      className="flex flex-col gap-[var(--space-4)]"
    >
      <FormSummary control={control} title={t('summaryTitle')} />

      <FormPasswordField
        control={control}
        name="password"
        label={t('password.passwordLabel')}
        autoComplete="new-password"
        revealLabel={t('password.show')}
        concealLabel={t('password.hide')}
        rules={{
          required: t('password.passwordMissing'),
          validate: (value) => passwordMeetsPolicy(value) || t('password.passwordWeak'),
        }}
      />

      <PasswordRequirements password={password} />

      <Button type="submit" busy={busy}>
        {t('password.submit')}
      </Button>
    </form>
  );
}
