'use client';

import { RecordSection } from '@easyesg/ui';
import { FormSelect } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import type { Control } from 'react-hook-form';
import { useLocaleNames } from '@/shared/use-locale-names';
import type { ProfileFields } from '../../tools/profile-fields';
import { PROFILE_MESSAGES } from '../shared/profile-messages';

/**
 * Three languages, chosen independently (task 52.3; FR-10, FR-52, FR-169; §12.5.6's task-52.3 row (3)) — the artboard's
 * three and `architecture.md` §9's *selected independently*: what the person reads the application in, the language an
 * export starts from, and the language every message to them is written in. Reading the interface in English does not
 * oblige anyone to file in English.
 */
export function LanguagesSection({ control }: { readonly control: Control<ProfileFields> }) {
  const t = useTranslations(PROFILE_MESSAGES);
  const { locales } = useLocaleNames();
  const options = locales.map((entry) => ({ value: entry.code, label: entry.label }));

  return (
    <RecordSection id="languages" heading={t('languages.heading')} description={t('languages.lede')}>
      <FormSelect control={control} name="locale" label={t('languages.interface')} help={t('languages.interfaceHelp')} options={options} />
      <FormSelect control={control} name="exportLocale" label={t('languages.export')} help={t('languages.exportHelp')} options={options} />
      <FormSelect control={control} name="emailLocale" label={t('languages.email')} help={t('languages.emailHelp')} options={options} />
    </RecordSection>
  );
}
