import { AcceptTermsSection } from '@/features/identity/acceptance/components/section/accept-terms-section';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';

/**
 * S-43 — Accept the terms · CA · UC-01, UC-02 · Focus (task 195)
 *
 * The screen an account owing an acceptance of the terms of service or the privacy notice in force gives one on —
 * created before acceptance was recorded, registered through a provider, or holding a version a release has since
 * replaced (`architecture.md` §12.5.6's task-195 row). **No navigation reaches it**: the api client sends a reader here
 * when the api refuses a request for that reason, and §4.3's branch sends one here after sign-in.
 *
 * **It needs a session and is not a session-issuing screen**, so it sits in `(identity)` beside S-36, for S-36's reason.
 *
 * **This file is a shell** (`shell-composes-only`): it pins the locale and renders the section, which reads what is
 * owed and the search parameters and picks the arm.
 */
type Props = {
  params: LocaleParams;
  searchParams: Promise<{ return?: string }>;
};

export const generateMetadata = localizedPageTitle('identity.acceptance');

export default async function AcceptTermsPage({ params, searchParams }: Props) {
  await activateRequestLocale(params);
  return <AcceptTermsSection searchParams={searchParams} />;
}
