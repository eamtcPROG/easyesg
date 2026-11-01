import { isDecimalString, sumDecimals } from '@api/contracts/types/decimal';

/**
 * A monthly line's quantity: the months entered, summed exactly (task 39.1; FR-33; §12.5.6's task-39 row (1)).
 *
 * **The sum is the server's**, so the quantity a run copies and the twelve figures a reporter typed can never
 * disagree — the table's `calc_source_months_total` holds the same equality after the write. **An empty month adds
 * nothing and is not zero**: it is flagged on the line, never refused, and a form with every month empty has no total
 * at all, which is a line with no figure rather than a line that burned nothing (FR-30's distinction).
 *
 * Exact, as every figure the calculator handles is (`contracts/types/decimal.ts`): a scaled `bigint` sum, never a
 * float.
 */
export function monthsTotal(months: readonly (string | null)[]): string | null {
  const entered = months.filter(isDecimalString);
  return entered.length === 0 ? null : sumDecimals(entered);
}
