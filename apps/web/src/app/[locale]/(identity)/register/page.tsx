import { getTranslations, setRequestLocale } from 'next-intl/server';
import { RegisterForm } from '@/features/identity/components/register-form';
import styles from '@/features/identity/components/identity-screens.module.css';

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
// `Locale`, not `string`: `[locale]/layout.tsx` already 404s anything outside the registry,
// so by the time a page runs the value is one of the three.
type Props = { params: Promise<{ locale: import('@easyesg/i18n').Locale }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'identity.register' });
  // WCAG 2.2 AA 2.4.2 (Page Titled): the tab must name the task.
  return { title: t('title') };
}

export default async function RegisterPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('identity.register');

  return (
    <>
      <h1 className={`t-heading-1 ${styles.title}`}>{t('title')}</h1>
      <p className={`t-body ${styles.subtitle}`}>{t('subtitle')}</p>
      <RegisterForm />
    </>
  );
}
