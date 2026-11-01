'use client';

import { Button } from '@easyesg/ui';
import { FormPasswordField, FormSummary } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import styles from './reauthentication.module.css';

interface PasswordInput {
  password: string;
}

/**
 * The dialogue's first stage — the artboard's one field (task 92; UC-07).
 *
 * **No address field: the account is the screen's.** It is named in the label where the frame has room for
 * it, and handed to a password manager through a read-only username field, which is how a re-authentication
 * form tells one which credential to offer (UX-108). Asking for the address would invite a different
 * person to sign in over someone else's unsent work, which the handler would refuse anyway.
 *
 * `method="post"` for task 96's reason — a submit that beats hydration must not put a password in the URL.
 */
export function PasswordStage({
  email,
  busy,
  onSubmit,
}: {
  readonly email: string;
  readonly busy: boolean;
  readonly onSubmit: (password: string) => void;
}) {
  const t = useTranslations('identity.reauthenticate');
  const tForms = useTranslations('forms');
  // **On submit, not on touch.** The dialogue focuses this field itself when it opens, so its first blur is
  // not the reader leaving a field they engaged with — it is the reader pressing *sign out and finish
  // later*. Validated on that blur, the summary and the inline message appeared between the press and its
  // release and moved the button out from under the pointer, so the click never landed (task 92's trace).
  const { control, handleSubmit } = useForm<PasswordInput>({ mode: 'onSubmit' });
  const submit = handleSubmit(({ password }) => onSubmit(password));

  return (
    <form method="post" noValidate onSubmit={(event) => void submit(event)} className={styles.form}>
      <FormSummary control={control} title={t('summaryTitle')} />
      <p className={`t-body ${styles.lede}`}>{t('passwordLede')}</p>
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <FormPasswordField
        control={control}
        name="password"
        label={t.rich('passwordLabel', {
          email,
          address: (chunks) => <span className={styles.address}>{chunks}</span>,
        })}
        autoComplete="current-password"
        revealLabel={tForms('show')}
        concealLabel={tForms('hide')}
        rules={{ required: t('passwordMissing') }}
      />
      <Button type="submit" busy={busy} className={styles.action}>
        {t('continue')}
      </Button>
    </form>
  );
}
