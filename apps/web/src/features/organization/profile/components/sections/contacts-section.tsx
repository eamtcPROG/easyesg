'use client';

import { RecordSection } from '@easyesg/ui';
import { FormTextField } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import type { Control } from 'react-hook-form';
import { EMAIL_SHAPE, type ProfileFields } from '../../tools/profile-fields';
import { PROFILE_MESSAGES } from '../shared/profile-messages';

/**
 * Two different contacts, which is why this is one section and not two fields (FR-15).
 *
 * **The platform contact and the report contact are not the same person and must not collapse.**
 * One is where this service writes about the account; the other is the person a reader of the
 * published report writes to about its contents, and it appears in the export. A single "contact"
 * field would put a billing address into a sustainability report.
 *
 * **`EMAIL_SHAPE` is a shape test, not a validity test**, and it lives with the field shape in
 * `tools/profile-fields.ts` because both emails use it — one regular expression, not two that can
 * drift. What makes an address deliverable is not decidable here and is not this form's business;
 * this only decides whether a string is worth sending.
 */
export function ContactsSection({ control }: { readonly control: Control<ProfileFields> }) {
  const t = useTranslations(PROFILE_MESSAGES);

  return (
    <RecordSection id="contacts" heading={t('contacts.heading')} description={t('contacts.lede')}>
      <FormTextField
        control={control}
        name="contactEmail"
        type="email"
        label={t('contacts.platformEmail')}
        help={t('contacts.platformEmailHelp')}
        autoComplete="email"
        inputMode="email"
        rules={{ pattern: { value: EMAIL_SHAPE, message: t('contacts.emailInvalid') } }}
      />
      <FormTextField
        control={control}
        name="contactPhone"
        type="tel"
        label={t('contacts.platformPhone')}
        autoComplete="tel"
        inputMode="tel"
        rules={{ maxLength: { value: 40, message: t('contacts.phoneTooLong') } }}
      />
      <FormTextField
        control={control}
        name="reportContactName"
        label={t('contacts.reportName')}
        help={t('contacts.reportNameHelp')}
        rules={{ maxLength: { value: 200, message: t('contacts.reportNameTooLong') } }}
      />
      <FormTextField
        control={control}
        name="reportContactEmail"
        type="email"
        label={t('contacts.reportEmail')}
        help={t('contacts.reportEmailHelp')}
        inputMode="email"
        rules={{ pattern: { value: EMAIL_SHAPE, message: t('contacts.emailInvalid') } }}
      />
    </RecordSection>
  );
}
