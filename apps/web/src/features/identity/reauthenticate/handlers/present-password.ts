import 'server-only';
import {
  SIGN_IN_OUTCOME,
  type FactorChallengeResponse,
  type SessionResponse,
  type SignInRequest,
} from '@easyesg/contracts';
import type { NextRequest, NextResponse } from 'next/server';
import { API_OUTCOME } from '@/lib/api-outcome';
import { api } from '@/server/api/api-client';
import { holdFactorChallenge } from '@/server/sealed/factor-challenge';
import { isCrossSiteWrite } from '@/server/session/same-origin';
import { REAUTHENTICATION } from '../tools/reauthentication-answer';
import { readPasswordCommand } from '../tools/reauthentication-command';
import { holdsAnotherAccount } from './another-account';
import { answered, refused, relayed } from './answers';
import { resumeSession } from './resume-session';

/**
 * `POST /auth/session/password` — the dialogue's first stage (task 92; UC-07, UC-04).
 *
 * The same call S-01's `signInAction` makes, answered differently because the screen is not over: a
 * session is resumed rather than redirected into, and a second factor is asked for inside the dialogue
 * rather than on `/sign-in/factor`. **The challenge is held exactly as S-01 holds it** — sealed in its
 * httpOnly cookie, with only the fact that a code is needed reaching the browser — which is the reason
 * this is a Route Handler at all: a Server Action writing that cookie would re-render S-07 with no session
 * underneath the dialogue (`architecture.md` §12.5.6's task-92 row).
 *
 * The api keeps every rule it keeps for S-01: the uniform refusal (NFR-64), the throttle, the lockout
 * (FR-4). Each reaches the dialogue as the api worded it.
 */
export async function presentPassword(request: NextRequest): Promise<NextResponse> {
  if (isCrossSiteWrite(request)) return refused(403);
  const body: unknown = await request.json().catch(() => null);
  const command = readPasswordCommand(body);
  if (command === null) return refused(400);
  if (await holdsAnotherAccount(command.accountId)) return answered(REAUTHENTICATION.ACCOUNT_CHANGED);

  const outcome = await api.post<SignInRequest, SessionResponse | FactorChallengeResponse>('/auth/session', {
    email: command.email,
    password: command.password,
    remember: command.remembered,
  });
  if (outcome.status !== API_OUTCOME.Ok) return relayed(outcome);

  // Two shapes, discriminated by `kind` and never by probing for a field (`signInAction` says why).
  const signedIn = outcome.value;
  if (signedIn.kind !== SIGN_IN_OUTCOME.SIGNED_IN) {
    await holdFactorChallenge({
      challenge: signedIn.challenge,
      expiresAt: signedIn.expiresAt,
      remember: command.remembered,
    });
    return answered(REAUTHENTICATION.FACTOR_REQUIRED);
  }

  return answered(
    await resumeSession({
      session: signedIn,
      remembered: command.remembered,
      accountId: command.accountId,
      organizationId: command.organizationId,
    }),
  );
}
