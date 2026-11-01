import { Button, TextLink } from '@easyesg/ui';
import { FormCodeField, FormSummary } from '@easyesg/ui/forms';
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
 * own autofill from the authenticator sheet — which is why the control is one real input rather
 * than six, and why it is not masked.
 *
 * **The segmented six-cell input arrived with task 27.4** and replaced the plain field this
 * shipped with. It is `packages/ui`'s `CodeField`, not markup here: A-01 draws it and S-01's
 * tenant challenge (task 27.8) is its second consumer, so a one-off in this file would have been
 * exactly the defect UX-89 names. Nothing about the form's behaviour changed — same name, same
 * rule, same autofill — because the control's whole design is to keep the single-input properties
 * the plain field already had.
 *
 * **The recovery-code route is here since task 151**, task 144 having given the realm recovery
 * codes: it opens A-01's third step for the address this challenge verified. **The artboard draws
 * two links, *Use a recovery code* and *Lost your device?*, and this is one** — the second is the
 * question the first answers, and two controls opening one step would be two names for one action.
 *
 * Still drawn by the artboard and still not here: the **code-window countdown** (`CodeField`
 * exposes a `hint` slot for it; the value it counts is this realm's five-minute challenge, and
 * nothing here reaches it). `factor.totpHelp` states the five-minute bound in words meanwhile, so
 * the operator is not left to discover it by being timed out.
 */
export function FactorStep({
  busy,
  onSubmit,
  onRecover,
  onChangeAccount,
}: {
  busy: boolean;
  onSubmit: (command: AdminFactorRequest) => void;
  onRecover: () => void;
  onChangeAccount: () => void;
}) {
  const t = useTranslations('realm.signIn');
  const { control, handleSubmit } = useForm<AdminFactorRequest>({ mode: 'onTouched' });

  const submit = handleSubmit(onSubmit);

  return (
    <form method="post"
      onSubmit={(event) => void submit(event)}
      noValidate
      className="flex flex-col gap-[var(--space-4)]"
    >
      <FormSummary control={control} title={t('summaryTitle')} />

      {/* `autoComplete` and `inputMode` are the control's own now — it sets both, because they
          are what UX-108 turns on and a caller must not be able to switch them off. */}
      <FormCodeField
        control={control}
        name="totpCode"
        label={t('factor.totpLabel')}
        help={t('factor.totpHelp')}
        rules={{ required: t('factor.totpMissing') }}
      />

      <Button type="submit" busy={busy}>
        {t('factor.submit')}
      </Button>

      <p className="t-caption flex flex-wrap gap-x-[var(--space-1)]">
        <span>{t('factor.lostDevice')}</span>
        <TextLink asChild>
          <button type="button" onClick={onRecover} className="cursor-pointer">
            {t('factor.recover')}
          </button>
        </TextLink>
      </p>

      <p className="t-caption">
        <TextLink asChild>
          <button type="button" onClick={onChangeAccount} className="cursor-pointer">
            {t('changeAccount')}
          </button>
        </TextLink>
      </p>
    </form>
  );
}
