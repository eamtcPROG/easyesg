'use server';

import type { SubmitSupportRequest, SupportRequestReceipt } from '@easyesg/contracts';
import type { ApiOutcome } from '@/lib/api-outcome';
import { api } from '@/server/api/api-client';

/**
 * S-34's send (task 77; UC-182, FR-212) — the request to the api, which names the sender from the ambient session when
 * one is held and from the body when none is, records it and answers its reference. **Nothing else happens here**: the
 * outcome goes back to the form, which shows the reference or the api's own words for a refusal.
 */
export async function submitSupportRequestAction(
  request: SubmitSupportRequest,
): Promise<ApiOutcome<SupportRequestReceipt>> {
  return api.post<SubmitSupportRequest, SupportRequestReceipt>('/support/requests', request);
}
