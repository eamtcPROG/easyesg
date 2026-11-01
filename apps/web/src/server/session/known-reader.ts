import 'server-only';
import type { KnownReader } from '@/features/public/help/contact/tools/known-reader';
import { readActiveMembership } from '@/server/data/memberships';
import { readSession } from './session';

/**
 * Who S-34's signed-in reader is, as the request will name them (task 77; `architecture.md` §12.5.6's task-77 row (3),
 * (10)) — the account's name and address from the session, and the active organization's name from the membership the
 * chrome already read — or `null` for a visitor. **Read here, beside the session, and handed to the screen by its
 * route**, so nothing under `features/public` reads a session (§5.1b as amended). What the api records is its own
 * reading of the same session; this is only what the reader is shown.
 */
export async function readKnownReader(): Promise<KnownReader | null> {
  const session = await readSession();
  if (session === null) return null;
  const membership = await readActiveMembership();
  return {
    name: session.account.displayName,
    email: session.account.email,
    organizationName: membership?.organizationName ?? null,
  };
}
