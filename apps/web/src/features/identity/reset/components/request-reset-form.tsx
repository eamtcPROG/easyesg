'use client';

import { Callout, CALLOUT_INTENT, Panel, TextLink } from '@easyesg/ui';
import { FormSummary, FormTextField } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import { useEffect, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { API_OUTCOME } from '@/lib/api-outcome';
import { Link } from '@/i18n/navigation';
import { requestPasswordResetAction } from '../actions/actions';
import type { RequestResetResult } from '../actions/action-results';
import { takeResetAddress } from '../../shared/store/reset-address-store';
import styles from '../../shared/styles/identity-screens.module.css';
import { ROUTES } from '@/lib/routes';
import { CredentialSubmit } from '@/shared/credential-submit';
import { ScriptingRequired } from '@/shared/scripting-required';

/**
 * S-02 · Request a password reset (FR-6, UC-08) — the reset-request route from S-01.
 *
 * The answer is identical whether or not the address is registered (NFR-64), so the success
 * state asserts only the conditional fact the API asserted: IF an account exists, a link is on
 * its way. A locked account may always request one — the link is what releases the lock
 * (task 21) — which is why S-01's locked state routes here.
 *
 * **Arriving from S-01, the address typed there is already in the field** (`design_spec.md` S-02,
 * amended 28 Sep 2026), carried through session storage and never the URL, and editable like any
 * typed value.
 *
 * States (§8.1 subset): rest · submitting · invalid · success (uniform) · error — recoverable
 * (the 429 throttle as received) · unreachable (bundled catalogue).
 */
interface RequestResetInput {
  email: string;
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function RequestResetForm() {
  const t = useTranslations('identity.resetRequest');
  const tCommon = useTranslations('identity');
  // The form-level error summary's heading — `forms`, because it says what happened to a
  // FORM and no screen owns it. See `factor-form.tsx` for the one that is not shared.
  const tForms = useTranslations('forms');
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<RequestResetResult | null>(null);

  const { control, handleSubmit, setValue } = useForm<RequestResetInput>({ mode: 'onTouched' });

  // After hydration, because session storage has no server half to render from. Not validated on
  // arrival: the field is judged when the reader leaves it or submits, exactly as a typed one is.
  useEffect(() => {
    const carried = takeResetAddress();
    if (carried) setValue('email', carried);
  }, [setValue]);

  const submit = handleSubmit((input) => {
    startTransition(async () => {
      setResult(await requestPasswordResetAction(input));
    });
  });

  if (result?.status === API_OUTCOME.Ok) {
    return (
      <Callout
        intent={CALLOUT_INTENT.SUCCESS}
        title={t('sentTitle')}
        action={
          <TextLink asChild>
            <Link href={ROUTES.SIGN_IN}>{t('sentAction')}</Link>
          </TextLink>
        }
      >
        {t('sentBody')}
      </Callout>
    );
  }

  return (
    <form method="post" onSubmit={(event) => void submit(event)} noValidate className={styles.stack}>
      <ScriptingRequired />
      <FormSummary control={control} title={tForms('summaryTitle')} />

      {result?.status === API_OUTCOME.Problem ? (
        <Callout
          intent={CALLOUT_INTENT.ERROR}
          title={result.problem.title ?? t('problemTitle')}
          /* NFR-79's "what now" belongs to the API's `detail`, which always states its own remedy.
              The slot carries something only where this screen owns one the detail cannot express —
              a remedy that NAVIGATES. Until 27 Aug 2026 it fell back to a fixed sentence for every
              other problem, so the throttle refusal arrived with the API's "wait a few minutes"
              directly above this screen's "try again now". (factor-form.tsx made the same fix.) */
          action={null}
        >
          {result.problem.detail ?? t('problemBody')}
        </Callout>
      ) : null}

      {result?.status === API_OUTCOME.Unreachable ? (
        <Callout
          intent={CALLOUT_INTENT.ERROR}
          title={tCommon('unreachable.title')}
          action={tCommon('unreachable.action')}
        >
          {tCommon('unreachable.body')}
        </Callout>
      ) : null}

      <Panel className={styles.formPanel}>
        <div className={styles.fields}>
          <FormTextField
            control={control}
            name="email"
            label={t('emailLabel')}
            help={t('emailHelp')}
            type="email"
            autoComplete="username"
            inputMode="email"
            rules={{
              required: t('emailMissing'),
              pattern: { value: EMAIL_SHAPE, message: t('emailInvalid') },
            }}
          />

          <CredentialSubmit busy={pending}>
            {t('submit')}
          </CredentialSubmit>
        </div>
      </Panel>

      <p className={styles.altAction}>
        <TextLink asChild>
          <Link href={ROUTES.SIGN_IN}>{t('backToSignIn')}</Link>
        </TextLink>
      </p>
    </form>
  );
}
