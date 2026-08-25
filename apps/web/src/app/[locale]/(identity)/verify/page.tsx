import { getTranslations } from 'next-intl/server';
import { ConfirmEmail } from '@/features/identity/components/confirm-email';
import { VerificationPending } from '@/features/identity/components/verification-pending';
import styles from '@/features/identity/components/identity-screens.module.css';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';

/**
 * S-02 — Verify email · CA · UC-03 · Focus
 *
 * Two surfaces on one address, split by whether the link's token is present:
 *
 *  - `?token=…` — the landing surface of the emailed link (built by the worker as
 *    `/{locale}/verify?token=…`). The token is consumed by an explicit POST, never on render:
 *    a mail scanner prefetching the URL must not burn the single use (task 19).
 *  - bare `/verify` — the waiting/resend surface: the challenge screen S-01 exits to, and the
 *    only exit for a link that expired inside the account's 7-day window (OQ-55).
 *
 * The reset and set-password surfaces S-02 also names live at `/reset` and `/set-password`
 * (task 22).
 *
 * **`?return=` passes through both surfaces** (26 Aug 2026 review). S-03 hands off to registration
 * carrying an invitation; when that invitation turns out to be stale the account is created
 * unverified and the journey detours through here — so the return path has to survive the detour,
 * or the invitee finishes verifying with nowhere to go and the invitation is orphaned. It is
 * sanitised where it is finally used, by the sign-in route, exactly as the proxy's own is.
 */
type Props = {
  params: LocaleParams;
  searchParams: Promise<{ token?: string; return?: string }>;
};

export const generateMetadata = localizedPageTitle('identity.verify');

export default async function VerifyPage({ params, searchParams }: Props) {
  await activateRequestLocale(params);
  const t = await getTranslations('identity.verify');
  const { token, return: returnTo } = await searchParams;

  return (
    <>
      <h1 className={`t-heading-1 ${styles.title}`}>{t('title')}</h1>
      {token ? <ConfirmEmail token={token} returnTo={returnTo} /> : <VerificationPending />}
    </>
  );
}
