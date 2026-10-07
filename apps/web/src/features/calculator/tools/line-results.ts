import type { CalcScopeLine, CalcWorking } from '@easyesg/contracts';

/**
 * Each line's working figures by its id (task 39.2): its MWh and tonnes as a run recorded now would compute them, from
 * the scopes the read served. **A line absent from the answer has none to show** — it is still in the queue, so the
 * server has not seen it, or the set no longer covers it — and the row says which, never a zero (the artboard's
 * *"factors live on the server, so a figure entered offline shows as pending rather than as zero"*).
 */
export function lineResults(working: CalcWorking | null): ReadonlyMap<string, CalcScopeLine> {
  return new Map((working?.scopes ?? []).flatMap((scope) => scope.lines.map((line) => [line.sourceId, line] as const)));
}
