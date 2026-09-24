'use client';

import { BUTTON_VARIANT, Button, type ButtonVariant } from '@easyesg/ui';
import { FormPasswordField, FormSummary } from '@easyesg/ui/forms';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { CredentialSubmit } from '@/shared/credential-submit';
import { SECTION_READ } from '../../tools/credentials';
import type { CredentialsSection } from '../../tools/credentials-state';
import { CREDENTIALS_MESSAGES } from './credentials-messages';
import { useCredentials, useSectionBusy } from './credentials-context';
import styles from '../styles/credentials.module.css';

/**
 * An opened row's confirmation: what the action will do, the current password where the account holds one, and the
 * press that runs it — beginning an enrolment, turning the factor off, issuing new codes, unlinking or linking a
 * provider (§12.5.6's re-authentication row; `design_spec.md` S-28, amended 24 Sep 2026).
 *
 * **In `components/shared/` on one test: more than one sibling reads it** — `factor/` and `providers/`.
 *
 * **It is the record's one current-password field, one row at a time.** The field lives in the row the reader
 * opened, and only one row opens, so the screen still never asks for the secret twice — the defect the record-level
 * field this replaced was built to fix (28 Aug 2026). **The password never outlives the action**: `clear` empties the
 * field whatever the answer, because after a refusal it is a live credential sitting in the DOM.
 *
 * **Required only where the read says a password is held.** A provider-only account (FR-2) is not asked at all —
 * the session stands as its credential, which the api admits — and where the read did not resolve the field is asked
 * and not required, so such an account is not blocked by a state the screen could not see.
 *
 * **Through `CredentialSubmit`** (task 153's rule): the link confirmation is drawn on the server when the reader
 * returns from a provider, so this form can exist before hydration, and a press then must send nothing. Its
 * `<noscript>` half is the board's, once for the record, rather than this form's — a second copy would say it twice.
 */
interface ReauthFormValues {
  currentPassword: string;
}

export interface ReauthFormProps {
  readonly section: CredentialsSection;
  /** What confirming does — a sentence the reader reads before the field. */
  readonly help: string;
  readonly submitLabel: string;
  readonly variant?: ButtonVariant;
  /** Runs the row's action with the password typed (undefined where none is asked) and the field's own reset. */
  readonly onConfirm: (input: { readonly password: string | undefined; readonly clear: () => void }) => void;
}

export function ReauthForm({ section, help, submitLabel, variant, onConfirm }: ReauthFormProps) {
  const t = useTranslations(CREDENTIALS_MESSAGES);
  // The reveal toggle's names and the summary's heading: `packages/ui` owns no text (UX-79), and no screen owns these.
  const tForms = useTranslations('forms');
  const { read, asksPassword, dismiss } = useCredentials();
  const busy = useSectionBusy(section);
  const { control, handleSubmit, reset } = useForm<ReauthFormValues>({
    mode: 'onSubmit',
    defaultValues: { currentPassword: '' },
  });
  const required = read.password.status === SECTION_READ.READY && read.password.value.set;

  const submit = handleSubmit((values) =>
    onConfirm({ password: asksPassword ? values.currentPassword || undefined : undefined, clear: () => reset() }),
  );

  return (
    <form method="post" onSubmit={(event) => void submit(event)} noValidate className={styles.form}>
      <p className="t-body">{help}</p>
      {asksPassword ? (
        <>
          <FormSummary control={control} title={tForms('summaryTitle')} />
          <FormPasswordField
            control={control}
            name="currentPassword"
            label={t('currentPassword')}
            autoComplete="current-password"
            revealLabel={tForms('show')}
            concealLabel={tForms('hide')}
            rules={required ? { required: t('currentMissing') } : undefined}
          />
        </>
      ) : null}
      <div className={styles.actions}>
        <CredentialSubmit busy={busy} variant={variant}>
          {submitLabel}
        </CredentialSubmit>
        <Button type="button" variant={BUTTON_VARIANT.SUBTLE} disabled={busy} onClick={dismiss}>
          {t('cancel')}
        </Button>
      </div>
    </form>
  );
}
