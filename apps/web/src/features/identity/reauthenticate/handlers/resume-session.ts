import 'server-only';
import type { SessionResponse, SignOutRequest, SwitchActiveOrganizationRequest } from '@easyesg/contracts';
import { api } from '@/server/api/api-client';
import { establishSession } from '@/server/session/session';
import { REAUTHENTICATION } from '../tools/reauthentication-answer';

/**
 * What both submissions do once the api has answered a session (task 92; UC-07's postcondition, *"a new
 * session exists"*).
 *
 * **The account is checked before anything is written.** The api signed in whoever holds the address the
 * dialogue sent, and that is the screen's account in every case this product can produce — so a
 * different one is a defect or a race, and its session is ended at once rather than sealed into this
 * browser. What was queued under the screen's account is never sent as another.
 *
 * **Then the organization the screen was read under is restored.** A new session holding several
 * memberships has no choice (task 83.1), and the screen's next read would meet S-37 — a redirect away from
 * the very step UX-38 says the reader returns to. The api decides whether the choice still stands: a
 * membership removed meanwhile is refused here and met by the step's own permission arm, which is where it
 * would have been met without the dialogue. So the answer is not read, deliberately.
 *
 * **`remembered` is carried forward**, as rotation carries it: S-01's choice was made once, and a dialogue
 * that silently made the new session persistent would be answering a question nobody asked again.
 */
export async function resumeSession(input: {
  readonly session: SessionResponse;
  readonly remembered: boolean;
  readonly accountId: string;
  readonly organizationId: string | null;
}): Promise<typeof REAUTHENTICATION.RESUMED | typeof REAUTHENTICATION.ACCOUNT_CHANGED> {
  if (input.session.account.id !== input.accountId) {
    await api.delete<SignOutRequest>('/auth/session', { refreshToken: input.session.refreshToken });
    return REAUTHENTICATION.ACCOUNT_CHANGED;
  }

  await establishSession({ session: input.session, remembered: input.remembered });
  if (input.organizationId !== null) {
    // `api` attaches the bearer from the cookie just written, as §4.3's branch does after sign-in.
    await api.put<SwitchActiveOrganizationRequest, undefined>('/session/organization', {
      organizationId: input.organizationId,
    });
  }
  return REAUTHENTICATION.RESUMED;
}
