'use client';

import { RecordSection } from '@easyesg/ui';
import { FormPasswordField } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import { useCredentials } from './credentials-context';

/**
 * The record's one re-authentication field (§12.5.6's re-authentication row).
 *
 * **It is one field for the whole record, and as of 28 Aug 2026 that is true rather than merely
 * claimed.** The board's docblock argued it — four of the six actions need the current password,
 * and a field per section would ask one person for one secret in four places while three of them
 * sat in the DOM holding a live credential — and then the screen shipped with two: this one, and a
 * second inside the password section rendering the *same message key*, so a reader met "Parola
 * actuală" twice in one viewport. The password section now reads this field like every other
 * action.
 *
 * **The heading is not the field's label.** Naming the section after the field reproduced the
 * duplicate one level up; it says what the field is *for*, which is also the only place the screen
 * can explain that a provider-only account (FR-2) leaves it empty. The API admits that case, so
 * this screen never has to know which kind of account it is looking at, and the field carries no
 * `required` rule for the same reason.
 */
export function ReauthGate() {
  const t = useTranslations('identity.credentials.confirm');
  const tPassword = useTranslations('identity.credentials.password');
  // The reveal toggle's accessible names. `packages/ui` owns no text (UX-79), so the app supplies
  // them — and they belong to no feature, which is why they are `forms` rather than borrowed from
  // whichever screen happened to declare them first.
  const tForms = useTranslations('forms');
  const { control } = useCredentials();

  return (
    <RecordSection id="confirm" heading={t('heading')} description={t('help')}>
      <FormPasswordField
        control={control}
        name="password"
        label={tPassword('current')}
        autoComplete="current-password"
        revealLabel={tForms('show')}
        concealLabel={tForms('hide')}
      />
    </RecordSection>
  );
}
