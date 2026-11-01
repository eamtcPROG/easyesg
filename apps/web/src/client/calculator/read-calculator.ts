import { readResultObject, type Calculator } from '@easyesg/contracts';

/**
 * `GET /api/v1/reports/{id}/calculator` from the browser, through the token-attaching pass-through (task 39.2) — S-09's
 * figures read again once a line the reader entered has been acknowledged, so the converted and emissions columns and
 * the totals follow the lines (*"both totals move as you type"*).
 *
 * **It answers the read or `null`, never throws** (`read-notices.ts`'s shape): the hook keeps what it already shows
 * when a read fails, which is the server-rendered answer or the last one that arrived. Validated, never cast.
 */
const calculatorPath = (reportId: string): string => `/api/v1/reports/${reportId}/calculator`;

export async function readCalculator(input: {
  readonly reportId: string;
  readonly fetch?: typeof fetch;
}): Promise<Calculator | null> {
  const send = input.fetch ?? fetch;
  const path = calculatorPath(input.reportId);
  try {
    const response = await send(path, { headers: { accept: 'application/json' }, credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) return null;
    return readResultObject<Calculator>(await response.json(), path).object;
  } catch {
    return null;
  }
}
