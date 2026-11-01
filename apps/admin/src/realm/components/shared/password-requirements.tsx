import { RequirementList } from '@easyesg/ui';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  evaluatePasswordPolicy,
} from '@easyesg/validation';
import { useTranslations } from 'use-intl';

/**
 * OQ-51's requirements as a password is typed — **the policy's own evaluation from
 * `@easyesg/validation`**, the one the api applies, so the list and the server's verdict cannot
 * disagree (§9.8). The api still refuses on its own.
 *
 * Here since task 151, when A-19's new password became its second reader; it was A-20's password
 * step's own until then (task 67.4). The caller watches its one field and passes the value, so the list
 * re-renders with that field and not with the whole form.
 */
export function PasswordRequirements({ password }: { readonly password: string }) {
  const t = useTranslations('realm.passwordRequirements');
  const verdict = evaluatePasswordPolicy(password);
  const items = [
    {
      key: 'length',
      label: t('length', { minimum: PASSWORD_MIN_LENGTH, maximum: PASSWORD_MAX_LENGTH }),
      met: verdict.length,
    },
    { key: 'lowercase', label: t('lowercase'), met: verdict.lowercase },
    { key: 'uppercase', label: t('uppercase'), met: verdict.uppercase },
    { key: 'digit', label: t('digit'), met: verdict.digit },
    { key: 'further', label: t('further'), met: verdict.further },
  ];

  return <RequirementList items={items} metLabel={t('met')} unmetLabel={t('unmet')} />;
}
