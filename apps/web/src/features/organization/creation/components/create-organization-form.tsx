'use client';

import { Button, Callout, CALLOUT_INTENT, Panel } from '@easyesg/ui';
import { FormSelect, FormSummary, FormTextField } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import type { CreateOrganizationRequest } from '@easyesg/contracts';
import { API_OUTCOME, type ApiFailure } from '@/lib/api-outcome';
import { useRouter } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { createOrganizationAction } from '../actions';
import styles from './create-organization.module.css';

/**
 * S-04's form — UC-49, FR-13, D-1: creating grants the creator the Organization Administrator
 * role in the same transaction.
 *
 * **Four fields, and which four is a closed decision rather than a reading of the prototype**
 * (`design_spec.md` OQ-20, closed 29 Aug 2026). UC-49's own step 1 says *"legal name, country,
 * contact details"*; §5's Content row says the same; `CreateOrganizationRequestDto` accepts
 * exactly those. The Workspace artboard draws five different ones — IDNO, VAT code, primary
 * activity, reporting currency — and each has an owner elsewhere or none at all: VAT code is
 * FR-106's billing account, IDNO is FR-16 and S-15's, activity is FR-17's on the reporting entity,
 * and reporting currency is in no document in the set. OQ-20 carries the evidence.
 *
 * **The country is a select even though the vocabulary holds one entry at MVP.** It is
 * configuration (AD-4) that moves without a redeploy, it selects the legal-form vocabulary the API
 * refuses a request without, and it prints on the report — so hiding it while there is one would
 * make the form silently grow a required field the day a second country registers.
 *
 * States (§5's list for this screen, from §8.1): **loading — initial** is the country read, which
 * is the page's and resolves before this renders · **submitting** (busy button) · **invalid**
 * (inline errors plus the UX-111 summary) · **error — recoverable** (the problem document as
 * received, or the bundled unreachable copy) · **success**, which is the exit to S-05 rather than
 * a message — the next screen states the organization by name, and a toast before a navigation is
 * a message nobody reads (UX-67).
 */
export interface CountryOption {
  /** ISO 3166-1 alpha-2, as the API answers it. */
  readonly code: string;
  /** The country's name in the reader's language, resolved by the page from the catalogue. */
  readonly label: string;
}

export interface CreateOrganizationFormProps {
  /** From `GET /organizations/legal-forms` — the countries this route accepts. */
  readonly countries: readonly CountryOption[];
}

/**
 * What the form holds. Contact fields are optional to the API and optional here; `countryCode`
 * carries no empty member, because "not yet chosen" is an absence and `useBoundField` already
 * normalises that to the empty string Radix reserves for its placeholder.
 */
interface CreateOrganizationFields {
  name: string;
  countryCode: string;
  contactEmail: string;
  contactPhone: string;
}

/** Light shape check only, as on S-01: deliverability is unknowable client-side. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function CreateOrganizationForm({ countries }: CreateOrganizationFormProps) {
  const t = useTranslations('organization.create');
  const tCommon = useTranslations('identity');
  const tForms = useTranslations('forms');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<ApiFailure | null>(null);

  const { control, handleSubmit } = useForm<CreateOrganizationFields>({
    mode: 'onTouched',
    // Preselected when there is one, which is the honest reading of a vocabulary with a single
    // member: the field still says which country the organization is being created in, and the
    // reader is not asked to choose from a list of one. With two it opens unchosen and the
    // `required` rule applies.
    defaultValues: {
      name: '',
      countryCode: countries.length === 1 ? countries[0].code : '',
      contactEmail: '',
      contactPhone: '',
    },
  });

  const submit = handleSubmit((fields) => {
    setFailure(null);
    startTransition(async () => {
      // Trimmed and emptied here so the API sees an ABSENT optional field rather than `''`:
      // task 29.1's review found that validating before normalising is how a blank name reaches
      // storage, and the same order applies from this side of the wire.
      const request: CreateOrganizationRequest = {
        name: fields.name.trim(),
        countryCode: fields.countryCode,
        ...(fields.contactEmail.trim() ? { contactEmail: fields.contactEmail.trim() } : {}),
        ...(fields.contactPhone.trim() ? { contactPhone: fields.contactPhone.trim() } : {}),
      };
      const result = await createOrganizationAction(request);
      if (result.status === API_OUTCOME.Ok) {
        // §5's exit. The API made this organization the session's active one in the same
        // transaction (task 29.1), so `/home` resolves it without this screen naming it in a
        // query string (AD-2, UX-2). The global tier picks up the new name because the action
        // revalidated the `(app)` layout — see `createOrganizationAction`, and note that a
        // `router.refresh()` here would refresh the screen being left rather than the layout
        // above the one being entered.
        router.push(ROUTES.HOME);
        return;
      }
      setFailure(result);
    });
  });

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className={styles.stack}>
      <FormSummary control={control} title={tForms('summaryTitle')} />

      {failure?.status === API_OUTCOME.Problem ? (
        // The API's own three-part text, as received. `action` is null on purpose: the one refusal
        // this route has — country-not-supported — states its own remedy, and no step here
        // navigates anywhere the detail cannot describe.
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

      <Panel className={styles.panel}>
        <div className={styles.fields}>
          <FormTextField
            control={control}
            name="name"
            label={t('nameLabel')}
            help={t('nameHelp')}
            autoComplete="organization"
            rules={{
              required: t('nameRequired'),
              maxLength: { value: 200, message: t('nameTooLong') },
            }}
          />
          <FormSelect
            control={control}
            name="countryCode"
            label={t('countryLabel')}
            help={t('countryHelp')}
            placeholder={t('countryPlaceholder')}
            options={countries.map((country) => ({ value: country.code, label: country.label }))}
            rules={{ required: t('countryRequired') }}
          />
          <FormTextField
            control={control}
            name="contactEmail"
            type="email"
            label={t('contactEmailLabel')}
            help={t('contactEmailHelp')}
            autoComplete="email"
            inputMode="email"
            rules={{ pattern: { value: EMAIL_SHAPE, message: t('contactEmailInvalid') } }}
          />
          <FormTextField
            control={control}
            name="contactPhone"
            type="tel"
            label={t('contactPhoneLabel')}
            help={t('contactPhoneHelp')}
            autoComplete="tel"
            inputMode="tel"
            rules={{ maxLength: { value: 40, message: t('contactPhoneTooLong') } }}
          />
        </div>

        <p className={`t-caption ${styles.reassurance}`}>{t('oneIsEnough')}</p>

        <Button type="submit" busy={pending}>
          {t('submit')}
        </Button>
      </Panel>
    </form>
  );
}
