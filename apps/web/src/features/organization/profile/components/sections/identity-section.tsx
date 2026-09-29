'use client';

import { RecordSection } from '@easyesg/ui';
import { FormSelect, FormTextField } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import type { Control } from 'react-hook-form';
import type { ProfileFields } from '../../tools/profile-fields';
import type { VocabularyOption } from '../shared/vocabulary';
import { PROFILE_MESSAGES } from '../shared/profile-messages';

/**
 * The organization itself — the account's name and the country whose lists its companies choose from (FR-15 as
 * amended). **Nothing here is printed on a report** (task 177): the legal form, the address and everything else a report
 * prints is each company's, on S-13, and the section says so, so nobody looks here for it.
 *
 * **Every value the API stores is a key and every label is the catalogue's** (OQ-43): the countries arrive as `MD`, and a
 * key rendered raw is an internal identifier on a screen.
 */
export function IdentitySection({
  control,
  countries,
}: {
  readonly control: Control<ProfileFields>;
  readonly countries: readonly VocabularyOption[];
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
    </RecordSection>
  );
}
