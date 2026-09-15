'use client';

import type { AccountSetup } from '@easyesg/contracts';
import { LOCALES, type Locale } from '@easyesg/i18n';
import { Button, Callout, CALLOUT_INTENT, Panel } from '@easyesg/ui';
import { FormSelect, FormSummary, FormTextField } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { API_OUTCOME, type ApiFailure } from '@/lib/api-outcome';
import { saveSetupProfileAction } from '../../actions/actions';
import { SETUP_STEP, SETUP_STEP_COUNT, SETUP_STEP_POSITION } from '../../tools/setup-step';
import styles from '../../../shared/styles/identity-screens.module.css';
import { SETUP_MESSAGES } from '../shared/setup-messages';
import { SignOut } from '../shared/sign-out';

/**
 * S-36's second step — both name parts and the interface language (task 155; FR-9, FR-10). The two
 * parts are asked for because a provider's single display name cannot be trusted to split (OQ-16's
 * closure); UX-137 derives the display name from them.
 *
 * **Pre-filled from what the account holds.** For a provider registration that is the provider's
 * display name, which task 139 seeds whole into the given name and deliberately never splits — so the
 * person splits it here, which is the step's reason to exist. The language starts at the account's
 * own, negotiated when it registered.
 *
 * Both names required, as S-01's registration requires them; a part that is only spaces is refused
 * here as it would be by the API, since a length rule alone would let it through. Signing out is on
 * offer below the form (S-36's controls).
 *
 * States (§8.1 subset): rest · submitting · invalid · error — recoverable (the API's refusal as
 * received) · unreachable. Success never renders: the action redirects.
 */
interface ProfileInput {
  givenName: string;
  familyName: string;
  locale: Locale;
}

export function ProfileStep({
  setup,
  returnTo,
}: {
  readonly setup: AccountSetup;
  readonly returnTo?: string;
}) {
  const t = useTranslations(SETUP_MESSAGES);
  // S-01's name labels and messages — the same two fields, under the same rules.
  const tNames = useTranslations('identity.register');
  const tLocales = useTranslations('chrome.locales');
  const tForms = useTranslations('forms');
  const tCommon = useTranslations('identity');
  // The account menu's own words for the same act — one sentence, wherever signing out is offered.
  const tAccount = useTranslations('chrome.accountMenu');
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<ApiFailure | null>(null);

  const { control, handleSubmit } = useForm<ProfileInput>({
    mode: 'onTouched',
    defaultValues: {
      givenName: setup.givenName ?? '',
      familyName: setup.familyName ?? '',
      locale: setup.locale,
    },
  });

  // Each language named in itself — `chrome.locales`, the language switcher's own list.
  const languages = LOCALES.map((locale) => ({ value: locale, label: tLocales(locale) }));

  const nameRules = (missing: string) => ({
    required: missing,
    maxLength: { value: 100, message: tNames('nameTooLong') },
    validate: (value: string) => value.trim().length > 0 || t('nameBlank'),
  });

  const submit = handleSubmit((input) => {
    setFailure(null);
    startTransition(async () => {
      setFailure((await saveSetupProfileAction({ ...input, returnTo })) ?? null);
    });
  });

  return (
    <form method="post" onSubmit={(event) => void submit(event)} noValidate className={styles.stack}>
      <p className={`t-body ${styles.subtitle}`}>
        {t('stepPosition', {
          current: SETUP_STEP_POSITION[SETUP_STEP.PROFILE],
          total: SETUP_STEP_COUNT,
        })}
      </p>

      <FormSummary control={control} title={tForms('summaryTitle')} />

      {failure?.status === API_OUTCOME.Problem ? (
        <Callout
          intent={CALLOUT_INTENT.ERROR}
          title={failure.problem.title ?? t('problemTitle')}
          action={null}
        >
          {failure.problem.detail ?? t('problemBody')}
        </Callout>
      ) : null}

      {failure?.status === API_OUTCOME.Unreachable ? (
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
          <p className={styles.bodyText}>{t('profileIntro')}</p>

          <FormTextField
            control={control}
            name="givenName"
            label={tNames('givenNameLabel')}
            autoComplete="given-name"
            rules={nameRules(tNames('givenNameMissing'))}
          />

          <FormTextField
            control={control}
            name="familyName"
            label={tNames('familyNameLabel')}
            autoComplete="family-name"
            rules={nameRules(tNames('familyNameMissing'))}
          />

          <FormSelect
            control={control}
            name="locale"
            label={t('languageLabel')}
            options={languages}
          />

          <Button type="submit" busy={pending}>
            {t('profileSubmit')}
          </Button>
        </div>
      </Panel>

      <SignOut label={tAccount('signOut')} />
    </form>
  );
}
