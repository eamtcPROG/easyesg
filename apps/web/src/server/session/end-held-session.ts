import 'server-only';
import type { SignOutRequest } from '@easyesg/contracts';
import { api } from '../api/api-client';
import { destroySession, readSession } from './session';

/**
 * Sign-out's two halves, whatever asks for them (FR-5, UC-06) — `signOutAction` from the chrome and S-03,
 * and since task 92 the re-authentication dialogue's `DELETE /auth/session`, which is not a Server Action
 * (`architecture.md` §12.5.6's task-92 row says why).
 *
 * **The api call authenticates by the refresh token itself** (task 21: possession is the proof, and it
 * works after the access token expired). **The cookie is cleared whatever the api answered**: the person
 * asked to leave *this* browser, and refusing because of a network blip would strand them signed in; a
 * termination the api never heard leaves a row its idle and absolute lifetimes still bound (OQ-35).
 *
 * A session already gone — the dialogue's ordinary case — skips the call and clears what is left.
 */
export async function endHeldSession(): Promise<void> {
  const session = await readSession();
  if (session) {
    await api.delete<SignOutRequest>('/auth/session', { refreshToken: session.refreshToken });
  }
  await destroySession();
}
