import type { AdminEnrolment } from '@easyesg/contracts';
import { Button, EnrolmentCode, TextLink } from '@easyesg/ui';
import { FormCodeField, FormSummary } from '@easyesg/ui/forms';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'use-intl';

interface CodeInput {
  totpCode: string;
}

/**
 * A-20's second step (task 67.4): **the Enrolment code component — the symbol beside the secret it
 * encodes** (§11.5), and the code that confirms the authenticator captured it. Only this submission
 * creates the account.
 *
 * Going back to change the password keeps the factor: the api answers the same staged secret for the
 * link, so the authenticator already holding it stays right.
 */
export function InvitationEnrolmentStep({
  offer,
  busy,
  onSubmit,
  onBack,
}: {
  readonly offer: AdminEnrolment;
  readonly busy: boolean;
  readonly onSubmit: (totpCode: string) => void;
  readonly onBack: () => void;
}) {
  const t = useTranslations('realm.invitation');
  const { control, handleSubmit } = useForm<CodeInput>({ mode: 'onTouched' });

  const submit = handleSubmit((input) => onSubmit(input.totpCode));

  return (
    <div className="flex flex-col gap-[var(--space-5)]">
      <EnrolmentCode
        uri={offer.uri}
        secret={offer.secret}
        heading={t('enrolment.heading')}
        help={t('enrolment.help')}
        symbolLabel={t('enrolment.symbolLabel')}
      />

      <form
        method="post"
        onSubmit={(event) => void submit(event)}
        noValidate
        className="flex flex-col gap-[var(--space-4)]"
      >
        <FormSummary control={control} title={t('summaryTitle')} />

        <FormCodeField
          control={control}
          name="totpCode"
          label={t('enrolment.codeLabel')}
          help={t('enrolment.codeHelp')}
          rules={{ required: t('enrolment.codeMissing') }}
        />

        <Button type="submit" busy={busy}>
          {t('enrolment.submit')}
        </Button>

        <p className="t-caption">
          <TextLink asChild>
            <button type="button" onClick={onBack} className="cursor-pointer">
              {t('enrolment.back')}
            </button>
          </TextLink>
        </p>
      </form>
    </div>
  );
}
