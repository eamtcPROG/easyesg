import { CredentialsSection } from '@/features/credentials/components/credentials-section';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';

/**
 * S-28 — Credentials and linked identities · CA · UC-10 … UC-12, UC-193 · Record
 *
 * The one screen where a person manages how they get in: the password (FR-7), the opt-in second
 * factor (NFR-95) and the linked provider accounts (FR-8). They are together because they are one
 * question — *what are my ways in, and do I still have a working one* — which is also why UC-12's
 * refusal is the screen's most important behaviour: an account with no usable credential is
 * unrecoverable and takes its organization memberships down with it.
 *
 * **The screen never mirrors a rule.** FR-7's current-password check, BR-ID-4's last-credential
 * refusal, §12.5.6's re-authentication window and every conflict live on the API, and what renders
 * here is the refusal it sends — NFR-79's three parts, as received. Between a render and a click
 * someone may have set a password or spent a recovery code, so the server's answer is the only
 * authoritative one.
 *
 * **A shell since task 137** (`shell-composes-only`): it pins the locale and renders the section, which makes the two
 * reads and hands them to the board (`features/credentials/components/credentials-section.tsx`).
 *
 * States (§8.1): ready · pending confirmation · partial · error — recoverable · success. Loading is
 * `loading.tsx` beside it since task 137 — this sentence claimed one before it existed; the transient states of an
 * action are the board's.
 */
const MESSAGES = 'identity.credentials';

export const generateMetadata = localizedPageTitle(MESSAGES);

export default async function CredentialsPage({ params }: { params: LocaleParams }) {
  await activateRequestLocale(params);
  return <CredentialsSection />;
}
