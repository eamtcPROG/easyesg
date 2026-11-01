'use server';

import type { CookieChoice, RecordCookieChoiceRequest } from '@easyesg/contracts';
import { COOKIE_POLICY_VERSION_IN_FORCE } from '@easyesg/i18n';
import { cookies } from 'next/headers';
import { API_OUTCOME, type ApiFailure } from '@/lib/api-outcome';
import { cookieChoiceExpires, encodeCookieChoice } from '../tools/cookie-choice-cookie';
import { COOKIE_CHOICE_COOKIE } from '@/lib/session-cookie';
import { api } from '@/server/api/api-client';

/**
 * S-31's answer — *I understand* on the banner, or *Save* in its settings (task 223; FR-206; `architecture.md` §12.5.6's
 * task-223 row (2), (6)). The api records it, naming the account when the ambient session carries one, and the answer
 * comes back as the cookie the banner reads: the record's id, the version and the moment, lasting the months the record
 * is kept.
 *
 * **The version is this build's**, the one the page displayed; a release that moved it since is refused and the banner
 * stays. **A failure writes nothing**, so the banner shows again on the next page rather than claiming an answer the
 * server never kept.
 */
export async function recordCookieChoiceAction(): Promise<ApiFailure | undefined> {
  const outcome = await api.post<RecordCookieChoiceRequest, CookieChoice>('/legal/cookie-choices', {
    policyVersion: COOKIE_POLICY_VERSION_IN_FORCE,
  });
  if (outcome.status !== API_OUTCOME.Ok) return outcome;

  const record = { id: outcome.value.id, policyVersion: outcome.value.policyVersion, chosenAt: outcome.value.chosenAt };
  (await cookies()).set(COOKIE_CHOICE_COOKIE, encodeCookieChoice(record), {
    // Read by the page's own script after hydration — the one cookie here that is (row (8)).
    httpOnly: false,
    // Unconditionally, as every cookie this tier sets is: a development deployment over http teaches nothing weaker.
    secure: true,
    sameSite: 'lax',
    path: '/',
    expires: cookieChoiceExpires(record.chosenAt),
  });
  return undefined;
}
