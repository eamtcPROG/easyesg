import { SESSION_TIER_PATH } from './session-paths';

/**
 * The dialogue's *sign out and finish later*, from the browser (task 92): `DELETE /auth/session`, which
 * ends whatever session this browser still holds — `handlers/end-session.ts` records why this is not
 * `signOutAction`.
 *
 * **It does not report failure, deliberately.** The reader asked to leave, and leaving is a navigation to
 * S-01 the caller makes either way: if no request arrived, the cookie that could not be cleared belongs to
 * a session the api has already refused, which S-01's gate reads as no session — the same answer this
 * would have produced, one screen later. What the reader typed stays on this device under the account's
 * key, whichever way it went.
 */
export async function signOutHere(input: { readonly fetch?: typeof fetch } = {}): Promise<void> {
  const send = input.fetch ?? fetch;
  try {
    await send(SESSION_TIER_PATH.SESSION, { method: 'DELETE', credentials: 'same-origin', cache: 'no-store' });
  } catch {
    // Nothing to tell the reader that the next screen will not.
  }
}
