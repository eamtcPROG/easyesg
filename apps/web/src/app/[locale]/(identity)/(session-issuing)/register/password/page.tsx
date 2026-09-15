import { GrantPasswordSection } from '@/features/identity/setup/components/section/grant-password-section';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';

/**
 * S-36's password step on S-02's path (task 155; `design_spec.md` S-36's entry points).
 *
 * A provider registration whose provider did not assert the address confirms it by email; the
 * confirmation holds a single-use grant, and this is where it is spent. **Served under S-01's
 * registration address** because the account has no session until the password is set, so it cannot
 * reach an address that needs one — S-01's factor step, at `/sign-in/factor`, is the precedent.
 *
 * **Inside `(session-issuing)`, because completing it issues a session.** UX-136's layout above answers
 * a reader who already holds one with §4.3's branch; served at `/verify/password`, as it was until task
 * 155's second review, a signed-in reader following another account's confirmation link could replace
 * their session with that account's.
 *
 * **This file is a shell** (`shell-composes-only`): it pins the locale and renders the section, which
 * reads whether a grant is held and redirects to S-02's resend surface when none is.
 */
type Props = { params: LocaleParams };

export const generateMetadata = localizedPageTitle('identity.setup');

export default async function RegisterPasswordPage({ params }: Props) {
  const locale = await activateRequestLocale(params);
  return <GrantPasswordSection locale={locale} />;
}
