'use server';

import { revalidatePath } from 'next/cache';
import { mapOutcome } from '@/lib/api-outcome';
import { APP_LAYOUT_PATH } from '@/lib/revalidate-paths';
import { api } from '@/server/api/api-client';
import type { SupportAccessActionResult } from './action-results';

/**
 * An Organization Administrator's three answers to EasyESG support (task 67.9; UC-85; FR-78 as amended 14 Sep
 * 2026) — grant a request, decline it, or end access that is running — as Server Actions, on task 20's transport
 * decision.
 *
 * **Every rule stays on the API**: that only an administrator answers, that a request is still waiting, that
 * access is still running. The banner offers what the last render showed, and between that render and a click
 * another administrator may have answered, or the 60 minutes run out — the refusal is authoritative and is shown
 * as received.
 *
 * **Each revalidates the `(app)` layout**, where the banner lives, so the next render draws the request as it now
 * stands rather than the caller reconciling an optimistic guess.
 */
const answer = async (input: { readonly requestId: string; readonly verb: string }): Promise<SupportAccessActionResult> => {
  const outcome = await api.post<undefined, undefined>(
    `/support-access/${encodeURIComponent(input.requestId)}/${input.verb}`,
    undefined,
  );
  revalidatePath(APP_LAYOUT_PATH, 'layout');
  return mapOutcome(outcome, () => null);
};

/** Lets the operator who asked read the organization's reports, read-only, for 60 minutes. */
export async function grantSupportAccessAction(input: {
  readonly requestId: string;
}): Promise<SupportAccessActionResult> {
  return answer({ requestId: input.requestId, verb: 'grant' });
}

/** Nothing is read; the operator sees the request declined. */
export async function declineSupportAccessAction(input: {
  readonly requestId: string;
}): Promise<SupportAccessActionResult> {
  return answer({ requestId: input.requestId, verb: 'decline' });
}

/** Running access stops at once, before its 60 minutes. */
export async function endSupportAccessAction(input: {
  readonly requestId: string;
}): Promise<SupportAccessActionResult> {
  return answer({ requestId: input.requestId, verb: 'end' });
}
