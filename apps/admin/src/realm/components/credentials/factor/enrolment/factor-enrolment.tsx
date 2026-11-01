import { useMutation } from '@tanstack/react-query';
import type { AdminEnrolment } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button, EnrolmentCode } from '@easyesg/ui';
import { FormCodeField, FormSummary } from '@easyesg/ui/forms';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'use-intl';
import { confirmAdminReenrolment } from '../../../../queries/credentials';
import { CREDENTIALS_EVENT, CREDENTIALS_SECTION } from '../../../../tools/credentials-state';
import { useCredentials, useSectionActivity } from '../../shared/credentials-context';

interface CodeForm {
  code: string;
}

/**
 * A-19's *enrolling* state (task 151) — the Enrolment code component, the symbol beside the secret it
 * encodes (§11.5, task 143), and the code from the new authenticator that puts it in force.
 *
 * **The confirmation carries the current password as well as the code** (§12.5.6's task-144 row), so a
 * stolen session alone never completes one. The record's field kept it from the first half, so it is
 * typed once (`reauthenticationOutlives`).
 *
 * **Abandoning is the screen's, not the api's.** The staged secret stays staged, and starting again
 * replaces it with a new one — so leaving costs nothing, and the authenticator in force is untouched
 * either way.
 */
export function FactorEnrolment({ offer }: { readonly offer: AdminEnrolment }) {
  const t = useTranslations('realm.credentials.factor');
  const tRecord = useTranslations('realm.credentials');
  const { authorise, settle, abandonEnrolment } = useCredentials();
  const { busy, inert } = useSectionActivity(CREDENTIALS_SECTION.FACTOR);
  const { control, handleSubmit, reset } = useForm<CodeForm>({
    mode: 'onTouched',
    defaultValues: { code: '' },
  });

  const confirm = useMutation({
    mutationFn: confirmAdminReenrolment,
    onSuccess: (outcome) => settle(outcome, () => ({ type: CREDENTIALS_EVENT.FACTOR_REPLACED })),
    // A code rotates every thirty seconds, so a refused one can never be retried — cleared either way.
    onSettled: () => reset(),
  });

  const submit = handleSubmit(({ code }) =>
    authorise(CREDENTIALS_SECTION.FACTOR, (password) => confirm.mutate({ password, code })),
  );

  return (
    <form
      method="post"
      onSubmit={(event) => void submit(event)}
      noValidate
      className="flex flex-col gap-[var(--space-4)]"
    >
      <FormSummary control={control} title={tRecord('summaryTitle')} />

      {/* "Scan or enter" is true of this arm because the contract always carries the URI. */}
      <EnrolmentCode
        uri={offer.uri}
        secret={offer.secret}
        heading={t('enrolmentHeading')}
        help={t('enrolmentHelp')}
        symbolLabel={t('symbolLabel')}
      />

      <FormCodeField
        control={control}
        name="code"
        label={t('codeLabel')}
        help={t('codeHelp')}
        rules={{ required: t('codeMissing') }}
      />

      <div className="flex flex-wrap gap-[var(--space-3)]">
        <Button type="submit" busy={busy} disabled={inert}>
          {t('confirm')}
        </Button>
        <Button
          type="button"
          variant={BUTTON_VARIANT.SUBTLE}
          disabled={busy || inert}
          onClick={abandonEnrolment}
        >
          {t('abandon')}
        </Button>
      </div>
    </form>
  );
}
