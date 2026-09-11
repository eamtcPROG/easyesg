'use client';

import { RecordSection } from '@easyesg/ui';
import { FormSelect, FormTextField } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import type { Control } from 'react-hook-form';
import type { ProfileFields } from '../../tools/profile-fields';
import type { CountryOption, VocabularyOption } from '../shared/vocabulary';
import { PROFILE_MESSAGES } from '../shared/profile-messages';

/**
 * The legal identity that propagates into every report the organization produces (FR-15).
 *
 * **The legal forms are the country currently CHOSEN's, not the one stored.** The API re-checks the
 * form against the country the patch results in and refuses a move that would strand it, so offering
 * the old country's forms after a change would build a request the API is about to reject. The watch
 * that decides which list this is stays in the shell — a `useWatch` here would be a second
 * subscription to the same field, and the shell needs the value anyway to pick the list.
 *
 * **Every value the API stores is a key and every label is the catalogue's** (OQ-43): the legal
 * forms and the countries arrive as `srl` and `MD`, and a key rendered raw is an internal identifier
 * on a screen. A form registered ahead of its wording renders its key, which is the stated trade
 * rather than an accident.
 *
 * **Legal form carries no `required`**, unlike country: the API models it nullable because an
 * organization may be registered in a jurisdiction whose forms this platform has not yet
 * enumerated, and a rule here would refuse a record the server accepts.
 */
export function IdentitySection({
  control,
  countries,
  legalForms,
}: {
  readonly control: Control<ProfileFields>;
  readonly countries: readonly CountryOption[];
  /** The chosen country's forms — derived by the shell, which owns the one watch. */
  readonly legalForms: readonly VocabularyOption[];
}) {
  const t = useTranslations(PROFILE_MESSAGES);

  return (
    <RecordSection id="identity" heading={t('identity.heading')} description={t('identity.lede')}>
      <FormTextField
        control={control}
        name="name"
        label={t('identity.name')}
        help={t('identity.nameHelp')}
        autoComplete="organization"
        rules={{
          required: t('identity.nameRequired'),
          maxLength: { value: 200, message: t('identity.nameTooLong') },
        }}
      />
      <FormSelect
        control={control}
        name="countryCode"
        label={t('identity.country')}
        help={t('identity.countryHelp')}
        placeholder={t('identity.countryPlaceholder')}
        options={countries.map((country) => ({ value: country.value, label: country.label }))}
        rules={{ required: t('identity.countryRequired') }}
      />
      <FormSelect
        control={control}
        name="legalForm"
        label={t('identity.legalForm')}
        help={t('identity.legalFormHelp')}
        placeholder={t('identity.legalFormPlaceholder')}
        options={legalForms.map((form) => ({ value: form.value, label: form.label }))}
      />
    </RecordSection>
  );
}
