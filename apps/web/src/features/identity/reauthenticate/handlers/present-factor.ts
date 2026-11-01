import 'server-only';
import {
  SECOND_FACTOR_ANSWER,
  type CompleteFactorRequest,
  type FactorSessionResponse,
} from '@easyesg/contracts';
import type { NextRequest, NextResponse } from 'next/server';
import { API_OUTCOME } from '@/lib/api-outcome';
import { api } from '@/server/api/api-client';
import { readFactorState } from '@/server/data/credentials';
import { consumeFactorChallenge, holdFactorChallenge } from '@/server/sealed/factor-challenge';
import { isCrossSiteWrite } from '@/server/session/same-origin';
import { FACTOR_LAPSED } from '../../shared/tools/factor';
import { REAUTHENTICATION } from '../tools/reauthentication-answer';
import { readFactorCommand } from '../tools/reauthentication-command';
import { holdsAnotherAccount } from './another-account';
import { answered, recovered, refused, relayed } from './answers';
import { resumeSession } from './resume-session';

/**
 * `POST /auth/session/factor` — the dialogue's second stage (task 92; UC-194, UC-195).
 *
 * `completeFactorAction`'s call, answered the dialogue's way. **The challenge is put back on a refusal**,
 * for S-01's recorded reason: it is deliberately not single-use, so a mistyped code leaves the reader at
 * the code rather than back at their password. **A challenge that is gone is `FACTOR_LAPSED`**, never
 * `unreachable` — nothing failed to arrive, and the remedy is to give the password again, which is where
 * the dialogue takes the reader.
 */
export async function presentFactor(request: NextRequest): Promise<NextResponse> {
  if (isCrossSiteWrite(request)) return refused(403);
  const body: unknown = await request.json().catch(() => null);
  const command = readFactorCommand(body);
  if (command === null) return refused(400);
  if (await holdsAnotherAccount(command.accountId)) return answered(REAUTHENTICATION.ACCOUNT_CHANGED);

  const held = await consumeFactorChallenge();
  if (held === null) return answered(FACTOR_LAPSED);

  const outcome = await api.post<CompleteFactorRequest, FactorSessionResponse>('/auth/session/factor', {
    challenge: held.challenge,
    code: command.code,
  });
  if (outcome.status !== API_OUTCOME.Ok) {
    await holdFactorChallenge(held);
    return relayed(outcome);
  }

  const resumed = await resumeSession({
    session: outcome.value,
    remembered: held.remember,
    accountId: command.accountId,
    organizationId: command.organizationId,
  });

  // **A recovery code says how many remain before the step resumes** (task 190; §12.5.6's task-190 row (3); UC-195
  // step 3). The count is the account's own state, read once the session exists — the read attaches the bearer from
  // the cookie `resumeSession` just wrote — and through S-05's and S-28's one read, so every surface states one number.
  // **Only a resumption counts**: a session answered for another account was ended unwritten, and its refusal stands.
  if (resumed === REAUTHENTICATION.RESUMED && outcome.value.answeredWith === SECOND_FACTOR_ANSWER.RECOVERY_CODE) {
    return recovered((await readFactorState())?.recoveryCodesRemaining ?? null);
  }
  return answered(resumed);
}
