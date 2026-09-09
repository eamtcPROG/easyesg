/**
 * The store of derivation inputs — `core.report_derivation_input` (task 36.10; §7.3).
 *
 * Narrow on purpose (ISP): a derived figure needs every input for one report at once, and a write
 * sets one. There is no `find` for a single input because nothing asks that question — the step read
 * and the derivation both want the whole set, and one round trip answers both.
 */
export interface DerivationInputStore {
  /** Every stored input for a report. Absent keys are absent rows; the artefact supplies the offer. */
  forReport(query: { readonly reportId: string }): Promise<DerivationInputValue[]>;
  /**
   * Set one input. Answers `null` where the report is not the bound tenant's or does not exist —
   * the same answer for both, as the value store does, because a caller may not learn which.
   */
  write(value: DerivationInputWrite): Promise<DerivationInputValue | null>;
  /** Remove one input, so a reporter can clear a figure back to the published offer. */
  remove(key: DerivationInputKey): Promise<boolean>;
}

export interface DerivationInputKey {
  readonly reportId: string;
  readonly inputKey: string;
}

export interface DerivationInputWrite extends DerivationInputKey {
  /** Decimal string, never a float — the value feeds a figure a filing carries (§7.3). */
  readonly valueNumeric: string;
}

export interface DerivationInputValue extends DerivationInputKey {
  readonly id: string;
  readonly valueNumeric: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** DI token beside the interface, as every other port in this module is (P-7). */
export const DERIVATION_INPUT_STORE = Symbol('DERIVATION_INPUT_STORE');
