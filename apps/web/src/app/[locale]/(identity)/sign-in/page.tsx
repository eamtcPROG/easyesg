import { getTranslations } from 'next-intl/server';
import { SignInForm } from '@/features/identity/components/sign-in-form';
import styles from '@/features/identity/components/identity-screens.module.css';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';

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
type Props = {
  params: LocaleParams;
  searchParams: Promise<{ return?: string }>;
};

export const generateMetadata = localizedPageTitle('identity.signIn');

export default async function SignInPage({ params, searchParams }: Props) {
  await activateRequestLocale(params);
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
