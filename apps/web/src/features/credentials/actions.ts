'use server';

import { revalidatePath } from 'next/cache';
import { mapOutcome } from '@/lib/api-outcome';
import { api } from '@/server/api-client';
import { ROUTES } from '@/lib/routes';
import type {
  CredentialActionResult,
  RecoveryCodes,
  TotpEnrolmentOffer,
} from './types/action-results';

/**
 * S-28's writes (UC-10, UC-11, UC-12, UC-193), as Server Actions.
 *
 * The transport decision is task 20's and unchanged: the browser posts to the Next server tier,
 * which calls the public API as the ordinary client AD-9 says it is. **No rule lives here.** FR-7's
 * current-password check, BR-ID-4's last-credential refusal, §12.5.6's re-authentication window and
 * every conflict are the API's, and the screen renders the refusals it sends back.
 *
 * **The password never reaches a log or a URL.** These are POST bodies to the server tier, which
 * forwards them once; nothing here retains, caches or revalidates on a value carrying one, and no
 * action takes a password in a query parameter.
 *
 * Every write that changes what the screen shows revalidates the screen's own path, so the Server
 * Component re-runs — the two reads are what draw the factor's state and the linked list.
 */
const revalidate = () => {
  revalidatePath(ROUTES.ACCOUNT_CREDENTIALS);
};

export async function changePasswordAction(input: {
  currentPassword: string;
  password: string;
  terminateOtherSessions: boolean;
}): Promise<CredentialActionResult> {
  const outcome = await api.post<typeof input, unknown>('/account/password', input);
  // Terminating other sessions changes nothing this screen renders, but the current session's own
  // state is unaffected either way — so the revalidation is for consistency of the read, not for
  // a change in what is drawn.
  revalidate();
  return mapOutcome(outcome, () => null);
}

/** Step one of UC-193. The secret exists only in this response — see the result type. */
export async function beginTotpEnrolmentAction(input: {
  password?: string;
}): Promise<ReturnType<typeof mapOutcome<TotpEnrolmentOffer, TotpEnrolmentOffer>>> {
  const outcome = await api.post<typeof input, TotpEnrolmentOffer>(
    '/account/totp/enrolment',
    input,
  );
  return mapOutcome(outcome, (offer) => offer);
}

/** Step two. Activates the factor and answers the recovery codes, shown exactly once. */
export async function confirmTotpEnrolmentAction(input: {
  code: string;
}): Promise<ReturnType<typeof mapOutcome<RecoveryCodes, RecoveryCodes>>> {
  const outcome = await api.post<typeof input, RecoveryCodes>(
    '/account/totp/confirmation',
    input,
  );
  revalidate();
  return mapOutcome(outcome, (codes) => codes);
}

export async function disableTotpAction(input: {
  password?: string;
}): Promise<CredentialActionResult> {
  const outcome = await api.post<typeof input, unknown>('/account/totp/removal', input);
  revalidate();
  return mapOutcome(outcome, () => null);
}

export async function reissueRecoveryCodesAction(input: {
  password?: string;
}): Promise<ReturnType<typeof mapOutcome<RecoveryCodes, RecoveryCodes>>> {
  const outcome = await api.post<typeof input, RecoveryCodes>(
    '/account/totp/recovery-codes',
    input,
  );
  revalidate();
  return mapOutcome(outcome, (codes) => codes);
}

/**
 * UC-11's completion — the password is supplied **here**, after the provider round trip, because
 * §12.5.6's task-27.7 row keeps it out of the transaction cookie. The OAuth values come from the
 * re-sealed transaction the callback left behind, read server-side and never from the form.
 */
export async function linkProviderAction(input: {
  provider: string;
  password?: string;
}): Promise<CredentialActionResult> {
  const { completePendingLink } = await import('@/server/pending-link');
  const outcome = await completePendingLink(input);
  revalidate();
  return outcome;
}

export async function unlinkProviderAction(input: {
  provider: string;
  password?: string;
}): Promise<CredentialActionResult> {
  const outcome = await api.post<{ password?: string }, unknown>(
    `/account/providers/${input.provider}/removal`,
    { password: input.password },
  );
  revalidate();
  return mapOutcome(outcome, () => null);
}
