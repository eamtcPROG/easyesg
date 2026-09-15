import type { Locale } from '@easyesg/i18n';
import { getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { peekFactorChallenge } from '@/server/sealed/factor-challenge';
import styles from '../../shared/styles/identity-screens.module.css';
import { FactorForm } from './factor-form';

/**
 * S-01's second-factor step as a region: the sealed challenge read, and the heading and the code
 * form drawn from it (`section-reads-parts-render`; the page is a shell since task 157).
 *
 * **Reachable only while the challenge is held.** Opened directly — a bookmark, a back button after
 * signing in, a second tab — it redirects to the password step, because that is the only thing that
 * produces a challenge, and the bounce keeps the reader's language through `@/i18n/navigation`'s
 * `redirect` with the locale the shell pinned.
 *
 * **The form is handed `expiresAt` and nothing else** — a departure from `section-pass-what-was-read`,
 * taken because the held challenge proves the API verified this password moments ago, and a Client
 * Component's props are serialised into the page the browser receives, which is exactly where the
 * sealed cookie exists to keep that proof from.
 */
export async function FactorSection({ locale }: { readonly locale: Locale }) {
  const [held, t] = await Promise.all([peekFactorChallenge(), getTranslations('identity.factor')]);
  if (!held) {
    redirect({ href: ROUTES.SIGN_IN, locale });
    // Unreachable — `redirect` throws; written out because next-intl's does not declare `never`,
    // so without it `held` stays nullable below.
    return null;
  }

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
