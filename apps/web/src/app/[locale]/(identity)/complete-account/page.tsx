import { CompleteAccountSection } from '@/features/identity/setup/components/section/complete-account-section';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';

/**
 * S-36 — Complete your account · CA · UC-02, UC-03 · Focus (task 155)
 *
 * The screen an account registered through a provider completes before it is active: its password,
 * then its given name, family name and interface language (§12.5.6's task-155 row). **No navigation
 * reaches it**; `proxy.ts` sends an account in setup here from every address that needs a session,
 * and §4.3's branch sends one here after sign-in.
 *
 * **It needs a session and is not a session-issuing screen**, which is why it sits in `(identity)`
 * rather than in `(session-issuing)`: the reader already holds one, and that group's guard would turn
 * them away. On S-02's path, where the account has no session yet, the password step is served at
 * `/register/password` instead, inside `(session-issuing)` because completing it issues one.
 *
 * **This file is a shell** (`shell-composes-only`): it pins the locale and renders the section, which
 * reads the setup and the search parameters and picks the step.
 */
type Props = {
  params: LocaleParams;
  searchParams: Promise<{ return?: string }>;
};

export const generateMetadata = localizedPageTitle('identity.setup');

export default async function CompleteAccountPage({ params, searchParams }: Props) {
  await activateRequestLocale(params);
  return <CompleteAccountSection searchParams={searchParams} />;
}
