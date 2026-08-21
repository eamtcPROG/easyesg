import { getTranslations } from 'next-intl/server';
import { RegisterForm } from '@/features/identity/components/register-form';
import styles from '@/features/identity/components/identity-screens.module.css';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';

/**
 * S-01 — Register · CA · UC-01…05 · Focus
 *
 * D-1: the founding user of a new organization is auto-granted Organization Administrator.
 * A person becomes a pure Reporting Contributor only by invitation (UC-60 → UC-15).
 *
 * Captures email + password per S-01's content list and the task-19 API; the prototype's
 * extra fields are design_spec OQ-16, open. Exits to the S-02 challenge on success (§4.3).
 * `design_spec.md` §5 owns this screen's content, controls and states; the Identity prototype
 * is the rendered reference — values extracted, markup never copied (OQ-10).
 */
type Props = { params: LocaleParams };

export const generateMetadata = localizedPageTitle('identity.register');

export default async function RegisterPage({ params }: Props) {
  await activateRequestLocale(params);
  const t = await getTranslations('identity.register');

  return (
    <>
      <h1 className={`t-heading-1 ${styles.title}`}>{t('title')}</h1>
      <p className={`t-body ${styles.subtitle}`}>{t('subtitle')}</p>
      <RegisterForm />
    </>
  );
}
