'use client';

import { Button } from '@easyesg/ui';
import { FormPasswordField, FormSummary } from '@easyesg/ui/forms';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { changePasswordAction } from '../actions';
import type { CredentialsSectionProps } from './section-props';
import styles from './credentials.module.css';

/**
 * S-28's password section — FR-7, UC-10.
 *
 * **The checkbox is the requirement, not a convenience.** FR-7 says *where the user elects it*, so
 * termination is opt-in, and the help text states what a reader would otherwise have to guess: the
 * device they are on stays signed in. Defaulting it on would sign someone out of their phone for
 * changing a password, which nobody asked for.
 *
 * No rule is mirrored here. The current-password check, the policy and §12.5.6's window are the
 * API's, and its refusals are what the screen renders — NFR-79's three parts, as received.
 */
interface PasswordForm {
  currentPassword: string;
  password: string;
  terminateOtherSessions: boolean;
}

export function PasswordSection({ busy, onStart, onSettled }: CredentialsSectionProps) {
  const t = useTranslations('identity.credentials.password');
  // The reveal toggle's accessible names. Borrowed from `identity.register` rather than copied
  // into this namespace: `packages/ui` owns no text, and two catalogues saying "Show" is two
  // places a wording change has to reach. `set-password-form.tsx` already does the same.
  const tPolicy = useTranslations('identity.register');
  const { control, handleSubmit, register, reset } = useForm<PasswordForm>({
    mode: 'onTouched',
    defaultValues: { currentPassword: '', password: '', terminateOtherSessions: false },
  });

  const submit = handleSubmit(async (values) => {
    onStart();
    const outcome = await changePasswordAction(values);
    onSettled(outcome, {
      title: t('doneTitle'),
      body: values.terminateOtherSessions ? t('doneWithSessions') : t('doneBody'),
    });
    // Cleared whatever the outcome: a password left in a field after a refusal is a live
    // credential sitting in the DOM, and after a success it is the OLD one.
    reset();
  });

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className={styles.form}>
      <FormSummary control={control} title={t('heading')} />

      <FormPasswordField
        control={control}
        name="currentPassword"
        label={t('current')}
        autoComplete="current-password"
        revealLabel={tPolicy('show')}
        concealLabel={tPolicy('hide')}
        rules={{ required: t('currentMissing') }}
      />
      <FormPasswordField
        control={control}
        name="password"
        label={t('next')}
        autoComplete="new-password"
        revealLabel={tPolicy('show')}
        concealLabel={tPolicy('hide')}
        rules={{ required: t('nextMissing') }}
      />

      {/* A native checkbox. §11.5 lists one and `packages/ui` has not needed it yet; adding a
          component to the inventory for a single instance would be the opposite over-correction
          to UX-89 — this is a platform control wearing the cascade's own focus ring. */}
      <label className={styles.choice}>
        <input type="checkbox" {...register('terminateOtherSessions')} />
        <span className={styles.choiceText}>
          <span className="t-label">{t('terminate')}</span>
          <span className="t-caption">{t('terminateHelp')}</span>
        </span>
      </label>

      <Button type="submit" busy={busy}>
        {t('submit')}
      </Button>
    </form>
  );
}
