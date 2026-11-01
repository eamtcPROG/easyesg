'use server';

import type { UnsubscribeAnswer, UnsubscribeTokenRequest } from '@easyesg/contracts';
import type { ApiOutcome } from '@/lib/api-outcome';
import { api } from '@/server/api/api-client';

/**
 * S-38's two calls (task 52.2.2; FR-169). **The token goes in a POST body**, as S-03's does: it stays out of the api's
 * access log, and the read changes nothing, so the page can render for a mail scanner that prefetches it without
 * unsubscribing anyone. No session is needed — the signed token is the whole of who and what — and one the browser
 * holds is attached by the seam and ignored by the api.
 */

/** What the link would switch off, read without switching it. */
export async function previewUnsubscribeAction(
  input: UnsubscribeTokenRequest,
): Promise<ApiOutcome<UnsubscribeAnswer>> {
  return api.post<UnsubscribeTokenRequest, UnsubscribeAnswer>('/account/notification-preferences/unsubscribe/preview', input);
}

/** The switch — S-38's one action. Pressing it for a link already switched off succeeds; the api says so. */
export async function unsubscribeAction(input: UnsubscribeTokenRequest): Promise<ApiOutcome<UnsubscribeAnswer>> {
  return api.post<UnsubscribeTokenRequest, UnsubscribeAnswer>('/account/notification-preferences/unsubscribe', input);
}
