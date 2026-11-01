import type { DisclosureTarget } from '@easyesg/contracts';
import type { FieldValue } from '@easyesg/validation';

/**
 * **What a target seeks, and how far the undertaking has come**, for one of C3's emissions (task 79.3; UC-185 step 3;
 * `architecture.md` §12.5.6's task-79.3 row (2)) — worked out and shown, never stored or exported.
 *
 * Both are a change from the base year, `later ÷ base − 1`, which is the template's own *Percentage reduction from base
 * year*, `−(1 − target ÷ base)`: signed, so a cut reads negative and a rise positive. **No change where the base is zero
 * or either figure is missing** — a change from nothing has no size, and EFRAG's cell prints *-* (UC-185 3a).
 *
 * **Floats, rounded once where they are shown** — the api's own ratios are computed so (`relative_gap`,
 * `share_of_headcount`) and only their display rounds, and nothing here is filed. The answer is decimal text, the shape
 * `formatShare` reads.
 */
export interface TargetChanges {
  /** The target year's figure against the base year's — EFRAG's column. */
  readonly sought: string | null;
  /** The reporting year's figure against the base year's — frame 26's progress so far. */
  readonly sinceBase: string | null;
}

/** One emission's three figures as the wizard holds them now — `null` for one nobody has stated. */
export interface TargetFigures {
  readonly base: string | null;
  readonly target: string | null;
  /** The reporting year's — B3's undimensioned row, shown on C3 as B3 holds it. */
  readonly current: string | null;
}

export function targetChanges(figures: TargetFigures): TargetChanges {
  return {
    sought: changeFrom({ base: figures.base, later: figures.target }),
    sinceBase: changeFrom({ base: figures.base, later: figures.current }),
  };
}

/** The emission's three figures, out of the step's held answers, by the members the step names base and target. */
export function targetFigures(input: {
  readonly elementKey: string;
  readonly target: DisclosureTarget;
  readonly held: readonly FieldValue[];
}): TargetFigures {
  const at = (dimensionKey: string): string | null =>
    input.held.find(
      (answer) =>
        answer.elementKey === input.elementKey &&
        (answer.dimensionKey ?? '') === dimensionKey &&
        (answer.ordinal ?? 0) === 0,
    )?.valueNumeric ?? null;
  return { base: at(input.target.base), target: at(input.target.target), current: at('') };
}

/**
 * Below this a change is no change: `String` writes a smaller fraction in exponent notation, which no decimal reader
 * takes, and a millionth of a percent is not a movement anyone reports.
 */
const NEGLIGIBLE = 1e-9;

function changeFrom(input: { readonly base: string | null; readonly later: string | null }): string | null {
  const base = figure(input.base);
  const later = figure(input.later);
  if (base === null || later === null || base === 0) return null;
  const change = later / base - 1;
  return Math.abs(change) < NEGLIGIBLE ? '0' : String(change);
}

/** A stated figure as a number, or `null` for nothing stated or nothing a number can be read from. */
function figure(text: string | null): number | null {
  if (text === null || text.trim() === '') return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}
