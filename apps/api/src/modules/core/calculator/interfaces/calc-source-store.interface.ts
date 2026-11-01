import type { CalcSource, CalcSourceKey, CalcSourceWrite } from '../models/calc-source.model';

/**
 * A report's invoice lines — `core.calc_source` (task 38.1; FR-33, UX-41).
 *
 * Tenant-scoped throughout, like every `core` store: no method takes an organization, because RLS on the bound
 * transaction is the whole of the tenancy (DR-5, AD-2), and the one place the column is written it is taken from the
 * report.
 */
export interface CalcSourceStore {
  /** Every line the report holds, oldest first — the order S-09 lists them in. */
  forReport(query: { readonly reportId: string }): Promise<CalcSource[]>;

  /**
   * Create the line under the id its client chose, or replace what it says — idempotent, so FR-38's replayed autosave
   * writes the same line again. Answers `null` where the id names a line of **another** of the tenant's reports:
   * a line never moves between reports, and the store will not move it.
   */
  write(line: CalcSourceWrite): Promise<CalcSource | null>;

  /** Remove a line. Answers whether one was there; removing one that is not is the caller's intended end state. */
  remove(key: CalcSourceKey): Promise<boolean>;
}

/** DI token beside the interface, as every port in `core/` is (P-7). */
export const CALC_SOURCE_STORE = Symbol('CALC_SOURCE_STORE');
