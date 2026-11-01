import type { DerivationRecalculator } from '../interfaces/derivation.interface';
import type { DisclosureValueStore } from '../interfaces/disclosure-value-store.interface';
import {
  DISCLOSURE_ORIGIN,
  DISCLOSURE_STATE,
  type DisclosureOrigin,
  type DisclosureValue,
  type DisclosureValueKey,
} from '../models/disclosure-value.model';

/**
 * A report's whole-report figures in memory, and a recalculator that records what it was asked — shared by the four
 * computed-figure specs (task 38.4). **It models the one thing those use cases read**: each figure's value, origin and
 * explanation; `writeFigure` behaves as the repository's does, setting all three at once.
 */
export interface StoredFigure {
  readonly valueNumeric: string | null;
  readonly origin: DisclosureOrigin;
  readonly explanation: string | null;
}

export const REPORT = 'report-1';

export class FakeFigureStore {
  readonly figures = new Map<string, StoredFigure>();
  readonly recomputed: ReadonlySet<string>[] = [];

  constructor(stored: Readonly<Record<string, Partial<StoredFigure>>> = {}) {
    for (const [elementKey, figure] of Object.entries(stored)) {
      this.figures.set(elementKey, {
        valueNumeric: figure.valueNumeric === undefined ? '1' : figure.valueNumeric,
        origin: figure.origin ?? DISCLOSURE_ORIGIN.REPORTED,
        explanation: figure.explanation ?? null,
      });
    }
  }

  private row(elementKey: string): DisclosureValue {
    const figure = this.figures.get(elementKey);
    return {
      reportId: REPORT,
      elementKey,
      dimensionKey: '',
      ordinal: 0,
      valueNumeric: figure?.valueNumeric ?? null,
      origin: figure?.origin ?? DISCLOSURE_ORIGIN.REPORTED,
      explanation: figure?.explanation ?? null,
      state: DISCLOSURE_STATE.OK,
    } as DisclosureValue;
  }

  readonly values = {
    forReport: () => Promise.resolve([...this.figures.keys()].map((key) => this.row(key))),
    find: (key: DisclosureValueKey) => Promise.resolve(this.figures.has(key.elementKey) ? this.row(key.elementKey) : null),
    writeFigure: (value: { key: DisclosureValueKey; valueNumeric: string | null; origin: DisclosureOrigin; explanation: string | null }) => {
      this.figures.set(value.key.elementKey, {
        valueNumeric: value.valueNumeric,
        origin: value.origin,
        explanation: value.explanation,
      });
      return Promise.resolve(this.row(value.key.elementKey));
    },
  } as unknown as DisclosureValueStore;

  readonly recalculator: DerivationRecalculator = {
    recompute: (command) => {
      this.recomputed.push(command.touched);
      return Promise.resolve();
    },
  };
}
