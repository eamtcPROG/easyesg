import { Button, TextLink } from '@easyesg/ui';
import { FormSummary, FormTextField } from '@easyesg/ui/forms';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'use-intl';
import type { AdminFactorRequest } from '@easyesg/contracts';

/**
 * A-01 step two — the mandatory TOTP code, against the challenge the credential opened
 * (UC-68, FR-75: the second factor has no exception on this surface).
 *
 * It renders only the form. The address it is confirming, the refusals, and where a lapsed
 * challenge sends the operator are all `SignInScreen`'s — this component cannot reach the
 * challenge and does not know it exists, which is why a wrong code costs it nothing: the
 * screen leaves it mounted and the retyped code completes the same challenge.
 *
 * UX-108: paste and password managers work, and `one-time-code` is what surfaces the platform's
 * own autofill from the authenticator sheet — the reason this is a plain text field and not a
 * masked control.
 *
 * Drawn by the artboard, deliberately not here, each with its owner: the segmented six-cell code
 * input (a §11.5 inventory addition, with task 27's tenant challenge as its second consumer — a
 * one-off here would be exactly UX-89's defect), the code-window countdown, and the
 * recovery-code route (task 27). `factor.totpHelp` states the five-minute bound in words
 * meanwhile, so the operator is not left to discover it by being timed out.
 */
export function FactorStep({
  busy,
  onSubmit,
  onChangeAccount,
}: {
  busy: boolean;
  onSubmit: (command: AdminFactorRequest) => void;
  onChangeAccount: () => void;
}) {
  const t = useTranslations('realm.signIn');
  const { control, handleSubmit } = useForm<AdminFactorRequest>({ mode: 'onTouched' });

  const submit = handleSubmit(onSubmit);

  return (
    <form
      onSubmit={(event) => void submit(event)}
      noValidate
      className="flex flex-col gap-[var(--space-4)]"
    >
      <FormSummary control={control} title={t('summaryTitle')} />

      <FormTextField
        control={control}
        name="totpCode"
        label={t('factor.totpLabel')}
        help={t('factor.totpHelp')}
        autoComplete="one-time-code"
        inputMode="numeric"
        rules={{ required: t('factor.totpMissing') }}
      />

      <Button type="submit" busy={busy}>
        {t('factor.submit')}
      </Button>

      <p className="t-caption">
        <TextLink asChild>
          <button type="button" onClick={onChangeAccount} className="cursor-pointer">
            {t('factor.changeAccount')}
          </button>
        </TextLink>
      </p>
    </form>
  );
}
