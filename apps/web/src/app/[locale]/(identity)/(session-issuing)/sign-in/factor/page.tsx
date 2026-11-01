import { FactorSection } from '@/features/identity/sign-in/components/factor-section';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';

/**
 * S-01's **second-factor step** — `design_spec.md` §5.1's staged state (UC-194, UC-195; task 27.8,
 * built inside 27.7 because 27.3 changed `POST /auth/session` and left this half unwritten: with
 * the API answering a challenge and the web tier expecting a session, enrolling a factor made the
 * next sign-in a crash).
 *
 * **Reachable only while the challenge is held**, and that is what makes it staged rather than a
 * screen of its own. The cookie is `httpOnly`, so nothing the browser can author gets in here, and
 * the challenge is read and never sent onward — the section says how.
 *
 * **This file is a shell** (task 157, `shell-composes-only`): it pins the locale and renders the
 * section, which reads the challenge and redirects to the password step when none is held. The
 * locale is handed on because the bounce must keep it: the prefix is conditional
 * (`localePrefix: 'as-needed'` serves Romanian unprefixed), so a hand-built `/${locale}/…` would be
 * right in two languages and wrong in the third.
 */
type Props = { params: LocaleParams };

export const generateMetadata = localizedPageTitle('identity.factor');

export default async function SignInFactorPage({ params }: Props) {
  const locale = await activateRequestLocale(params);
  return <FactorSection locale={locale} />;
}
