import { SignInSection } from '@/features/identity/sign-in/components/sign-in-section';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';

/**
 * S-01 — Sign in · CA · UC-01…05 · Focus
 *
 * Email and password (task 22), and — task 24 (D-6) — the enabled provider choices on the same
 * surface, per S-01's content list. UX-108 (Accessible Authentication, WCAG 2.2 3.3.8) binds:
 * no cognitive function test, password managers and paste work everywhere, and the provider
 * buttons are plain anchors that need no JavaScript.
 *
 * `?return=` is `proxy.ts`'s UX-38 hand-off — the screen the session gate turned away, to be
 * resumed after sign-in. `?notice=` is the provider callback's outcome report.
 *
 * `design_spec.md` §5 owns this screen's content, controls and states; prototypes in
 * `design/screens/` are the rendered reference — values extracted, markup never copied (OQ-10).
 *
 * **This file is a shell** (task 157, `shell-composes-only`): it pins the locale and renders the
 * section, which reads the query and draws the screen.
 */
type Props = {
  params: LocaleParams;
  searchParams: Promise<{ return?: string; notice?: string }>;
};

export const generateMetadata = localizedPageTitle('identity.signIn');

export default async function SignInPage({ params, searchParams }: Props) {
  // A caller who already holds a session never reaches here — `(session-issuing)/layout.tsx` is
  // the gate, once, for every screen in this group (UX-136, task 112).
  await activateRequestLocale(params);
  return <SignInSection searchParams={searchParams} />;
}
