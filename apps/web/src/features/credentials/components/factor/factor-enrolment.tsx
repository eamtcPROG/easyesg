'use client';

import { BUTTON_VARIANT, Button, EnrolmentCode } from '@easyesg/ui';
import { FormCodeField, FormSummary } from '@easyesg/ui/forms';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { confirmTotpEnrolmentAction } from '../../actions/actions';
import { CODES_ORIGIN, CREDENTIALS_EVENT, CREDENTIALS_SECTION } from '../../tools/credentials-state';
import { FACTOR_MESSAGES } from '../shared/credentials-messages';
import { useCredentials, useSectionBusy } from '../shared/credentials-context';
import styles from '../styles/credentials.module.css';
import { CopyButton } from './copy-button';

/**
 * The enrolment's second step: the Enrolment code — the QR symbol beside the base32 secret it encodes (§11.5, task
 * 143), the key copyable in one press (task 169) — and the first code the authenticator produces. **Enrolment is not complete until that code is returned**
 * (UC-193), and the secret on screen is the only copy that will ever exist, so *Cancel* is a designed exit.
 *
 * No `CredentialSubmit`: this form exists only after the begin step's answer, so never before hydration.
 */
interface EnrolmentForm {
  code: string;
}

export function FactorEnrolment({ secret, enrolmentUri }: { readonly secret: string; readonly enrolmentUri: string }) {
  const t = useTranslations(FACTOR_MESSAGES);
  const tForms = useTranslations('forms');
  const { perform, successNotice, dismiss } = useCredentials();
  const busy = useSectionBusy(CREDENTIALS_SECTION.FACTOR);
  const { control, handleSubmit, reset } = useForm<EnrolmentForm>({ mode: 'onSubmit', defaultValues: { code: '' } });

  const confirm = handleSubmit((values) =>
    perform({
      section: CREDENTIALS_SECTION.FACTOR,
      action: () => confirmTotpEnrolmentAction({ code: values.code }),
      onSuccess: (issued) => ({
        type: CREDENTIALS_EVENT.CODES_ISSUED,
        codes: issued.recoveryCodes,
        origin: CODES_ORIGIN.ENROLMENT,
        notice: successNotice({ title: t('enabledTitle'), body: t('enabledBody') }),
      }),
      // Cleared on a refusal too: a code rotates, so a rejected one can never be retried and leaving it invites that.
      clear: () => reset(),
    }),
  );

  return (
    <form method="post" onSubmit={(event) => void confirm(event)} noValidate className={styles.form}>
      <FormSummary control={control} title={tForms('summaryTitle')} />
      <EnrolmentCode
        uri={enrolmentUri}
        secret={secret}
        heading={t('secretHeading')}
        help={t('secretHelp')}
        symbolLabel={t('symbolLabel')}
      />
      {/* The key, copied for an authenticator set up by hand — on a desktop, or where the camera cannot reach the
          screen. The printed key stays the fallback where the clipboard is refused. */}
      <CopyButton value={secret} label={t('copyKey')} />
      <FormCodeField control={control} name="code" label={t('codeLabel')} rules={{ required: t('codeMissing') }} />
      <div className={styles.actions}>
        <Button type="submit" busy={busy}>
          {t('confirm')}
        </Button>
        <Button type="button" variant={BUTTON_VARIANT.SUBTLE} disabled={busy} onClick={dismiss}>
          {t('abandon')}
        </Button>
      </div>
    </form>
  );
}
