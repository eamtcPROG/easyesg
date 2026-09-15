import { getTranslations } from 'next-intl/server';
import styles from '../../shared/styles/identity-screens.module.css';
import { ConfirmEmail } from './confirm-email';
import { VerificationPending } from './verification-pending';

/**
 * S-02's verification region: the link's two query parameters read, and the heading and one of the
 * address's two surfaces drawn from them (`section-reads-parts-render`; the page is a shell since
 * task 157).
 *
 * **The token picks the surface.** With `?token=…` it is the emailed link's landing, which consumes
 * the token only on an explicit POST — a mail scanner prefetching the URL must not burn the single
 * use (task 19). Without one it is the waiting and resend surface S-01 exits to. `?return=` rides
 * through the confirmation, so an invitee detoured here by a stale invitation still has somewhere to
 * go.
 */
export async function VerifySection({
  searchParams,
}: {
  readonly searchParams: Promise<{ token?: string; return?: string }>;
}) {
  const [t, { token, return: returnTo }] = await Promise.all([
    getTranslations('identity.verify'),
    searchParams,
  ]);

  return (
    <>
      <h1 className={`t-heading-1 ${styles.title}`}>{t('title')}</h1>
      {token ? <ConfirmEmail token={token} returnTo={returnTo} /> : <VerificationPending />}
    </>
  );
}
