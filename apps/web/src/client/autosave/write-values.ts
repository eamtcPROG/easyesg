import {
  readProblemDocument,
  readResultObject,
  type DerivationInputWrite,
  type DisclosureValueResponse,
  type DisclosureValueWrite,
  type ProblemDocument,
  type WriteDerivationInputsRequest,
  type WriteDisclosureValuesRequest,
} from '@easyesg/contracts';
import type { RefusedWrite } from '@/features/wizard/tools/autosave-state';
import { API_OUTCOME, type ApiOutcome } from '@/lib/api-outcome';
import { refusedInputs, refusedValues } from './refused-items';

/** What a write came to: what the api stored, and what it refused for each write's own sake (task 218). */
export interface WriteAnswered<TStored> {
  readonly stored: TStored;
  readonly refused: readonly RefusedWrite[];
}

/**
 * **A problem that names its items is about them, not the report** (task 218; §12.5.6's task-218 row (b)): nothing was
 * stored, and every item it names is refused for its own sake — an answer the queue sets aside rather than a failure
 * that holds it. A problem naming none, or naming them in a shape this reader does not know, stays the failure it is.
 */
function itemsRefused(problem: ProblemDocument, read: (value: unknown) => RefusedWrite[] | null): RefusedWrite[] | null {
  const items = problem.extensions?.refused;
  return items === undefined ? null : read(items);
}

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
}): Promise<ApiOutcome<WriteAnswered<DisclosureValueResponse[]>>> {
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
    const problem = readProblemDocument(parsed, response.status);
    const refused = itemsRefused(problem, refusedValues);
    return refused === null
      ? { status: API_OUTCOME.Problem, problem }
      : { status: API_OUTCOME.Ok, value: { stored: [], refused }, messages: [] };
  }
  try {
    const result = readResultObject<{ stored: DisclosureValueResponse[]; refused: unknown }>(
      parsed,
      VALUES_PATH(input.reportId),
    );
    const refused = refusedValues(result.object.refused);
    // An answer this tier could not read is the same fact, with the same remedy, as no answer.
    if (refused === null || !Array.isArray(result.object.stored)) return { status: API_OUTCOME.Unreachable };
    return { status: API_OUTCOME.Ok, value: { stored: result.object.stored, refused }, messages: result.messages };
  } catch {
    return { status: API_OUTCOME.Unreachable };
  }
}

/** `PUT /api/v1/reports/{id}/derivation-inputs` — the values a derived figure is computed from. */
const INPUTS_PATH = (reportId: string): string => `/api/v1/reports/${reportId}/derivation-inputs`;

/**
 * The wizard's second write (task 36.10), through the same pass-through and the same queue.
 *
 * **A second endpoint rather than a second mechanism.** These ride the autosave queue exactly as
 * disclosure values do — the same debounce, the same durable queue, the same indicator — because a
 * field that lost FR-38's offline queue and UX-36's acknowledgement for no reason a document states
 * would be the per-screen divergence UX-89 exists to prevent. What differs is only where they land,
 * and that is `flushSnapshot`'s partition rather than a branch anyone writing a field has to know.
 *
 * **The answer names what it refused, and nothing else** (task 218): a derivation input has no server-computed
 * properties — unlike a disclosure, whose state the api settles (FR-30) — so what was stored is what was sent and not
 * refused, and the queue clears on what it *sent*.
 */
export async function putDerivationInputs(input: {
  readonly reportId: string;
  readonly values: readonly DerivationInputWrite[];
  readonly fetch?: typeof fetch;
}): Promise<ApiOutcome<WriteAnswered<null>>> {
  const body: WriteDerivationInputsRequest = { values: [...input.values] };
  const send = input.fetch ?? fetch;
  let response: Response;
  try {
    response = await send(INPUTS_PATH(input.reportId), {
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
    const problem = readProblemDocument(parsed, response.status);
    const refused = itemsRefused(problem, refusedInputs);
    return refused === null
      ? { status: API_OUTCOME.Problem, problem }
      : { status: API_OUTCOME.Ok, value: { stored: null, refused }, messages: [] };
  }
  try {
    const result = readResultObject<{ refused: unknown }>(parsed, INPUTS_PATH(input.reportId));
    const refused = refusedInputs(result.object.refused);
    if (refused === null) return { status: API_OUTCOME.Unreachable };
    return { status: API_OUTCOME.Ok, value: { stored: null, refused }, messages: result.messages };
  } catch {
    return { status: API_OUTCOME.Unreachable };
  }
}
