'use client';

import { BUTTON_VARIANT, Button } from '@easyesg/ui';
import { FormPasswordField, FormSummary } from '@easyesg/ui/forms';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { CredentialSubmit } from '@/shared/credential-submit';
import { changePasswordAction } from '../../actions/actions';
import { CREDENTIALS_SECTION } from '../../tools/credentials-state';
import { CREDENTIALS_MESSAGES, PASSWORD_MESSAGES } from '../shared/credentials-messages';
import { useCredentials, useSectionBusy } from '../shared/credentials-context';
import styles from '../styles/credentials.module.css';

/**
 * The password row, open — FR-7, UC-10.
 *
 * **The current password is this form's own field** (task 169; `design_spec.md` S-28, amended 24 Sep 2026), where it
 * was the record's gate from 28 Aug 2026. Only one row opens, so the screen still asks for the secret once.
 *
 * **The checkbox is the requirement, not a convenience.** FR-7 says *where the user elects it*, so termination is
 * opt-in, and the help text states what a reader would otherwise have to guess: the device they are on stays signed
 * in. No rule is mirrored here — the current-password check, the policy and §12.5.6's window are the api's, and its
 * refusal is what `RowNotice` renders above this form.
 */
interface PasswordFormValues {
  currentPassword: string;
  password: string;
  terminateOtherSessions: boolean;
}

export function PasswordForm() {
  const t = useTranslations(PASSWORD_MESSAGES);
  const tRecord = useTranslations(CREDENTIALS_MESSAGES);
  const tForms = useTranslations('forms');
  const { perform, succeeded, dismiss } = useCredentials();
  const busy = useSectionBusy(CREDENTIALS_SECTION.PASSWORD);
  const { control, handleSubmit, register, reset } = useForm<PasswordFormValues>({
    mode: 'onSubmit',
    defaultValues: { currentPassword: '', password: '', terminateOtherSessions: false },
  });

  const submit = handleSubmit((values) =>
    perform({
      section: CREDENTIALS_SECTION.PASSWORD,
      action: () =>
        changePasswordAction({
          currentPassword: values.currentPassword,
          password: values.password,
          terminateOtherSessions: values.terminateOtherSessions,
        }),
      onSuccess: () =>
        succeeded({
          title: t('doneTitle'),
          body: values.terminateOtherSessions ? t('doneWithSessions') : t('doneBody'),
        }),
      // Both passwords cleared whatever the outcome: after a refusal they are live credentials in the DOM, and after a
      // success one is a password the account no longer has.
      clear: () => reset(),
    }),
  );

  return (
    <form method="post" onSubmit={(event) => void submit(event)} noValidate className={styles.form}>
      <FormSummary control={control} title={tForms('summaryTitle')} />

      <FormPasswordField
        control={control}
        name="currentPassword"
        label={tRecord('currentPassword')}
        autoComplete="current-password"
        revealLabel={tForms('show')}
        concealLabel={tForms('hide')}
        rules={{ required: tRecord('currentMissing') }}
      />

      <FormPasswordField
        control={control}
        name="password"
        label={t('next')}
        autoComplete="new-password"
        revealLabel={tForms('show')}
        concealLabel={tForms('hide')}
        rules={{ required: t('nextMissing') }}
      />

      {/* A native checkbox, as it has been since task 27.7 — a platform control wearing the cascade's focus ring. */}
      <label className={styles.choice}>
        <input type="checkbox" {...register('terminateOtherSessions')} />
        <span className={styles.choiceText}>
          <span className="t-label">{t('terminate')}</span>
          <span className="t-caption">{t('terminateHelp')}</span>
        </span>
      </label>

      <div className={styles.actions}>
        <CredentialSubmit busy={busy}>{t('submit')}</CredentialSubmit>
        <Button type="button" variant={BUTTON_VARIANT.SUBTLE} disabled={busy} onClick={dismiss}>
          {tRecord('cancel')}
        </Button>
      </div>
    </form>
  );
}
