import { Button, RequirementList } from '@easyesg/ui';
import { FormPasswordField, FormSummary } from '@easyesg/ui/forms';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  evaluatePasswordPolicy,
  passwordMeetsPolicy,
} from '@easyesg/validation';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslations } from 'use-intl';

interface PasswordInput {
  password: string;
}

/**
 * A-20's first step (task 67.4): the password the account will hold, with OQ-51's requirements shown
 * as it is typed — **the policy's own evaluation from `@easyesg/validation`**, the one the api applies,
 * so the list and the server's verdict cannot disagree (§9.8). The api still refuses on its own.
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
  const verdict = evaluatePasswordPolicy(password);
  const requirements = [
    {
      key: 'length',
      label: t('password.requirements.length', { minimum: PASSWORD_MIN_LENGTH, maximum: PASSWORD_MAX_LENGTH }),
      met: verdict.length,
    },
    { key: 'lowercase', label: t('password.requirements.lowercase'), met: verdict.lowercase },
    { key: 'uppercase', label: t('password.requirements.uppercase'), met: verdict.uppercase },
    { key: 'digit', label: t('password.requirements.digit'), met: verdict.digit },
    { key: 'further', label: t('password.requirements.further'), met: verdict.further },
  ];

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

      <RequirementList
        items={requirements}
        metLabel={t('password.requirements.met')}
        unmetLabel={t('password.requirements.unmet')}
      />

      <Button type="submit" busy={busy}>
        {t('password.submit')}
      </Button>
    </form>
  );
}
