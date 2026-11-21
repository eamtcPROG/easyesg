import 'server-only';
import type { Invitation } from '@easyesg/contracts';
import { API_OUTCOME } from '@/lib/api-outcome';
import { api } from '../api/api-client';

/**
 * The organization's outstanding invitations — S-05's attention list for an Organization Administrator (task 255),
 * as the artboard's third item draws one.
 *
 * **`GET /invitations`, not S-16's `/access`.** The administrator's list is unpaginated by design — bounded by the
 * seat ceiling every invitation counts against — and carries exactly the invitations, where `/access` would need a
 * filter, a page size and the members beside them to answer the same question. A lapsed invitation is listed too,
 * since it is what holds the address; the attention item says it lapsed.
 *
 * **`null` where the read failed**, never an empty list: *nobody is waiting to join* and *we could not tell* are
 * different answers, and the attention region says the second rather than drawing the first. The caller asks only
 * for an administrator — the api answers anyone else `insufficient-role` — so a refusal here is a failure like any
 * other rather than a state to draw.
 */
export async function readOutstandingInvitations(): Promise<readonly Invitation[] | null> {
  const read = await api.getList<Invitation>('/invitations');
  return read.status === API_OUTCOME.Ok ? read.value.items : null;
}
