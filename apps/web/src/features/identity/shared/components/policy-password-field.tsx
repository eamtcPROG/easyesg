'use client';

import { evaluatePasswordPolicy, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@easyesg/validation';
import { RequirementList } from '@easyesg/ui';
import { FormPasswordField } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import { useWatch, type Control, type FieldPathByValue, type FieldValues } from 'react-hook-form';
import styles from '../styles/identity-screens.module.css';

/**
 * **In `identity/shared/components/` because more than one journey's form reads it:
 * `register/components/register-form.tsx`, `reset/components/set-password-form.tsx` and
 * `setup/components/steps/password-form.tsx`.** It is a part those forms share rather than chrome —
 * UX-89's third move, one application's component in that application's shared folder.
 *
 * A new password under OQ-51's policy: the field, the policy stated before entry and answering itself
 * while typing, and the three-part message a submission that fails it shows (§8.2). **One wiring for
 * every screen that sets a password** — task 155's second review found it written out in each of those
 * forms — so a rule added to the policy is one edit here, and no copy can be the one that missed it.
 *
 * The policy's sentences are `identity.register`'s: one policy, one set of words, which each form was
 * already borrowing. UX-108: paste and password-manager autofill work, and `new-password` invites the
 * manager to offer one. `useWatch` subscribes to this one field, so typing re-renders the requirement
 * list and not the form around it.
 */
export function PolicyPasswordField<
  TValues extends FieldValues,
  TName extends FieldPathByValue<TValues, string>,
>({
  control,
  name,
  label,
}: {
  readonly control: Control<TValues>;
  readonly name: TName;
  readonly label: string;
}) {
  const t = useTranslations('identity.register');
  const tForms = useTranslations('forms');

  const password = (useWatch({ control, name }) as string | undefined) ?? '';
  const verdict = evaluatePasswordPolicy(password);

  const requirements = [
    {
      key: 'length',
      label: t('requirements.length', {
        minimum: PASSWORD_MIN_LENGTH,
        maximum: PASSWORD_MAX_LENGTH,
      }),
      met: verdict.length,
    },
    { key: 'lowercase', label: t('requirements.lowercase'), met: verdict.lowercase },
    { key: 'uppercase', label: t('requirements.uppercase'), met: verdict.uppercase },
    { key: 'digit', label: t('requirements.digit'), met: verdict.digit },
    { key: 'further', label: t('requirements.further'), met: verdict.further },
  ];

  return (
    <div className={styles.passwordGroup}>
      <FormPasswordField
        control={control}
        name={name}
        label={label}
        help={t('pasteHint')}
        autoComplete="new-password"
        revealLabel={tForms('show')}
        concealLabel={tForms('hide')}
        rules={{
          validate: (value) =>
            evaluatePasswordPolicy(String(value ?? '')).satisfied ||
            t('passwordPolicy', {
              minimum: PASSWORD_MIN_LENGTH,
              maximum: PASSWORD_MAX_LENGTH,
            }),
        }}
      />
      <RequirementList items={requirements} metLabel={t('met')} unmetLabel={t('unmet')} />
    </div>
  );
}
