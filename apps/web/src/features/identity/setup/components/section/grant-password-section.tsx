import type { Locale } from '@easyesg/i18n';
import { getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { peekSetupGrant } from '@/server/sealed/setup-grant';
import styles from '../../../shared/styles/identity-screens.module.css';
import { SETUP_MESSAGES } from '../shared/setup-messages';
import { GrantPasswordStep } from '../steps/grant-password-step';

/**
 * S-36's password step on S-02's path, as a region: the read and the step (task 155; `design_spec.md`
 * S-36's entry points).
 *
 * **The section reads; the part renders** (`section-reads-parts-render`). What it reads is the sealed
 * grant, and **the step is handed the address and nothing else** — a departure from
 * `section-pass-what-was-read`, taken because the held object carries the grant itself and a Client
 * Component's props are serialised into the page the browser receives.
 *
 * **Reachable only while the grant is held**: opened directly it redirects to S-02's resend surface,
 * because a confirmation is the only thing that produces one — `sign-in/factor/page.tsx`'s rule for
 * its challenge.
 */
export async function GrantPasswordSection({ locale }: { readonly locale: Locale }) {
  const [held, t] = await Promise.all([peekSetupGrant(), getTranslations(SETUP_MESSAGES)]);
  if (!held) {
    redirect({ href: ROUTES.VERIFY, locale });
    // Unreachable — `redirect` throws; written out because next-intl's does not declare `never`.
    return null;
  }

  return (
    <>
      <h1 className={`t-heading-1 ${styles.title}`}>{t('title')}</h1>
      <GrantPasswordStep email={held.email} />
    </>
  );
}
