import type { LineView } from './lines';

/**
 * How a line's figure is entered (task 39.1): one figure for the period, twelve months, or a reason there is none —
 * the three shapes FR-33 admits, as the row offers them.
 *
 * **What the line holds decides it, until the reader chooses another**: a row opened to *enter by month* shows the
 * twelve rows before any is filled, and the line stays one figure until the first month is entered — nothing is written
 * for a choice alone, because an empty form is not a line the api would take.
 */
export const LINE_ENTRY = {
  FIGURE: 'figure',
  MONTHS: 'months',
  REASON: 'reason',
} as const;

export type LineEntry = (typeof LINE_ENTRY)[keyof typeof LINE_ENTRY];

/** The entry a stored line is in. */
export const storedEntry = (line: Pick<LineView, 'notAvailableReason' | 'monthlyQuantities'>): LineEntry =>
  line.notAvailableReason !== null
    ? LINE_ENTRY.REASON
    : line.monthlyQuantities !== null
      ? LINE_ENTRY.MONTHS
      : LINE_ENTRY.FIGURE;
