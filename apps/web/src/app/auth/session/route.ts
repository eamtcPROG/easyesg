import type { NextRequest } from 'next/server';
import { endSession } from '@/features/identity/reauthenticate/handlers/end-session';
import { answerSessionStanding } from '@/features/identity/reauthenticate/handlers/session-standing';

/**
 * `/auth/session` — the session tier's own address for the browser (task 92; UX-38).
 *
 * `GET` asks whether the session is still held — `204` or `401` — which S-07 does before a step change or
 * its exit, so a session found gone opens re-authentication over the step instead of a navigation the
 * proxy would answer with the sign-in screen. `DELETE` ends whatever this browser holds, for the dialogue's
 * *sign out and finish later*, which a Server Action could not do on a page the proxy gates.
 *
 * **Outside `[locale]` and outside the proxy's matcher**, beside task 24's `/auth/social/…` and for their
 * reason: a handler fetched rather than navigated, whose path a locale rewrite would corrupt and whose
 * session-less caller the gate must not bounce. A shell — the flow is
 * `features/identity/reauthenticate/handlers/`.
 */
export function GET() {
  return answerSessionStanding();
}

export function DELETE(request: NextRequest) {
  return endSession(request);
}
