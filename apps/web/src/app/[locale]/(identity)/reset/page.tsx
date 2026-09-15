import { RequestResetSection } from '@/features/identity/reset/components/request-reset-section';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';

/**
 * S-02 — Request password reset · CA · UC-08 · Focus
 *
 * Uniform responses regardless of whether the account exists (NFR-64), and the only lockout
 * release before Phase 8 (task 21) — S-01's locked state routes here on purpose.
 *
 * **This file is a shell** (task 157, `shell-composes-only`): it pins the locale and renders the
 * section.
 */
type Props = { params: LocaleParams };

export const generateMetadata = localizedPageTitle('identity.resetRequest');

export default async function ResetPasswordPage({ params }: Props) {
  await activateRequestLocale(params);
  return <RequestResetSection />;
}
