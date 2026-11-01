import { readProblemDocument, readResultObject, type CalcLine, type WriteCalcLineRequest } from '@easyesg/contracts';
import { API_OUTCOME, type ApiOutcome } from '@/lib/api-outcome';

/**
 * S-09's two line writes from the browser (task 39.1; FR-33, FR-38): `PUT` and `DELETE`
 * `/api/v1/reports/{id}/calculator/sources/{lineId}`, through the token-attaching pass-through — the path
 * `write-values.ts` documents, for the same reasons, with the same outcome shapes.
 *
 * **Their own module, because the queue's third shape lands on its own routes** (§12.5.6's task-39 row (2)): a line is
 * written whole under the id its client chose, one request per line, and `useAutosave`'s flush is what decides when.
 * Nothing here retries or queues; the hook owns both.
 */
const LINE_PATH = (input: { readonly reportId: string; readonly lineId: string }): string =>
  `/api/v1/reports/${input.reportId}/calculator/sources/${input.lineId}`;

const JSON_MEDIA_TYPE = 'application/json';

/** One line, created or replaced — the stored line back, validated rather than cast. */
export async function putCalcLine(input: {
  readonly reportId: string;
  readonly lineId: string;
  readonly line: WriteCalcLineRequest;
  readonly fetch?: typeof fetch;
}): Promise<ApiOutcome<CalcLine>> {
  const path = LINE_PATH(input);
  const send = input.fetch ?? fetch;
  let response: Response;
  try {
    response = await send(path, {
      method: 'PUT',
      headers: { 'content-type': JSON_MEDIA_TYPE, accept: JSON_MEDIA_TYPE },
      body: JSON.stringify(input.line),
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    return { status: API_OUTCOME.Unreachable };
  }
  const parsed: unknown = await response.json().catch(() => null);
  if (!response.ok) return { status: API_OUTCOME.Problem, problem: readProblemDocument(parsed, response.status) };
  try {
    const result = readResultObject<CalcLine>(parsed, path);
    return { status: API_OUTCOME.Ok, value: result.object, messages: result.messages };
  } catch {
    // An answer this tier could not read is the same fact, with the same remedy, as no answer.
    return { status: API_OUTCOME.Unreachable };
  }
}

/** One line removed. **204 whether or not it was there**, so a replayed removal is the same as the first. */
export async function deleteCalcLine(input: {
  readonly reportId: string;
  readonly lineId: string;
  readonly fetch?: typeof fetch;
}): Promise<ApiOutcome<null>> {
  const send = input.fetch ?? fetch;
  let response: Response;
  try {
    response = await send(LINE_PATH(input), {
      method: 'DELETE',
      headers: { accept: JSON_MEDIA_TYPE },
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    return { status: API_OUTCOME.Unreachable };
  }
  if (response.ok) return { status: API_OUTCOME.Ok, value: null, messages: [] };
  const parsed: unknown = await response.json().catch(() => null);
  return { status: API_OUTCOME.Problem, problem: readProblemDocument(parsed, response.status) };
}
