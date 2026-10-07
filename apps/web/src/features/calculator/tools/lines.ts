import type { CalcLine, OverridingPerson } from '@easyesg/contracts';
import { isLineRemoval, type QueuedLine } from '@/features/wizard/tools/autosave-state';

/**
 * S-09's lines as the reader sees them (task 39.1): what the server served, overlaid with what the api has acknowledged
 * since, overlaid with what is still waiting in the queue (FR-38) — so a line entered offline is on screen at once, and
 * one removed is gone at once, whatever the network says.
 *
 * **The same precedence the wizard's fields use** (`withCommitted`, `syncStateOf`): pending outranks committed, which
 * outranks served, because each is newer than the one under it. A pending line's figures are what was typed and are
 * marked as waiting; nothing here computes anything the server owns.
 */
export interface LineView {
  readonly id: string;
  readonly siteOrdinal: number;
  readonly sourceKey: string;
  readonly description: string | null;
  readonly quantity: string | null;
  readonly unitCode: string | null;
  readonly notAvailableReason: string | null;
  readonly monthlyQuantities: readonly (string | null)[] | null;
  readonly overrideTonnes: string | null;
  readonly overrideExplanation: string | null;
  /**
   * Who replaced the line's tonnes (task 39.4) — the server's answer. A queued line keeps the person of the override it
   * still carries unchanged, and names no one for one it changes, until the server says who: the table's own rule.
   */
  readonly overriddenBy: OverridingPerson | null;
  /** Whether what is shown is still in the queue rather than stored — the figure the server has not seen. */
  readonly pending: boolean;
}

const fromServed = (line: CalcLine): LineView => ({
  id: line.id,
  siteOrdinal: line.siteOrdinal,
  sourceKey: line.sourceKey,
  description: line.description,
  quantity: line.quantity,
  unitCode: line.unitCode,
  notAvailableReason: line.notAvailableReason,
  monthlyQuantities: line.monthlyQuantities,
  overrideTonnes: line.overrideTonnes,
  overrideExplanation: line.overrideExplanation,
  overriddenBy: line.overriddenBy,
  pending: false,
});

export function linesOf(input: {
  readonly served: readonly CalcLine[];
  readonly committed: Readonly<Record<string, CalcLine | null>>;
  /** The queue's lines, in the order they were changed. */
  readonly pending: readonly QueuedLine[];
}): readonly LineView[] {
  // A Map keeps insertion order: served lines in the server's order, then lines new since, in the order they arrived.
  const lines = new Map<string, LineView | null>(input.served.map((line) => [line.id, fromServed(line)]));
  for (const [id, line] of Object.entries(input.committed)) lines.set(id, line === null ? null : fromServed(line));
  for (const queued of input.pending) {
    if (isLineRemoval(queued)) {
      lines.set(queued.lineId, null);
      continue;
    }
    const { line } = queued;
    const shown = lines.get(queued.lineId) ?? null;
    const overrideTonnes = line.overrideTonnes ?? null;
    const overrideExplanation = line.overrideExplanation ?? null;
    const sameOverride =
      shown !== null && shown.overrideTonnes === overrideTonnes && shown.overrideExplanation === overrideExplanation;
    lines.set(queued.lineId, {
      id: queued.lineId,
      siteOrdinal: line.siteOrdinal,
      sourceKey: line.sourceKey,
      description: line.description ?? null,
      quantity: line.quantity ?? null,
      unitCode: line.unitCode ?? null,
      notAvailableReason: line.notAvailableReason ?? null,
      monthlyQuantities: line.monthlyQuantities ?? null,
      overrideTonnes,
      overrideExplanation,
      overriddenBy: sameOverride ? shown.overriddenBy : null,
      pending: true,
    });
  }
  return [...lines.values()].filter((line): line is LineView => line !== null);
}
