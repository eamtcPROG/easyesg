import 'server-only';
import { endsHeldSession } from '@/features/identity/shared/tools/post-sign-in';
import type { HeldAccount } from '@/features/identity/shared/tools/held-account';
import { observeHeldSession } from './post-sign-in';
import { destroySession, readSession } from './session';

/**
 * The account this browser still holds a session for, asked of the api after an S-02 action (task 160) —
 * or `null` when there is none, **clearing the cookie when the api has ended it**.
 *
 * **Asked, not read off the cookie.** A reset ends every session of its own account, and a cookie outlives
 * its session until the access token falls due, so the cookie cannot say whether this browser's session
 * was one of them. §4.3's held-session branch asks the api and answers *session ended* on a 401, which is
 * the question exactly; the destination it answers otherwise is the link that continues as the account.
 *
 * **The cookie is cleared here because here it can be.** This runs inside a Server Action, one of the two
 * places a cookie write is legal, so the success that follows reaches the sign-in form with nothing stale
 * behind it; a render elsewhere leaves the cookie to the next sign-in (`session-entry.ts` says why that is
 * safe).
 */
export async function accountStillSignedIn(): Promise<HeldAccount | null> {
  const session = await readSession();
  if (session === null) return null;

  const home = await observeHeldSession();
  if (endsHeldSession(home)) {
    await destroySession();
    return null;
  }
  return { email: session.account.email, home: home.href };
}
