import { LINE_OUTCOME, type CalcScopeLine } from '@easyesg/contracts';
import type { LineView } from './lines';

/**
 * What a line's converted and emissions cells say (task 39.2): its figures, or why it has none — never a zero where the
 * server has not computed one (the artboard's *"a figure entered offline shows as pending rather than as zero"*).
 *
 * - **Explained** — the bill has no figure, so there is nothing to convert: a dash.
 * - **Waiting** — the line is still in the queue, or newer than the figures read, so the server, which holds the
 *   factors, has not computed it.
 * - **Uncovered** — a correction to the set dropped the line's source or unit; the run would refuse it.
 * - **Computed** — MWh and tonnes, and the derivation can be opened.
 */
export const LINE_DISPLAY = {
  EXPLAINED: 'explained',
  WAITING: 'waiting',
  UNCOVERED: 'uncovered',
  COMPUTED: 'computed',
} as const;

export type LineDisplay =
  | { readonly kind: typeof LINE_DISPLAY.EXPLAINED }
  | { readonly kind: typeof LINE_DISPLAY.WAITING }
  | { readonly kind: typeof LINE_DISPLAY.UNCOVERED }
  | {
      readonly kind: typeof LINE_DISPLAY.COMPUTED;
      readonly megawattHours: string;
      /** The tonnes the scope counts — the reporter's, where a line override replaced the computed ones. */
      readonly tonnesCo2e: string;
    };

export function lineDisplay(input: {
  readonly line: Pick<LineView, 'pending' | 'notAvailableReason'>;
  readonly result: CalcScopeLine | undefined;
  readonly uncovered: boolean;
}): LineDisplay {
  const { line, result } = input;
  if (line.notAvailableReason !== null) return { kind: LINE_DISPLAY.EXPLAINED };
  if (input.uncovered) return { kind: LINE_DISPLAY.UNCOVERED };
  if (line.pending || result === undefined || result.megawattHours === null || result.tonnesCo2e === null) {
    return result?.outcome === LINE_OUTCOME.NOT_AVAILABLE && !line.pending
      ? { kind: LINE_DISPLAY.EXPLAINED }
      : { kind: LINE_DISPLAY.WAITING };
  }
  return { kind: LINE_DISPLAY.COMPUTED, megawattHours: result.megawattHours, tonnesCo2e: result.tonnesCo2e };
}
