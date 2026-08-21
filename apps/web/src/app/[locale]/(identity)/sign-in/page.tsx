import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SignInForm } from '@/features/identity/components/sign-in-form';
import styles from '@/features/identity/components/identity-screens.module.css';

/**
 * S-01 — Sign in · CA · UC-01…05 · Focus
 *
 * Email and password (task 22); the provider choices share this surface and arrive with their
 * passport adapters (task 24, D-6). UX-108 (Accessible Authentication, WCAG 2.2 3.3.8) binds:
 * no cognitive function test, password managers and paste work everywhere.
 *
 * `?return=` is `proxy.ts`'s UX-38 hand-off — the screen the session gate turned away, to be
 * resumed after sign-in. It rides through the form to the action, which sanitizes it (it
 * round-trips the browser, so it is attacker-shapeable) before redirecting.
 *
 * `design_spec.md` §5 owns this screen's content, controls and states; prototypes in
 * `design/screens/` are the rendered reference — values extracted, markup never copied (OQ-10).
 */
// `Locale`, not `string`: `[locale]/layout.tsx` already 404s anything outside the registry.
type Props = {
  params: Promise<{ locale: import('@easyesg/i18n').Locale }>;
  searchParams: Promise<{ return?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'identity.signIn' });
  // WCAG 2.2 AA 2.4.2 (Page Titled): the tab must name the task.
  return { title: t('title') };
}

export default async function SignInPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('identity.signIn');
  const { return: returnTo } = await searchParams;

  return (
    <>
      <h1 className={`t-heading-1 ${styles.title}`}>{t('title')}</h1>
      <p className={`t-body ${styles.subtitle}`}>{t('subtitle')}</p>
      <SignInForm returnTo={returnTo} />
    </>
  );
}
