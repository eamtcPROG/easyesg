import 'server-only';
import type { UnsubscribeAnswer, UnsubscribeTokenRequest } from '@easyesg/contracts';
import { NextResponse } from 'next/server';
import { API_OUTCOME } from '@/lib/api-outcome';
import { api } from '@/server/api/api-client';

/**
 * `POST /mail/unsubscribe/{token}` — RFC 8058's one-click target (task 52.2.2; FR-169; §12.5.6's task-52.2 row (2)),
 * which a mail client posts to on the person's behalf when they press its own unsubscribe control.
 *
 * **The one write this tier forwards without a same-origin proof, and the token is why that is safe**: the caller is
 * a mail provider's server, which carries no session and no `Origin` of ours by definition, and the signed token names
 * the one account, category and channel it can switch off — nothing else is reachable from it. The pass-through at
 * `/api` refuses exactly this request, which is why it has a handler of its own.
 *
 * **Its answer is a status and nothing else.** A mail client reads no body, and a sentence minted here would be
 * wording in code: `200` switched off, the api's own status where it refused, `503` where it could not be reached —
 * which a client may retry, as RFC 8058 leaves to it.
 */
export async function answerOneClick(token: string): Promise<NextResponse> {
  const outcome = await api.post<UnsubscribeTokenRequest, UnsubscribeAnswer>(
    '/account/notification-preferences/unsubscribe',
    { token },
  );
  const status =
    outcome.status === API_OUTCOME.Ok
      ? SWITCHED_OFF_STATUS
      : outcome.status === API_OUTCOME.Problem
        ? outcome.problem.status
        : UNREACHABLE_STATUS;
  return new NextResponse(null, { status, headers: { 'cache-control': 'no-store' } });
}

const SWITCHED_OFF_STATUS = 200;
const UNREACHABLE_STATUS = 503;
