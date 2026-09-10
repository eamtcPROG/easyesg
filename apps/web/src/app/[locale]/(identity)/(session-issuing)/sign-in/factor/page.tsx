import { getTranslations } from 'next-intl/server';
import { FactorForm } from '@/features/identity/components/factor-form';
import styles from '@/features/identity/components/identity-screens.module.css';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';
import { peekFactorChallenge } from '@/server/factor-challenge';
import { redirect } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';

/**
 * S-01's **second-factor step** — `design_spec.md` §5.1's staged state (UC-194, UC-195; task 27.8,
 * built inside 27.7 because 27.3 changed `POST /auth/session` and left this half unwritten: with
 * the API answering a challenge and the web tier expecting a session, enrolling a factor made the
 * next sign-in a crash).
 *
 * **Reachable only while the challenge is held**, and that is what makes it staged rather than a
 * screen of its own. Opened directly — a bookmark, a back button after signing in, a second tab —
 * it redirects to the password step, because that is the only thing that produces a challenge. The
 * cookie is `httpOnly`, so nothing the browser can author gets in here.
 *
 * **This page reads the challenge and never sends it onward.** Only `expiresAt` reaches the client,
 * to say how long is left; the challenge itself proves the API verified this password moments ago,
 * and a page whose DOM carried that proof would have put it exactly where the sealed cookie exists
 * to keep it from.
 *
 * The bounce keeps the reader's language: `@/i18n/navigation`'s `redirect` takes the locale
 * `activateRequestLocale` just returned, rather than a hand-built `/${locale}/…` — the prefix is
 * conditional (`localePrefix: 'as-needed'` serves Romanian unprefixed), and a string that spells it
 * out is right in two languages and wrong in the third.
 */
type Props = { params: LocaleParams };

export const generateMetadata = localizedPageTitle('identity.factor');

export default async function SignInFactorPage({ params }: Props) {
  const locale = await activateRequestLocale(params);
  const held = await peekFactorChallenge();
  if (!held) {
    redirect({ href: ROUTES.SIGN_IN, locale });
    // Unreachable — `redirect` throws. It is written out because next-intl's does not declare
    // `never`, so without it `held` stays nullable below.
    return null;
  }

  const t = await getTranslations('identity.factor');

  return (
    <>
      <h1 className={`t-heading-1 ${styles.title}`}>{t('title')}</h1>
      {/* NFR-64: reaching this step already discloses that the account has a factor, and nothing
          here may say more than that — no hint of which authenticator, no address, no name. */}
      <p className={`t-body ${styles.subtitle}`}>{t('subtitle')}</p>
      <FactorForm expiresAt={held.expiresAt} />
    </>
  );
}
