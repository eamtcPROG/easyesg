import type { ScopeTotal } from '../domain/scope-total';
import type { LatestCalcRun } from './calc-run.model';
import type { CalcSource } from './calc-source.model';
import type { FactorSet } from './factor-set.model';

/**
 * The calculator as S-09 opens it (task 39.1; FR-33, UX-40, UX-41): what may be entered, where, over which months, and
 * what has been.
 */

/** One of the report's B1 site rows — the places a line may belong to. */
export interface CalcSite {
  /** Its ordinal on the site axis: what a line's `siteOrdinal` names. */
  readonly ordinal: number;
  /** What the wizard calls it, or `null` where nothing in B1 names it yet. */
  readonly name: string | null;
}

export interface CalculatorView {
  /**
   * The factor set the report's period resolves — its sources and the units each admits are what a line may say
   * (FR-33) — or `null` where none serves the period, in which case no line can be written.
   */
  readonly factorSet: FactorSet | null;
  /** The report's B1 site rows, by ordinal. Empty until B1 records a site (FR-33's precondition). */
  readonly sites: readonly CalcSite[];
  /** The calendar months the monthly form's twelve rows stand for, `YYYY-MM`, or `null` where it is not offered. */
  readonly months: readonly string[] | null;
  /** The report's lines, oldest first. */
  readonly sources: readonly CalcSource[];
  /**
   * What the lines come to now, against `factorSet` — the screen's converted and emissions columns and its totals
   * (task 39.2, `domain/working-results.ts`) — or `null` where no set serves the period.
   */
  readonly working: { readonly scopes: readonly ScopeTotal[]; readonly uncovered: readonly string[] } | null;
  /**
   * The report's latest run, with the set it pinned read back by that pin — `null` for the set where the pin reads as
   * nothing, which no recorded run should — or `null` where no run has been recorded (task 39.2; UX-44).
   */
  readonly latestRun: (LatestCalcRun & { readonly pinned: FactorSet | null }) | null;
  /** Decimal places by unit, as every surface rounds a computed figure (task 39.2; `PRESENTATION_PRECISION`). */
  readonly precision: Readonly<Record<string, number>>;
}
