import { InvitationSection } from '@/features/identity/invitation/components/section/invitation-section';
import { INVITATION_MESSAGES } from '@/features/identity/invitation/components/shared/invitation-messages';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';

/**
 * S-03 — Accept invitation · CA · UC-15 · Focus
 *
 * The landing surface of the emailed link, reachable **signed out and signed in alike** —
 * `proxy.ts` has carried `invitation` in its unauthenticated segments since task 4, and both
 * entries are real: UC-15 step 2 has the invitee creating an account or using one they already
 * have.
 *
 * **Nothing is consumed on render.** The preview reads the invitation without spending it, and the
 * acceptance is an explicit POST from `AcceptInvitation` — the property task 19 built the
 * verification flow around, and the reason a mail scanner following this link cannot burn it.
 *
 * **The signed-out arm hands off to S-01 rather than hosting its own forms** (`design_spec.md`
 * S-03, amended 25 Aug 2026): the screen's four "controls" are one action and three routes, which
 * keeps this a Focus screen with a single primary action and keeps S-01 the one place a credential
 * is entered. The registration route carries the invitation, so the account it creates is already
 * verified and the invitee comes back able to accept — one email instead of two.
 *
 * The branch itself is `invitation/tools/invitation.ts`, deliberately: it reaches no API, so its
 * five arms — three of them error states — are a unit spec rather than five browser journeys.
 *
 * **This file is a shell** (task 134, `shell-composes-only`): it pins the locale and renders the
 * section. It held the two reads and five components until then — the largest identity route in
 * the app — and every one of them now lives under `invitation/components/`, the read with the
 * branch in `section/` and one file per arm in `states/`.
 */
type Props = {
  params: LocaleParams & Promise<{ token: string }>;
};

export const generateMetadata = localizedPageTitle(INVITATION_MESSAGES);

export default async function AcceptInvitationPage({ params }: Props) {
  await activateRequestLocale(params);
  const { token } = await params;
  return <InvitationSection token={token} />;
}
