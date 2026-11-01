import { SetPasswordSection } from '@/features/identity/reset/components/set-password-section';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';

/**
 * S-02 — Set password · CA · UC-09 · Focus
 *
 * The landing surface of the emailed reset link (`/{locale}/set-password?token=…`, built by the
 * worker). FR-6: consuming the link invalidates every existing session — the form states that before it
 * happens (P5). Since task 155 the link also says which wording to wear: `intent=setup` on the link sent
 * to an account holding no password.
 *
 * **This file is a shell** (`shell-composes-only`): it pins the locale and renders the section, which
 * reads the link's parameters and draws the heading, the form or the missing-link state.
 */
type Props = {
  params: LocaleParams;
  searchParams: Promise<{ token?: string; intent?: string }>;
};

export const generateMetadata = localizedPageTitle('identity.setPassword');

export default async function SetPasswordPage({ params, searchParams }: Props) {
  await activateRequestLocale(params);
  return <SetPasswordSection searchParams={searchParams} />;
}
