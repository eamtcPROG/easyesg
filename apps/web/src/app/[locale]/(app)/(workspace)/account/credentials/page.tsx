import { CredentialsBoard } from '@/features/credentials/components/credentials-board';
import { readCredentials } from '@/server/data/credentials';
import { readPendingLink } from '@/server/pending-link';
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
 * **Two reads, fetched in parallel and failing independently** (§8.1's partial state): a provider
 * list that could not be fetched must not hide a working password form.
 *
 * **It can be entered mid-flow.** Returning from a provider lands here with a link awaiting its
 * password (§12.5.6's task-27.7 row) — a state the reader did not click into on this page load,
 * which is why it is read on the server and handed to the board rather than discovered in an effect.
 *
 * States (§8.1): ready · pending confirmation · partial · error — recoverable · success. Loading is
 * `loading.tsx`; the transient states of an action are the board's.
 */
const MESSAGES = 'identity.credentials';

export const generateMetadata = localizedPageTitle(MESSAGES);

export default async function CredentialsPage({ params }: { params: LocaleParams }) {
  await activateRequestLocale(params);

  // In parallel: the two section reads and the pending-link cookie are independent, and a
  // settings screen should not pay a second round trip for an ordering that does not exist.
  const [read, pending] = await Promise.all([readCredentials(), readPendingLink()]);

  return <CredentialsBoard read={read} pendingLinkProvider={pending?.provider ?? null} />;
}
