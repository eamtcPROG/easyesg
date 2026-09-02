import {
  readProblemDocument,
  readResultList,
  type DisclosureValueResponse,
  type DisclosureValueWrite,
  type WriteDisclosureValuesRequest,
} from '@easyesg/contracts';
import { API_OUTCOME, type ApiOutcome } from '@/lib/api-outcome';

/**
 * The browser's one write (task 35.2): `PUT /api/v1/reports/{id}/values` through the token-attaching
 * pass-through — **the only path from the browser to the API** (`app/api/[...path]`, AD-9).
 *
 * This is the traffic that handler was built for and names in its own header: *"the wizard's
 * debounced, batched field-group PATCH … the IndexedDB queue draining after an offline period"*.
 * The path mirrors the API's exactly so NFR-16's route-coverage diff compares like with like, and
 * the session cookie rides `same-origin` credentials; the handler proves the origin and attaches
 * the bearer, so nothing here knows a token exists.
 *
 * **The body is validated, never cast** — `readResultList` throws on anything that is not the list
 * envelope, and that becomes `unreachable`, the outcome whose catalogue text tells the reader to
 * try again. A problem document is repaired by `readProblemDocument` and rendered as received:
 * NFR-79 has the API compose all three parts into `detail`, and a locked period's refusal (FR-22)
 * is the ordinary case here.
 *
 * `keepalive` is deliberately not set: a flush is never fired during unload — a step change
 * persists the queue and the next step drains it (FR-37's *"or step change"*, met by the durable
 * queue rather than by a request racing the navigation).
 */
const VALUES_PATH = (reportId: string): string => `/api/v1/reports/${reportId}/values`;

const JSON_MEDIA_TYPE = 'application/json';

export async function putDisclosureValues(input: {
  readonly reportId: string;
  readonly values: readonly DisclosureValueWrite[];
  readonly fetch?: typeof fetch;
}): Promise<ApiOutcome<DisclosureValueResponse[]>> {
  const body: WriteDisclosureValuesRequest = { values: [...input.values] };
  const send = input.fetch ?? fetch;
  let response: Response;
  try {
    response = await send(VALUES_PATH(input.reportId), {
      method: 'PUT',
      headers: { 'content-type': JSON_MEDIA_TYPE, accept: JSON_MEDIA_TYPE },
      body: JSON.stringify(body),
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    return { status: API_OUTCOME.Unreachable };
  }

  const parsed: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    return { status: API_OUTCOME.Problem, problem: readProblemDocument(parsed, response.status) };
  }
  try {
    const list = readResultList<DisclosureValueResponse>(parsed, VALUES_PATH(input.reportId));
    return { status: API_OUTCOME.Ok, value: list.items, messages: list.messages };
  } catch {
    // An answer this tier could not read is the same fact, with the same remedy, as no answer.
    return { status: API_OUTCOME.Unreachable };
  }
}
